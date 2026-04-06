from fastapi import FastAPI, APIRouter, HTTPException, Request, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import razorpay
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, messaging
import json
import hashlib
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

razorpay_client = razorpay.Client(auth=(os.environ['RAZORPAY_KEY_ID'], os.environ.get('RAZORPAY_KEY_SECRET', '')))

# Initialize Firebase Admin (for FCM)
try:
    firebase_admin.get_app()
except ValueError:
    # Firebase not initialized, skip for now
    pass

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Helper functions for password hashing
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hash_obj = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}:{hash_obj.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    try:
        salt, hash_val = hashed.split(':')
        hash_obj = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return hash_obj.hex() == hash_val
    except:
        return False

class UserRegister(BaseModel):
    phone: str
    role: str
    name: Optional[str] = None
    gender: Optional[str] = None
    firebase_uid: str

class SalonPartnerRegister(BaseModel):
    phone: str
    unique_id: str
    password: str
    firebase_uid: str
    name: Optional[str] = None

class SalonPartnerLogin(BaseModel):
    identifier: str  # unique_id or phone
    password: str

class OTPRateLimit(BaseModel):
    phone: str

class FCMToken(BaseModel):
    user_id: str
    token: str
    device_type: Optional[str] = "web"

class SalonRegister(BaseModel):
    salon_name: str
    owner_name: str
    phone: str
    address: str
    area: str
    latitude: float
    longitude: float
    staff_count: int
    avg_service_time: int
    services: List[dict]
    secondary_phone: Optional[str] = None
    business_type: Optional[str] = 'salon'
    firebase_uid: str
    # Subscription fields
    subscription_plan: Optional[str] = "1_month"  # 1_month or 3_months
    payment_reference: Optional[str] = None
    payment_screenshot_url: Optional[str] = None

class AdminLogin(BaseModel):
    email: str
    password: str

class SalonPhotoUpload(BaseModel):
    salon_id: str
    photo_url: str

class BankDetails(BaseModel):
    account_holder_name: str
    bank_name: str
    account_number: str
    ifsc_code: str
    upi_id: Optional[str] = None

class BookingCreate(BaseModel):
    salon_id: str
    service_id: str
    slot_time: str
    booking_date: str
    payment_method: str
    customer_phone: str
    customer_name: str

class PaymentCreate(BaseModel):
    amount: int
    booking_id: str

class CommissionPayment(BaseModel):
    salon_id: str
    amount: float

class SubscriptionApproval(BaseModel):
    salon_id: str
    approved: bool
    admin_notes: Optional[str] = None

# Subscription plans
SUBSCRIPTION_PLANS = {
    "1_month": {"price": 999, "days": 30, "name": "1 Month Plan"},
    "3_months": {"price": 2499, "days": 90, "name": "3 Months Plan"}
}

# Commission rate constant
COMMISSION_RATE = 0.10  # 10%

# Helper function to calculate commission
def calculate_commission(amount: float) -> float:
    return round(amount * COMMISSION_RATE, 2)

# Helper function to get current billing cycle dates
def get_billing_cycle_dates():
    now = datetime.now(timezone.utc)
    # Billing cycle is from 1st to end of month
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        end_of_month = now.replace(year=now.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        end_of_month = now.replace(month=now.month + 1, day=1) - timedelta(days=1)
    return start_of_month, end_of_month

@api_router.get("/")
async def root():
    return {"message": "Salon Booking API"}

# ==================== OTP RATE LIMITING ====================

@api_router.post("/auth/check-rate-limit")
async def check_otp_rate_limit(data: OTPRateLimit):
    """Check if OTP can be sent (rate limiting)"""
    phone = data.phone
    now = datetime.now(timezone.utc)
    
    # Find recent OTP requests for this phone
    rate_limit = await db.otp_rate_limits.find_one({"phone": phone})
    
    if rate_limit:
        last_request = datetime.fromisoformat(rate_limit["last_request"].replace("Z", "+00:00"))
        request_count = rate_limit.get("request_count", 0)
        window_start = datetime.fromisoformat(rate_limit.get("window_start", now.isoformat()).replace("Z", "+00:00"))
        
        # Reset window if more than 1 hour has passed
        if (now - window_start).total_seconds() > 3600:
            await db.otp_rate_limits.update_one(
                {"phone": phone},
                {"$set": {"request_count": 1, "window_start": now.isoformat(), "last_request": now.isoformat()}}
            )
            return {"allowed": True, "message": "OTP can be sent"}
        
        # Block if more than 5 requests in 1 hour
        if request_count >= 5:
            remaining_time = 3600 - (now - window_start).total_seconds()
            return {"allowed": False, "message": f"Too many OTP requests. Try again in {int(remaining_time/60)} minutes", "blocked_until": (window_start + timedelta(hours=1)).isoformat()}
        
        # Block if less than 60 seconds since last request
        if (now - last_request).total_seconds() < 60:
            return {"allowed": False, "message": "Please wait 60 seconds before requesting another OTP"}
        
        # Update count
        await db.otp_rate_limits.update_one(
            {"phone": phone},
            {"$inc": {"request_count": 1}, "$set": {"last_request": now.isoformat()}}
        )
    else:
        # First request
        await db.otp_rate_limits.insert_one({
            "phone": phone,
            "request_count": 1,
            "window_start": now.isoformat(),
            "last_request": now.isoformat()
        })
    
    return {"allowed": True, "message": "OTP can be sent"}

# ==================== CUSTOMER AUTH ====================

@api_router.post("/auth/register")
async def register_user(user_data: UserRegister):
    existing_user = await db.users.find_one({"firebase_uid": user_data.firebase_uid})
    if existing_user:
        # Update last login
        await db.users.update_one(
            {"firebase_uid": user_data.firebase_uid},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "User already exists", "user_id": existing_user["user_id"], "is_new": False}
    
    # Check if phone already exists (different firebase uid)
    existing_phone = await db.users.find_one({"phone": user_data.phone, "role": user_data.role})
    if existing_phone:
        # Link firebase uid to existing account
        await db.users.update_one(
            {"phone": user_data.phone, "role": user_data.role},
            {"$set": {"firebase_uid": user_data.firebase_uid, "last_login": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Account linked", "user_id": existing_phone["user_id"], "is_new": False}
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "user_id": user_id,
        "firebase_uid": user_data.firebase_uid,
        "phone": user_data.phone,
        "role": user_data.role,
        "name": user_data.name,
        "gender": user_data.gender,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    return {"message": "User registered", "user_id": user_id, "role": user_data.role, "is_new": True}

# ==================== SALON PARTNER AUTH ====================

@api_router.post("/auth/salon-partner/register")
async def register_salon_partner(data: SalonPartnerRegister):
    """Register salon partner with unique ID and password"""
    # Check if unique_id already exists
    existing_id = await db.salon_partners.find_one({"unique_id": data.unique_id})
    if existing_id:
        raise HTTPException(status_code=400, detail="This Unique ID is already taken")
    
    # Check if phone already registered
    existing_phone = await db.salon_partners.find_one({"phone": data.phone})
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    partner_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    partner_doc = {
        "partner_id": partner_id,
        "firebase_uid": data.firebase_uid,
        "phone": data.phone,
        "unique_id": data.unique_id,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "status": "pending",  # pending, active, blocked
        "login_attempts": 0,
        "locked_until": None,
        "fcm_tokens": [],
        "created_at": now.isoformat(),
        "last_login": None
    }
    
    await db.salon_partners.insert_one(partner_doc)
    
    # Also create user entry for compatibility
    user_doc = {
        "user_id": partner_id,
        "firebase_uid": data.firebase_uid,
        "phone": data.phone,
        "role": "salon",
        "name": data.name,
        "created_at": now.isoformat()
    }
    await db.users.insert_one(user_doc)
    
    return {"message": "Registration successful. Awaiting admin approval.", "partner_id": partner_id, "status": "pending"}

@api_router.post("/auth/salon-partner/login")
async def login_salon_partner(data: SalonPartnerLogin):
    """Login salon partner with unique ID/phone and password"""
    # Find by unique_id or phone
    partner = await db.salon_partners.find_one({
        "$or": [{"unique_id": data.identifier}, {"phone": data.identifier}]
    })
    
    if not partner:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    now = datetime.now(timezone.utc)
    
    # Check if account is locked
    if partner.get("locked_until"):
        locked_until = datetime.fromisoformat(partner["locked_until"].replace("Z", "+00:00"))
        if now < locked_until:
            remaining = int((locked_until - now).total_seconds() / 60)
            raise HTTPException(status_code=423, detail=f"Account locked. Try again in {remaining} minutes")
        else:
            # Unlock
            await db.salon_partners.update_one(
                {"partner_id": partner["partner_id"]},
                {"$set": {"locked_until": None, "login_attempts": 0}}
            )
    
    # Verify password
    if not verify_password(data.password, partner.get("password_hash", "")):
        # Increment login attempts
        attempts = partner.get("login_attempts", 0) + 1
        update_data = {"login_attempts": attempts}
        
        if attempts >= 5:
            update_data["locked_until"] = (now + timedelta(minutes=15)).isoformat()
            await db.salon_partners.update_one({"partner_id": partner["partner_id"]}, {"$set": update_data})
            raise HTTPException(status_code=423, detail="Too many failed attempts. Account locked for 15 minutes")
        
        await db.salon_partners.update_one({"partner_id": partner["partner_id"]}, {"$set": update_data})
        raise HTTPException(status_code=401, detail=f"Invalid password. {5 - attempts} attempts remaining")
    
    # Check account status
    if partner["status"] == "pending":
        raise HTTPException(status_code=403, detail="Account pending admin approval")
    
    if partner["status"] == "blocked":
        raise HTTPException(status_code=403, detail="Account has been blocked. Contact support")
    
    # Successful login - reset attempts and update last login
    await db.salon_partners.update_one(
        {"partner_id": partner["partner_id"]},
        {"$set": {"login_attempts": 0, "locked_until": None, "last_login": now.isoformat()}}
    )
    
    return {
        "message": "Login successful",
        "partner_id": partner["partner_id"],
        "unique_id": partner["unique_id"],
        "phone": partner["phone"],
        "name": partner.get("name"),
        "status": partner["status"],
        "firebase_uid": partner.get("firebase_uid")
    }

@api_router.get("/auth/salon-partner/check-unique-id/{unique_id}")
async def check_unique_id_availability(unique_id: str):
    """Check if unique ID is available"""
    existing = await db.salon_partners.find_one({"unique_id": unique_id})
    return {"available": existing is None}

@api_router.post("/auth/salon-partner/approve/{partner_id}")
async def approve_salon_partner(partner_id: str):
    """Admin approves salon partner"""
    partner = await db.salon_partners.find_one({"partner_id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    await db.salon_partners.update_one(
        {"partner_id": partner_id},
        {"$set": {"status": "active", "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Partner approved"}

@api_router.get("/salon/status/{phone}")
async def get_salon_status(phone: str):
    """Get salon registration status by phone"""
    # Check salon registration
    salon = await db.salons.find_one({"phone": phone}, {"_id": 0, "status": 1, "salon_name": 1})
    if salon:
        return {"status": salon.get("status", "pending"), "salon_name": salon.get("salon_name")}
    
    # Check salon partner
    partner = await db.salon_partners.find_one({"phone": phone}, {"_id": 0, "status": 1})
    if partner:
        return {"status": partner.get("status", "pending")}
    
    return {"status": "not_found"}

@api_router.get("/admin/salon-partners/pending")
async def get_pending_partners():
    """Get all pending salon partner approvals"""
    partners = await db.salon_partners.find({"status": "pending"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return partners

# ==================== FCM PUSH NOTIFICATIONS ====================

@api_router.post("/fcm/register-token")
async def register_fcm_token(data: FCMToken):
    """Register FCM token for push notifications"""
    # Find user
    user = await db.users.find_one({"user_id": data.user_id})
    partner = await db.salon_partners.find_one({"partner_id": data.user_id})
    
    if partner:
        # Add token to salon partner
        await db.salon_partners.update_one(
            {"partner_id": data.user_id},
            {"$addToSet": {"fcm_tokens": {"token": data.token, "device_type": data.device_type}}}
        )
    elif user:
        # Add token to user
        await db.users.update_one(
            {"user_id": data.user_id},
            {"$addToSet": {"fcm_tokens": {"token": data.token, "device_type": data.device_type}}}
        )
    else:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "FCM token registered"}

@api_router.post("/fcm/send-booking-notification/{salon_id}")
async def send_booking_notification(salon_id: str, booking_data: dict):
    """Send push notification to salon for new booking"""
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        return {"message": "Salon not found"}
    
    # Get partner FCM tokens
    partner = await db.salon_partners.find_one({"phone": salon.get("phone")})
    if not partner or not partner.get("fcm_tokens"):
        return {"message": "No FCM tokens registered"}
    
    # This would send actual FCM notification if firebase-admin is configured
    # For now, store notification in database for dashboard retrieval
    notification_doc = {
        "notification_id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "type": "new_booking",
        "title": "New Booking Request!",
        "body": f"New booking from {booking_data.get('customer_name', 'Customer')} for {booking_data.get('service_name', 'Service')}",
        "data": booking_data,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notifications.insert_one(notification_doc)
    
    return {"message": "Notification queued"}

@api_router.get("/notifications/salon/{salon_id}")
async def get_salon_notifications(salon_id: str, unread_only: bool = False):
    """Get notifications for a salon"""
    query = {"salon_id": salon_id}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return notifications

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark notification as read"""
    await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"read": True}}
    )
    return {"message": "Marked as read"}

@api_router.get("/auth/user/{firebase_uid}")
async def get_user(firebase_uid: str):
    user = await db.users.find_one({"firebase_uid": firebase_uid}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.post("/salon/register")
async def register_salon(salon_data: SalonRegister):
    user = await db.users.find_one({"firebase_uid": salon_data.firebase_uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    salon_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Get subscription plan details
    plan = SUBSCRIPTION_PLANS.get(salon_data.subscription_plan, SUBSCRIPTION_PLANS["1_month"])
    
    salon_doc = {
        "salon_id": salon_id,
        "user_id": user["user_id"],
        "salon_name": salon_data.salon_name,
        "owner_name": salon_data.owner_name,
        "phone": salon_data.phone,
        "address": salon_data.address,
        "area": salon_data.area,
        "location": {
            "type": "Point",
            "coordinates": [salon_data.longitude, salon_data.latitude]
        },
        "staff_count": salon_data.staff_count,
        "avg_service_time": salon_data.avg_service_time,
        "services": salon_data.services,
        "secondary_phone": salon_data.secondary_phone,
        "business_type": salon_data.business_type,
        "status": "pending",  # Pending admin approval
        # Subscription fields
        "subscription": {
            "plan": salon_data.subscription_plan,
            "plan_name": plan["name"],
            "amount": plan["price"],
            "days": plan["days"],
            "payment_status": "pending",  # pending, approved, rejected
            "payment_reference": salon_data.payment_reference,
            "payment_screenshot_url": salon_data.payment_screenshot_url,
            "submitted_at": now.isoformat(),
            "approved_at": None,
            "expires_at": None
        },
        "subscription_status": "inactive",  # inactive, active, expired
        "response_stats": {
            "total_requests": 0,
            "accepted": 0,
            "rejected": 0,
            "expired": 0,
            "avg_response_time": 0,
            "total_response_time": 0,
            "acceptance_rate": 0,
            "rejection_rate": 0,
            "expiry_rate": 0
        },
        "created_at": now.isoformat()
    }
    
    await db.salons.insert_one(salon_doc)
    return {"message": "Salon registered. Awaiting payment verification and approval.", "salon_id": salon_id}

@api_router.patch("/salon/{salon_id}/update-subscription")
async def update_subscription_payment(salon_id: str, payment_reference: str, payment_screenshot_url: Optional[str] = None):
    """Update subscription payment details"""
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "subscription.payment_reference": payment_reference,
            "subscription.payment_screenshot_url": payment_screenshot_url,
            "subscription.submitted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Payment details updated"}

@api_router.post("/admin/subscription/approve")
async def approve_subscription(data: SubscriptionApproval):
    """Admin approves subscription payment"""
    salon = await db.salons.find_one({"salon_id": data.salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    now = datetime.now(timezone.utc)
    subscription = salon.get("subscription", {})
    plan_days = subscription.get("days", 30)
    expires_at = now + timedelta(days=plan_days)
    
    if data.approved:
        await db.salons.update_one(
            {"salon_id": data.salon_id},
            {"$set": {
                "subscription.payment_status": "approved",
                "subscription.approved_at": now.isoformat(),
                "subscription.expires_at": expires_at.isoformat(),
                "subscription.admin_notes": data.admin_notes,
                "subscription_status": "active",
                "status": "approved"  # Also approve the salon
            }}
        )
        return {"message": "Subscription approved", "expires_at": expires_at.isoformat()}
    else:
        await db.salons.update_one(
            {"salon_id": data.salon_id},
            {"$set": {
                "subscription.payment_status": "rejected",
                "subscription.admin_notes": data.admin_notes,
                "subscription_status": "inactive"
            }}
        )
        return {"message": "Subscription rejected"}

@api_router.post("/admin/subscription/check-expired")
async def check_expired_subscriptions():
    """Check and update expired subscriptions"""
    now = datetime.now(timezone.utc)
    
    # Find all active subscriptions that have expired
    expired_salons = await db.salons.find({
        "subscription_status": "active",
        "subscription.expires_at": {"$lt": now.isoformat()}
    }).to_list(1000)
    
    expired_count = 0
    for salon in expired_salons:
        await db.salons.update_one(
            {"salon_id": salon["salon_id"]},
            {"$set": {
                "subscription_status": "expired",
                "subscription.expired_at": now.isoformat()
            }}
        )
        expired_count += 1
    
    return {"expired_subscriptions": expired_count}

@api_router.post("/salon/{salon_id}/renew-subscription")
async def renew_subscription(salon_id: str, plan: str, payment_reference: str, payment_screenshot_url: Optional[str] = None):
    """Salon submits renewal request"""
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    plan_details = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["1_month"])
    now = datetime.now(timezone.utc)
    
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "subscription.plan": plan,
            "subscription.plan_name": plan_details["name"],
            "subscription.amount": plan_details["price"],
            "subscription.days": plan_details["days"],
            "subscription.payment_status": "pending",
            "subscription.payment_reference": payment_reference,
            "subscription.payment_screenshot_url": payment_screenshot_url,
            "subscription.submitted_at": now.isoformat(),
            "subscription.approved_at": None
        }}
    )
    
    return {"message": "Renewal request submitted"}

@api_router.get("/admin/subscriptions/pending")
async def get_pending_subscriptions():
    """Get all pending subscription approvals"""
    salons = await db.salons.find({
        "subscription.payment_status": "pending"
    }, {"_id": 0}).to_list(1000)
    return salons

@api_router.post("/salon/{salon_id}/bank-details")
async def add_bank_details(salon_id: str, bank_data: BankDetails):
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "bank_details": bank_data.model_dump(),
            "bank_verified": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Bank details added successfully"}

@api_router.get("/salon/{salon_id}")
async def get_salon(salon_id: str):
    salon = await db.salons.find_one({"salon_id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    return salon

@api_router.get("/salon/user/{firebase_uid}")
async def get_salon_by_user(firebase_uid: str):
    user = await db.users.find_one({"firebase_uid": firebase_uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    salon = await db.salons.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    return salon

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

@api_router.patch("/salon/{salon_id}/location")
async def update_salon_location(salon_id: str, location_data: LocationUpdate):
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "location": {
                "type": "Point",
                "coordinates": [location_data.longitude, location_data.latitude]
            },
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Location updated successfully"}

@api_router.get("/salons/nearby")
async def get_nearby_salons(lat: float, lng: float, radius: float = 5.0):
    radius_in_radians = radius / 6371.0
    
    salons = await db.salons.find({
        "status": "approved",
        "location": {
            "$geoWithin": {
                "$centerSphere": [[lng, lat], radius_in_radians]
            }
        }
    }, {"_id": 0}).to_list(100)
    
    return salons

@api_router.get("/salon/{salon_id}/slots")
async def get_available_slots(salon_id: str, date: str):
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    staff_count = salon.get("staff_count", 1)
    avg_time = salon.get("avg_service_time", 30)
    slots_per_hour = staff_count * (60 // avg_time)
    
    all_slots = []
    start_hour = 9
    end_hour = 20
    
    for hour in range(start_hour, end_hour):
        for slot_num in range(slots_per_hour):
            minute = (slot_num * avg_time) % 60
            slot_time = f"{hour:02d}:{minute:02d}"
            all_slots.append(slot_time)
    
    booked_slots = await db.bookings.find({
        "salon_id": salon_id,
        "booking_date": date,
        "status": {"$in": ["confirmed", "pending"]}
    }, {"_id": 0, "slot_time": 1}).to_list(1000)
    
    booked_times = [b["slot_time"] for b in booked_slots]
    available_slots = [s for s in all_slots if s not in booked_times]
    
    return {"available_slots": available_slots, "total_capacity": len(all_slots)}

@api_router.post("/booking/create")
async def create_booking(booking_data: BookingCreate):
    salon = await db.salons.find_one({"salon_id": booking_data.salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Check if salon is blocked
    if salon.get("status") == "blocked":
        raise HTTPException(status_code=403, detail="This salon is currently blocked. Please contact support.")
    
    # Check subscription status
    if salon.get("subscription_status") == "expired":
        raise HTTPException(status_code=403, detail="This salon's subscription has expired. They cannot accept new bookings.")
    
    existing_booking = await db.bookings.find_one({
        "salon_id": booking_data.salon_id,
        "booking_date": booking_data.booking_date,
        "slot_time": booking_data.slot_time,
        "status": {"$in": ["confirmed", "pending_approval"]}
    })
    
    if existing_booking:
        raise HTTPException(status_code=400, detail="Slot already booked")
    
    booking_id = str(uuid.uuid4())
    service = next((s for s in salon["services"] if s["id"] == booking_data.service_id), None)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Calculate commission (10% on all bookings)
    service_price = float(service["price"])
    commission_amount = calculate_commission(service_price)
    salon_payout = service_price - commission_amount
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=15)  # Auto-expire after 15 minutes
    
    booking_doc = {
        "booking_id": booking_id,
        "salon_id": booking_data.salon_id,
        "salon_name": salon["salon_name"],
        "service_id": booking_data.service_id,
        "service_name": service["name"],
        "service_price": service_price,
        "slot_time": booking_data.slot_time,
        "booking_date": booking_data.booking_date,
        "payment_method": booking_data.payment_method,
        "customer_phone": booking_data.customer_phone,
        "customer_name": booking_data.customer_name,
        "status": "pending_approval",  # Changed from "confirmed" to require salon approval
        "payment_status": "pending",
        "commission_amount": commission_amount,
        "salon_payout": salon_payout,
        "commission_status": "pending",
        "approval_expires_at": expires_at.isoformat(),
        "salon_response_time": None,
        "rejection_reason": None,
        "created_at": now.isoformat()
    }
    
    await db.bookings.insert_one(booking_doc)
    
    # Send push notification to salon
    notification_doc = {
        "notification_id": str(uuid.uuid4()),
        "salon_id": booking_data.salon_id,
        "type": "new_booking",
        "title": "🔔 New Booking Request!",
        "body": f"{booking_data.customer_name} wants to book {service['name']} on {booking_data.booking_date} at {booking_data.slot_time}",
        "data": {
            "booking_id": booking_id,
            "customer_name": booking_data.customer_name,
            "customer_phone": booking_data.customer_phone,
            "service_name": service["name"],
            "service_price": service_price,
            "booking_date": booking_data.booking_date,
            "slot_time": booking_data.slot_time,
            "payment_method": booking_data.payment_method
        },
        "read": False,
        "created_at": now.isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Remove MongoDB ObjectId from response
    booking_response = {k: v for k, v in booking_doc.items() if k != "_id"}
    
    return {
        "message": "Booking request submitted. Waiting for salon approval.",
        "booking_id": booking_id,
        "booking_details": booking_response,
        "expires_in_minutes": 15
    }

@api_router.post("/booking/{booking_id}/approve")
async def approve_booking(booking_id: str):
    """Salon approves a booking request"""
    booking = await db.bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] != "pending_approval":
        raise HTTPException(status_code=400, detail=f"Booking is already {booking['status']}")
    
    # Check if expired
    expires_at = datetime.fromisoformat(booking["approval_expires_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    
    if now > expires_at:
        raise HTTPException(status_code=400, detail="Booking request has expired")
    
    # Calculate response time
    created_at = datetime.fromisoformat(booking["created_at"].replace("Z", "+00:00"))
    response_time_seconds = (now - created_at).total_seconds()
    
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "confirmed",
            "salon_response_time": response_time_seconds,
            "approved_at": now.isoformat()
        }}
    )
    
    # If pay_at_salon, add to commission ledger
    if booking.get("payment_method") == "pay_at_salon":
        await add_to_commission_ledger(booking["salon_id"], booking_id, booking.get("commission_amount", 0))
    
    # Update salon acceptance stats
    await update_salon_response_stats(booking["salon_id"], "accepted", response_time_seconds)
    
    return {"message": "Booking confirmed successfully", "response_time_seconds": response_time_seconds}

@api_router.post("/booking/{booking_id}/reject")
async def reject_booking(booking_id: str, reason: Optional[str] = "Salon unavailable"):
    """Salon rejects a booking request"""
    booking = await db.bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] != "pending_approval":
        raise HTTPException(status_code=400, detail=f"Booking is already {booking['status']}")
    
    now = datetime.now(timezone.utc)
    created_at = datetime.fromisoformat(booking["created_at"].replace("Z", "+00:00"))
    response_time_seconds = (now - created_at).total_seconds()
    
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "salon_response_time": response_time_seconds,
            "rejected_at": now.isoformat()
        }}
    )
    
    # Update salon rejection stats
    await update_salon_response_stats(booking["salon_id"], "rejected", response_time_seconds)
    
    return {"message": "Booking rejected", "reason": reason}

@api_router.post("/bookings/check-expired")
async def check_expired_bookings():
    """Check and auto-expire pending bookings after 15 minutes"""
    now = datetime.now(timezone.utc)
    
    expired_bookings = await db.bookings.find({
        "status": "pending_approval",
        "approval_expires_at": {"$lt": now.isoformat()}
    }).to_list(1000)
    
    expired_count = 0
    for booking in expired_bookings:
        await db.bookings.update_one(
            {"booking_id": booking["booking_id"]},
            {"$set": {
                "status": "expired",
                "expired_at": now.isoformat()
            }}
        )
        # Update salon stats for no response
        await update_salon_response_stats(booking["salon_id"], "expired", 900)  # 15 min = 900 sec
        expired_count += 1
    
    return {"expired_bookings": expired_count}

async def update_salon_response_stats(salon_id: str, action: str, response_time: float):
    """Update salon acceptance/rejection stats"""
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        return
    
    stats = salon.get("response_stats", {
        "total_requests": 0,
        "accepted": 0,
        "rejected": 0,
        "expired": 0,
        "avg_response_time": 0,
        "total_response_time": 0
    })
    
    stats["total_requests"] += 1
    stats[action] += 1
    stats["total_response_time"] += response_time
    stats["avg_response_time"] = stats["total_response_time"] / stats["total_requests"]
    
    # Calculate rates
    if stats["total_requests"] > 0:
        stats["acceptance_rate"] = round((stats["accepted"] / stats["total_requests"]) * 100, 2)
        stats["rejection_rate"] = round((stats["rejected"] / stats["total_requests"]) * 100, 2)
        stats["expiry_rate"] = round((stats["expired"] / stats["total_requests"]) * 100, 2)
    
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {"response_stats": stats}}
    )

@api_router.get("/bookings/salon/{salon_id}/pending")
async def get_pending_bookings(salon_id: str):
    """Get all pending approval bookings for a salon"""
    bookings = await db.bookings.find({
        "salon_id": salon_id,
        "status": "pending_approval"
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    return bookings
    
    # Remove MongoDB ObjectId from response
    booking_response = {k: v for k, v in booking_doc.items() if k != "_id"}
    
    return {"message": "Booking created", "booking_id": booking_id, "booking_details": booking_response}

# Helper function to add to commission ledger
async def add_to_commission_ledger(salon_id: str, booking_id: str, commission_amount: float):
    now = datetime.now(timezone.utc)
    billing_month = now.strftime("%Y-%m")
    
    # Find or create monthly ledger entry
    ledger = await db.commission_ledger.find_one({
        "salon_id": salon_id,
        "billing_month": billing_month
    })
    
    if ledger:
        # Update existing ledger
        await db.commission_ledger.update_one(
            {"salon_id": salon_id, "billing_month": billing_month},
            {
                "$inc": {"total_pending": commission_amount, "booking_count": 1},
                "$push": {"booking_ids": booking_id},
                "$set": {"updated_at": now.isoformat()}
            }
        )
    else:
        # Create new ledger entry
        # Due date is 5th of next month
        if now.month == 12:
            due_date = now.replace(year=now.year + 1, month=1, day=5, hour=23, minute=59, second=59)
        else:
            due_date = now.replace(month=now.month + 1, day=5, hour=23, minute=59, second=59)
        
        await db.commission_ledger.insert_one({
            "ledger_id": str(uuid.uuid4()),
            "salon_id": salon_id,
            "billing_month": billing_month,
            "total_pending": commission_amount,
            "total_paid": 0,
            "booking_count": 1,
            "booking_ids": [booking_id],
            "status": "pending",  # pending, warning, overdue, paid
            "due_date": due_date.isoformat(),
            "payment_link": None,
            "razorpay_order_id": None,
            "paid_at": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        })

@api_router.post("/payment/create-order")
async def create_razorpay_order(payment_data: PaymentCreate):
    booking = await db.bookings.find_one({"booking_id": payment_data.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    try:
        order_data = {
            "amount": payment_data.amount * 100,
            "currency": "INR",
            "receipt": payment_data.booking_id,
            "payment_capture": 1
        }
        
        razorpay_order = razorpay_client.order.create(data=order_data)
        
        await db.payments.insert_one({
            "payment_id": str(uuid.uuid4()),
            "booking_id": payment_data.booking_id,
            "razorpay_order_id": razorpay_order["id"],
            "amount": payment_data.amount,
            "status": "created",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return razorpay_order
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/payment/verify")
async def verify_payment(request: Request):
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_signature = data.get("razorpay_signature")
    
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature
        })
        
        payment = await db.payments.find_one({"razorpay_order_id": razorpay_order_id})
        if payment:
            await db.payments.update_one(
                {"razorpay_order_id": razorpay_order_id},
                {"$set": {
                    "razorpay_payment_id": razorpay_payment_id,
                    "status": "success",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Update booking payment status and commission status for online payments
            booking = await db.bookings.find_one({"booking_id": payment["booking_id"]})
            if booking:
                update_fields = {
                    "payment_status": "paid",
                    "commission_status": "collected"  # Commission auto-deducted for online payments
                }
                await db.bookings.update_one(
                    {"booking_id": payment["booking_id"]},
                    {"$set": update_fields}
                )
                
                # Record commission collection for online payment
                await db.commission_records.insert_one({
                    "record_id": str(uuid.uuid4()),
                    "booking_id": payment["booking_id"],
                    "salon_id": booking["salon_id"],
                    "payment_type": "online",
                    "service_amount": booking.get("service_price", 0),
                    "commission_amount": booking.get("commission_amount", 0),
                    "salon_payout": booking.get("salon_payout", 0),
                    "status": "collected",
                    "collected_at": datetime.now(timezone.utc).isoformat()
                })
        
        return {"message": "Payment verified successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Payment verification failed")

@api_router.get("/bookings/customer/{phone}")
async def get_customer_bookings(phone: str):
    bookings = await db.bookings.find({"customer_phone": phone}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return bookings

@api_router.get("/bookings/salon/{salon_id}")
async def get_salon_bookings(salon_id: str):
    bookings = await db.bookings.find({"salon_id": salon_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return bookings

@api_router.patch("/booking/{booking_id}/cancel")
async def cancel_booking(booking_id: str):
    booking = await db.bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking_datetime_str = f"{booking['booking_date']} {booking['slot_time']}"
    booking_datetime = datetime.strptime(booking_datetime_str, "%Y-%m-%d %H:%M")
    
    current_time = datetime.now()
    time_difference = (booking_datetime - current_time).total_seconds() / 60
    
    if time_difference < 10:
        raise HTTPException(status_code=400, detail="Cannot cancel booking less than 10 minutes before appointment")
    
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Booking cancelled successfully"}

@api_router.get("/admin/salons")
async def get_all_salons():
    salons = await db.salons.find({}, {"_id": 0}).to_list(1000)
    return salons

@api_router.patch("/admin/salon/{salon_id}/approve")
async def approve_salon(salon_id: str):
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {"status": "approved"}}
    )
    return {"message": "Salon approved"}

@api_router.patch("/admin/salon/{salon_id}/block")
async def block_salon(salon_id: str):
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {"status": "blocked"}}
    )
    return {"message": "Salon blocked"}

@api_router.get("/admin/analytics")
async def get_analytics():
    total_bookings = await db.bookings.count_documents({})
    total_salons = await db.salons.count_documents({"status": "approved"})
    total_revenue = await db.bookings.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$service_price"}}}
    ]).to_list(1)
    
    revenue = total_revenue[0]["total"] if total_revenue else 0
    platform_earnings = revenue * 0.1
    
    return {
        "total_bookings": total_bookings,
        "total_salons": total_salons,
        "total_revenue": revenue,
        "platform_earnings": platform_earnings
    }

@api_router.post("/admin/login")
async def admin_login(login_data: AdminLogin):
    admin = await db.admins.find_one({"email": login_data.email}, {"_id": 0})
    if not admin or admin.get("password") != login_data.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {"message": "Login successful", "admin_id": admin["admin_id"], "email": admin["email"]}

@api_router.get("/admin/analytics/detailed")
async def get_detailed_analytics():
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    today_bookings = await db.bookings.count_documents({"created_at": {"$gte": today.isoformat()}})
    week_bookings = await db.bookings.count_documents({"created_at": {"$gte": week_ago.isoformat()}})
    month_bookings = await db.bookings.count_documents({"created_at": {"$gte": month_ago.isoformat()}})
    total_customers = await db.users.count_documents({"role": "customer"})
    
    return {
        "today_bookings": today_bookings,
        "week_bookings": week_bookings,
        "month_bookings": month_bookings,
        "total_customers": total_customers
    }

@api_router.get("/admin/salon/{salon_id}/analytics")
async def get_salon_analytics(salon_id: str):
    salon = await db.salons.find_one({"salon_id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    total_bookings = await db.bookings.count_documents({"salon_id": salon_id})
    
    service_stats = await db.bookings.aggregate([
        {"$match": {"salon_id": salon_id}},
        {"$group": {"_id": "$service_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(100)
    
    time_slot_stats = await db.bookings.aggregate([
        {"$match": {"salon_id": salon_id}},
        {"$group": {"_id": "$slot_time", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    revenue = await db.bookings.aggregate([
        {"$match": {"salon_id": salon_id, "payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$service_price"}}}
    ]).to_list(1)
    
    total_revenue = revenue[0]["total"] if revenue else 0
    
    unique_customers = await db.bookings.distinct("customer_phone", {"salon_id": salon_id})
    
    return {
        "salon": salon,
        "total_bookings": total_bookings,
        "popular_services": service_stats,
        "peak_time_slots": time_slot_stats,
        "total_revenue": total_revenue,
        "unique_customers": len(unique_customers)
    }

@api_router.get("/admin/bookings/analytics")
async def get_booking_analytics():
    """Get booking approval analytics for admin"""
    # Count by status
    pending_count = await db.bookings.count_documents({"status": "pending_approval"})
    confirmed_count = await db.bookings.count_documents({"status": "confirmed"})
    rejected_count = await db.bookings.count_documents({"status": "rejected"})
    expired_count = await db.bookings.count_documents({"status": "expired"})
    total_count = await db.bookings.count_documents({})
    
    # Calculate rates
    processed = confirmed_count + rejected_count + expired_count
    acceptance_rate = (confirmed_count / processed * 100) if processed > 0 else 0
    rejection_rate = (rejected_count / processed * 100) if processed > 0 else 0
    expiry_rate = (expired_count / processed * 100) if processed > 0 else 0
    
    # Average response time
    response_times = await db.bookings.aggregate([
        {"$match": {"salon_response_time": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$salon_response_time"}}}
    ]).to_list(1)
    avg_response_time = response_times[0]["avg"] if response_times else 0
    
    # Get salons with worst response stats
    slow_salons = await db.salons.find(
        {"response_stats.avg_response_time": {"$gt": 300}},  # > 5 min
        {"_id": 0, "salon_id": 1, "salon_name": 1, "response_stats": 1}
    ).sort("response_stats.avg_response_time", -1).to_list(10)
    
    return {
        "total_bookings": total_count,
        "pending_approval": pending_count,
        "confirmed": confirmed_count,
        "rejected": rejected_count,
        "expired": expired_count,
        "rates": {
            "acceptance_rate": round(acceptance_rate, 2),
            "rejection_rate": round(rejection_rate, 2),
            "expiry_rate": round(expiry_rate, 2)
        },
        "avg_response_time_seconds": round(avg_response_time, 2),
        "slow_response_salons": slow_salons
    }

@api_router.get("/admin/salons/analytics-summary")
async def get_salons_analytics_summary():
    salons = await db.salons.find({"status": "approved"}, {"_id": 0}).to_list(1000)
    
    salons_with_stats = []
    for salon in salons:
        booking_count = await db.bookings.count_documents({"salon_id": salon["salon_id"]})
        revenue_data = await db.bookings.aggregate([
            {"$match": {"salon_id": salon["salon_id"], "payment_status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$service_price"}}}
        ]).to_list(1)
        
        revenue = revenue_data[0]["total"] if revenue_data else 0
        
        salons_with_stats.append({
            **salon,
            "total_bookings": booking_count,
            "total_revenue": revenue
        })
    
    return salons_with_stats

@api_router.post("/salon/{salon_id}/upload-photo")
async def upload_salon_photo(salon_id: str, photo_data: SalonPhotoUpload):
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {"photo_url": photo_data.photo_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Photo uploaded successfully", "photo_url": photo_data.photo_url}

@api_router.get("/admin/bookings/all")
async def get_all_bookings(salon_id: Optional[str] = None, status: Optional[str] = None, date: Optional[str] = None):
    query = {}
    if salon_id:
        query["salon_id"] = salon_id
    if status:
        query["status"] = status
    if date:
        query["booking_date"] = date
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return bookings

@api_router.patch("/admin/booking/{booking_id}/status")
async def update_booking_status(booking_id: str, status: str):
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"Booking status updated to {status}"}

@api_router.post("/admin/validate-phone")
async def validate_admin_phone(request: Request):
    data = await request.json()
    phone = data.get("phone", "")
    
    # Admin phone number from environment or hardcoded
    ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "+916205777957")
    
    # Normalize phone number
    if phone.startswith("+91"):
        normalized_phone = phone
    elif phone.startswith("91"):
        normalized_phone = f"+{phone}"
    else:
        normalized_phone = f"+91{phone}"
    
    if normalized_phone == ADMIN_PHONE:
        return {"authorized": True, "message": "Authorized admin"}
    else:
        return {"authorized": False, "message": "Unauthorized access. This panel is restricted."}

# ==================== COMMISSION SYSTEM ENDPOINTS ====================

@api_router.get("/commission/salon/{salon_id}")
async def get_salon_commission_summary(salon_id: str):
    """Get commission summary for a specific salon"""
    salon = await db.salons.find_one({"salon_id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Get all bookings for the salon
    all_bookings = await db.bookings.find({"salon_id": salon_id}, {"_id": 0}).to_list(10000)
    
    # Calculate online commission (already collected)
    online_bookings = [b for b in all_bookings if b.get("payment_method") == "online" and b.get("payment_status") == "paid"]
    online_commission = sum(b.get("commission_amount", 0) for b in online_bookings)
    
    # Calculate offline commission pending
    offline_bookings = [b for b in all_bookings if b.get("payment_method") == "pay_at_salon"]
    offline_commission_pending = sum(b.get("commission_amount", 0) for b in offline_bookings if b.get("commission_status") != "paid_to_platform")
    offline_commission_paid = sum(b.get("commission_amount", 0) for b in offline_bookings if b.get("commission_status") == "paid_to_platform")
    
    # Get current month ledger
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    current_ledger = await db.commission_ledger.find_one(
        {"salon_id": salon_id, "billing_month": current_month},
        {"_id": 0}
    )
    
    # Get all ledgers for the salon
    all_ledgers = await db.commission_ledger.find(
        {"salon_id": salon_id},
        {"_id": 0}
    ).sort("billing_month", -1).to_list(24)
    
    # Calculate due date countdown
    due_date_countdown = None
    if current_ledger and current_ledger.get("due_date"):
        due_date = datetime.fromisoformat(current_ledger["due_date"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        days_left = (due_date - now).days
        due_date_countdown = max(0, days_left)
    
    return {
        "salon_id": salon_id,
        "salon_name": salon.get("salon_name"),
        "total_bookings": len(all_bookings),
        "online_bookings": len(online_bookings),
        "offline_bookings": len(offline_bookings),
        "commission_summary": {
            "online_collected": round(online_commission, 2),
            "offline_pending": round(offline_commission_pending, 2),
            "offline_paid": round(offline_commission_paid, 2),
            "total_commission": round(online_commission + offline_commission_pending + offline_commission_paid, 2)
        },
        "current_month_ledger": current_ledger,
        "due_date_countdown": due_date_countdown,
        "all_ledgers": all_ledgers
    }

@api_router.post("/commission/generate-payment-link/{salon_id}")
async def generate_commission_payment_link(salon_id: str, billing_month: Optional[str] = None):
    """Generate Razorpay payment link for pending offline commission"""
    if not billing_month:
        billing_month = datetime.now(timezone.utc).strftime("%Y-%m")
    
    ledger = await db.commission_ledger.find_one({
        "salon_id": salon_id,
        "billing_month": billing_month,
        "status": {"$in": ["pending", "warning", "overdue"]}
    })
    
    if not ledger:
        raise HTTPException(status_code=404, detail="No pending commission found for this month")
    
    if ledger.get("total_pending", 0) <= 0:
        raise HTTPException(status_code=400, detail="No pending commission to pay")
    
    salon = await db.salons.find_one({"salon_id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    try:
        amount = int(ledger["total_pending"] * 100)  # Convert to paise
        
        order_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": f"comm_{salon_id}_{billing_month}",
            "payment_capture": 1,
            "notes": {
                "type": "commission_payment",
                "salon_id": salon_id,
                "billing_month": billing_month
            }
        }
        
        razorpay_order = razorpay_client.order.create(data=order_data)
        
        # Update ledger with payment link info
        await db.commission_ledger.update_one(
            {"salon_id": salon_id, "billing_month": billing_month},
            {"$set": {
                "razorpay_order_id": razorpay_order["id"],
                "payment_link": f"pay_{razorpay_order['id']}",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "order_id": razorpay_order["id"],
            "amount": ledger["total_pending"],
            "currency": "INR",
            "salon_name": salon.get("salon_name"),
            "billing_month": billing_month,
            "razorpay_key": os.environ.get("RAZORPAY_KEY_ID")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create payment link: {str(e)}")

@api_router.post("/commission/verify-payment")
async def verify_commission_payment(request: Request):
    """Verify commission payment via Razorpay webhook or direct verification"""
    data = await request.json()
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_signature = data.get("razorpay_signature")
    
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature
        })
        
        # Find the ledger entry
        ledger = await db.commission_ledger.find_one({"razorpay_order_id": razorpay_order_id})
        
        if ledger:
            now = datetime.now(timezone.utc)
            
            # Update ledger status to paid
            await db.commission_ledger.update_one(
                {"razorpay_order_id": razorpay_order_id},
                {"$set": {
                    "status": "paid",
                    "total_paid": ledger["total_pending"],
                    "total_pending": 0,
                    "razorpay_payment_id": razorpay_payment_id,
                    "paid_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }}
            )
            
            # Update all related bookings
            for booking_id in ledger.get("booking_ids", []):
                await db.bookings.update_one(
                    {"booking_id": booking_id},
                    {"$set": {"commission_status": "paid_to_platform"}}
                )
            
            # Record commission payment
            await db.commission_records.insert_one({
                "record_id": str(uuid.uuid4()),
                "ledger_id": ledger["ledger_id"],
                "salon_id": ledger["salon_id"],
                "billing_month": ledger["billing_month"],
                "payment_type": "offline_settlement",
                "amount": ledger["total_pending"],
                "razorpay_payment_id": razorpay_payment_id,
                "status": "paid",
                "paid_at": now.isoformat()
            })
            
            return {"message": "Commission payment verified and recorded", "status": "paid"}
        else:
            raise HTTPException(status_code=404, detail="Ledger entry not found")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {str(e)}")

@api_router.post("/commission/webhook")
async def commission_webhook(request: Request):
    """Razorpay webhook for commission payments"""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
    
    try:
        if webhook_secret:
            razorpay_client.utility.verify_webhook_signature(body.decode(), signature, webhook_secret)
        
        data = await request.json()
        event = data.get("event")
        
        if event == "payment.captured":
            payload = data.get("payload", {}).get("payment", {}).get("entity", {})
            order_id = payload.get("order_id")
            payment_id = payload.get("id")
            
            # Check if this is a commission payment
            ledger = await db.commission_ledger.find_one({"razorpay_order_id": order_id})
            
            if ledger:
                now = datetime.now(timezone.utc)
                
                await db.commission_ledger.update_one(
                    {"razorpay_order_id": order_id},
                    {"$set": {
                        "status": "paid",
                        "total_paid": ledger["total_pending"],
                        "total_pending": 0,
                        "razorpay_payment_id": payment_id,
                        "paid_at": now.isoformat(),
                        "updated_at": now.isoformat()
                    }}
                )
                
                # Update bookings
                for booking_id in ledger.get("booking_ids", []):
                    await db.bookings.update_one(
                        {"booking_id": booking_id},
                        {"$set": {"commission_status": "paid_to_platform"}}
                    )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

@api_router.post("/commission/check-overdue")
async def check_overdue_commissions():
    """Check and update overdue commission status - to be called periodically"""
    now = datetime.now(timezone.utc)
    
    # Find all pending ledgers
    pending_ledgers = await db.commission_ledger.find({
        "status": {"$in": ["pending", "warning"]}
    }).to_list(1000)
    
    updated_count = 0
    blocked_salons = []
    
    for ledger in pending_ledgers:
        due_date = datetime.fromisoformat(ledger["due_date"].replace("Z", "+00:00"))
        days_overdue = (now - due_date).days
        
        new_status = ledger["status"]
        
        if days_overdue >= 15:
            new_status = "overdue"
            # Block the salon
            await db.salons.update_one(
                {"salon_id": ledger["salon_id"]},
                {"$set": {"status": "blocked", "blocked_reason": "commission_overdue"}}
            )
            blocked_salons.append(ledger["salon_id"])
        elif days_overdue >= 5:
            new_status = "warning"
        
        if new_status != ledger["status"]:
            await db.commission_ledger.update_one(
                {"ledger_id": ledger["ledger_id"]},
                {"$set": {"status": new_status, "updated_at": now.isoformat()}}
            )
            updated_count += 1
    
    return {
        "checked": len(pending_ledgers),
        "updated": updated_count,
        "blocked_salons": blocked_salons
    }

@api_router.get("/admin/commission/summary")
async def get_admin_commission_summary():
    """Get overall commission summary for admin dashboard"""
    # Get all commission records
    online_records = await db.commission_records.find({"payment_type": "online"}).to_list(10000)
    offline_paid = await db.commission_records.find({"payment_type": "offline_settlement", "status": "paid"}).to_list(10000)
    
    # Get all pending ledgers
    pending_ledgers = await db.commission_ledger.find({"status": {"$in": ["pending", "warning"]}}, {"_id": 0}).to_list(1000)
    overdue_ledgers = await db.commission_ledger.find({"status": "overdue"}, {"_id": 0}).to_list(1000)
    
    online_collected = sum(r.get("commission_amount", 0) for r in online_records)
    offline_collected = sum(r.get("amount", 0) for r in offline_paid)
    offline_pending = sum(l.get("total_pending", 0) for l in pending_ledgers)
    offline_overdue = sum(l.get("total_pending", 0) for l in overdue_ledgers)
    
    # Get overdue salons
    overdue_salon_ids = list(set(l["salon_id"] for l in overdue_ledgers))
    overdue_salons = await db.salons.find(
        {"salon_id": {"$in": overdue_salon_ids}},
        {"_id": 0, "salon_id": 1, "salon_name": 1, "phone": 1, "status": 1}
    ).to_list(100)
    
    return {
        "commission_collected": {
            "online": round(online_collected, 2),
            "offline_paid": round(offline_collected, 2),
            "total_collected": round(online_collected + offline_collected, 2)
        },
        "commission_pending": {
            "offline_pending": round(offline_pending, 2),
            "offline_overdue": round(offline_overdue, 2),
            "total_pending": round(offline_pending + offline_overdue, 2)
        },
        "total_commission": round(online_collected + offline_collected + offline_pending + offline_overdue, 2),
        "overdue_salons": overdue_salons,
        "pending_ledgers": pending_ledgers,
        "overdue_ledgers": overdue_ledgers
    }

@api_router.post("/admin/salon/{salon_id}/block")
async def block_salon(salon_id: str, reason: Optional[str] = "manual"):
    """Block a salon partner"""
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "status": "blocked",
            "blocked_reason": reason,
            "blocked_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Salon {salon_id} has been blocked", "reason": reason}

@api_router.post("/admin/salon/{salon_id}/unblock")
async def unblock_salon(salon_id: str):
    """Unblock a salon partner"""
    salon = await db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "status": "approved",
            "blocked_reason": None,
            "blocked_at": None,
            "unblocked_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Salon {salon_id} has been unblocked"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],


# ==================== CUSTOMER FAVORITES ====================

@api_router.get("/customer/{firebase_uid}/favorites")
async def get_customer_favorites(firebase_uid: str):
    """Get customer's favorite salons"""
    favorites = await db.favorites.find({"firebase_uid": firebase_uid}, {"_id": 0}).to_list(100)
    salon_ids = [f.get("salon_id") for f in favorites if f.get("salon_id")]
    
    if not salon_ids:
        return []
    
    salons = await db.salons.find({"salon_id": {"$in": salon_ids}}, {"_id": 0}).to_list(100)
    return salons

@api_router.post("/customer/{firebase_uid}/favorites/{salon_id}")
async def toggle_favorite(firebase_uid: str, salon_id: str):
    """Add or remove salon from favorites"""
    existing = await db.favorites.find_one({"firebase_uid": firebase_uid, "salon_id": salon_id})
    
    if existing:
        await db.favorites.delete_one({"firebase_uid": firebase_uid, "salon_id": salon_id})
        return {"favorited": False, "message": "Removed from favorites"}
    else:
        await db.favorites.insert_one({
            "firebase_uid": firebase_uid,
            "salon_id": salon_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"favorited": True, "message": "Added to favorites"}

# ==================== USER TRACKING FOR ADMIN ====================

@api_router.post("/user/track-login")
async def track_user_login(data: dict):
    """Track user login for analytics"""
    phone = data.get("phone")
    name = data.get("name", "")
    method = data.get("method", "otp")
    firebase_uid = data.get("firebase_uid")
    
    if not phone:
        return {"message": "Phone required"}
    
    existing = await db.users.find_one({"phone": phone})
    
    if existing:
        # Update last login
        await db.users.update_one(
            {"phone": phone},
            {"$set": {
                "last_login_at": datetime.now(timezone.utc).isoformat(),
                "login_count": existing.get("login_count", 0) + 1,
                "name": name or existing.get("name", "")
            }}
        )
    else:
        # Create new user
        await db.users.insert_one({
            "user_id": str(uuid.uuid4()),
            "phone": phone,
            "name": name,
            "firebase_uid": firebase_uid,
            "login_method": method,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login_at": datetime.now(timezone.utc).isoformat(),
            "login_count": 1,
            "loyalty_points": 0
        })
    
    return {"message": "Login tracked"}

@api_router.get("/admin/users/analytics")
async def get_user_analytics():
    """Get user analytics for admin dashboard"""
    total_users = await db.users.count_documents({})
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    today_logins = await db.users.count_documents({
        "last_login_at": {"$gte": today.isoformat()}
    })
    
    week_logins = await db.users.count_documents({
        "last_login_at": {"$gte": week_ago.isoformat()}
    })
    
    month_logins = await db.users.count_documents({
        "last_login_at": {"$gte": month_ago.isoformat()}
    })
    
    return {
        "total_users": total_users,
        "today_logins": today_logins,
        "week_logins": week_logins,
        "month_logins": month_logins
    }

@api_router.get("/admin/users/list")
async def get_users_list(limit: int = 50, skip: int = 0):
    """Get list of registered users"""
    users = await db.users.find({}, {"_id": 0}).sort("last_login_at", -1).skip(skip).limit(limit).to_list(limit)
    return users

# ==================== SALON STATUS ====================

@api_router.post("/salon/{salon_id}/status")
async def update_salon_status(salon_id: str, data: dict):
    """Update salon open/closed status"""
    status = data.get("status", "open")  # open, closed, fully_booked
    
    await db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {"current_status": status, "status_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Salon status updated to {status}"}

@api_router.get("/salon/{salon_id}/availability")
async def get_salon_availability(salon_id: str, date: str = None):
    """Check salon availability for a given date"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    salon = await db.salons.find_one({"salon_id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Get booked slots for the date
    bookings = await db.bookings.find({
        "salon_id": salon_id,
        "booking_date": date,
        "status": {"$in": ["pending", "confirmed", "accepted"]}
    }).to_list(100)
    
    booked_slots = [b.get("booking_time") for b in bookings]
    
    # Calculate total slots (assuming 30 min slots from 9 AM to 9 PM = 24 slots)
    total_slots = salon.get("total_daily_slots", 24)
    
    return {
        "salon_id": salon_id,
        "date": date,
        "current_status": salon.get("current_status", "open"),
        "opening_time": salon.get("opening_time", "09:00"),
        "closing_time": salon.get("closing_time", "21:00"),
        "total_slots": total_slots,
        "booked_slots": len(booked_slots),
        "available_slots": total_slots - len(booked_slots),
        "is_fully_booked": len(booked_slots) >= total_slots
    }


)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()