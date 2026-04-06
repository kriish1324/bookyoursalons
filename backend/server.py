from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import os
import httpx
import uuid

app = FastAPI(title="BookYourSalons API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "bookyoursalons")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Helper functions
def safe_num(val, default=0):
    try:
        return float(val) if val is not None else default
    except:
        return default

def generate_id():
    return str(uuid.uuid4())

def get_today_str():
    return datetime.now().strftime("%Y-%m-%d")

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == "_id":
            continue
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        elif isinstance(value, list):
            result[key] = [serialize_doc(v) if isinstance(v, dict) else v for v in value]
        else:
            result[key] = value
    return result

# ==================== ROOT ====================
@app.get("/api")
@app.get("/api/")
async def root():
    return {"message": "BookYourSalons API v2.0", "status": "operational"}

# ==================== AUTH ROUTES ====================
@app.post("/api/auth/track-login")
async def track_login(request: Request):
    data = await request.json()
    phone = data.get("phone")
    if not phone:
        raise HTTPException(400, "phone is required")
    
    now = datetime.now()
    existing = db.users.find_one({"phone": phone})
    
    if existing:
        db.users.update_one(
            {"phone": phone},
            {"$set": {
                "last_login_at": now,
                "login_method": data.get("login_method", "otp"),
                "name": data.get("name") or existing.get("name", ""),
                "firebase_uid": data.get("firebase_uid") or existing.get("firebase_uid", "")
            }, "$inc": {"login_count": 1}}
        )
    else:
        db.users.insert_one({
            "phone": phone,
            "name": data.get("name", ""),
            "firebase_uid": data.get("firebase_uid", ""),
            "role": "customer",
            "created_at": now,
            "last_login_at": now,
            "login_method": data.get("login_method", "otp"),
            "login_count": 1
        })
    
    return {"message": "Login tracked", "phone": phone}

# ==================== GEOCODE ROUTES ====================
@app.get("/api/geocode/reverse")
async def geocode_reverse(lat: str, lon: str):
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers={"User-Agent": "bookyoursalons/1.0"})
            return response.json()
    except:
        return {"display_name": "Location selected", "address": {"city": "Unknown"}}

@app.get("/api/geocode/search")
async def geocode_search(q: str):
    try:
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={q}&limit=5"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers={"User-Agent": "bookyoursalons/1.0"})
            return response.json()
    except:
        return []

# ==================== SALON ROUTES ====================
@app.post("/api/salon/register")
async def register_salon(request: Request):
    data = await request.json()
    now = datetime.now()
    trial_end = now + timedelta(days=30)
    salon_id = generate_id()
    
    salon_data = {
        "salon_id": salon_id,
        "salon_name": data.get("salon_name", ""),
        "owner_name": data.get("owner_name", ""),
        "phone": data.get("phone", ""),
        "address": data.get("address", ""),
        "area": data.get("area", ""),
        "latitude": safe_num(data.get("latitude")),
        "longitude": safe_num(data.get("longitude")),
        "location": {
            "type": "Point",
            "coordinates": [safe_num(data.get("longitude")), safe_num(data.get("latitude"))]
        },
        "staff_count": int(data.get("staff_count", 1)),
        "avg_service_time": int(data.get("avg_service_time", 30)),
        "services": data.get("services", []),
        "secondary_phone": data.get("secondary_phone", ""),
        "business_type": data.get("business_type", "salon"),
        "firebase_uid": data.get("firebase_uid", ""),
        "opening_time": data.get("opening_time", "09:00"),
        "closing_time": data.get("closing_time", "20:00"),
        "status": "pending",
        "current_status": "open",
        "rating": 4.0,
        "review_count": 0,
        "total_bookings": 0,
        "total_revenue": 0,
        "createdAt": now,
        "trialStartDate": now,
        "trialEndDate": trial_end,
        "subscriptionStatus": "trial",
        "subscription": {
            "plan": "free_trial",
            "plan_name": "1 Month Free Trial",
            "amount": 0,
            "days": 30,
            "payment_status": "free",
            "trial_start_date": now,
            "trial_end_date": trial_end,
            "expires_at": trial_end
        }
    }
    
    db.salons.insert_one(salon_data)
    return {"message": "Salon registered successfully. Your 1-month free trial starts after admin approval.", "salon_id": salon_id}

@app.get("/api/salon/user/{uid}")
async def get_salon_by_user(uid: str):
    salon = db.salons.find_one({"firebase_uid": uid}, {"_id": 0})
    if not salon:
        raise HTTPException(404, "Salon not found")
    return serialize_doc(salon)

@app.get("/api/salon/status/{phone}")
async def get_salon_status(phone: str):
    salon = db.salons.find_one({"phone": phone}, {"_id": 0, "status": 1, "salon_id": 1, "salon_name": 1})
    if not salon:
        return {"status": "not_found"}
    return serialize_doc(salon)

@app.get("/api/salon/{salon_id}/dashboard-analytics")
async def get_salon_dashboard_analytics(salon_id: str):
    bookings = list(db.bookings.find({"salon_id": salon_id}, {"_id": 0}))
    today = get_today_str()
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    today_bookings = [b for b in bookings if b.get("booking_date") == today]
    week_bookings = [b for b in bookings if b.get("booking_date", "") >= week_ago]
    month_bookings = [b for b in bookings if b.get("booking_date", "") >= month_ago]
    
    today_revenue = sum(safe_num(b.get("service_price")) for b in today_bookings if b.get("status") == "completed")
    week_revenue = sum(safe_num(b.get("service_price")) for b in week_bookings if b.get("status") == "completed")
    month_revenue = sum(safe_num(b.get("service_price")) for b in month_bookings if b.get("status") == "completed")
    
    customer_phones = set(b.get("customer_phone") for b in bookings if b.get("customer_phone"))
    repeat_customers = {}
    for b in bookings:
        phone = b.get("customer_phone")
        if phone:
            repeat_customers[phone] = repeat_customers.get(phone, 0) + 1
    repeat_count = len([c for c in repeat_customers.values() if c > 1])
    
    service_counts = {}
    for b in bookings:
        svc = b.get("service_name")
        if svc:
            service_counts[svc] = service_counts.get(svc, 0) + 1
    popular_services = sorted(service_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    hour_counts = {}
    for b in bookings:
        slot = b.get("slot_time", "")
        if slot:
            hour = slot.split(":")[0] + ":00"
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
    peak_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "today": {"bookings": len(today_bookings), "revenue": today_revenue},
        "week": {"bookings": len(week_bookings), "revenue": week_revenue},
        "month": {"bookings": len(month_bookings), "revenue": month_revenue},
        "customers": {
            "total": len(customer_phones),
            "repeat": repeat_count,
            "repeat_rate": round((repeat_count / len(customer_phones)) * 100) if customer_phones else 0
        },
        "popular_services": [{"name": s[0], "count": s[1]} for s in popular_services],
        "peak_hours": [{"hour": h[0], "count": h[1]} for h in peak_hours]
    }

@app.patch("/api/salon/{salon_id}/toggle-status")
async def toggle_salon_status(salon_id: str, request: Request):
    data = await request.json()
    db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "current_status": "open" if data.get("is_open") else "closed",
            "auto_close_enabled": data.get("auto_close_enabled", True)
        }}
    )
    return {"message": "Status updated"}

@app.patch("/api/salon/{salon_id}/hours")
async def update_salon_hours(salon_id: str, request: Request):
    data = await request.json()
    db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "opening_time": data.get("opening_time", "09:00"),
            "closing_time": data.get("closing_time", "20:00")
        }}
    )
    return {"message": "Hours updated"}

@app.patch("/api/salon/{salon_id}/location")
async def update_salon_location(salon_id: str, request: Request):
    data = await request.json()
    lat = safe_num(data.get("latitude"))
    lng = safe_num(data.get("longitude"))
    db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "latitude": lat,
            "longitude": lng,
            "location": {"type": "Point", "coordinates": [lng, lat]}
        }}
    )
    return {"message": "Location updated"}

@app.post("/api/salon/{salon_id}/bank-details")
async def save_bank_details(salon_id: str, request: Request):
    data = await request.json()
    db.salons.update_one({"salon_id": salon_id}, {"$set": {"bank_details": data}})
    return {"message": "Bank details saved"}

@app.post("/api/salon/{salon_id}/upload-photo")
async def upload_salon_photo(salon_id: str, request: Request):
    data = await request.json()
    db.salons.update_one({"salon_id": salon_id}, {"$set": {"photo_url": data.get("photo_url")}})
    return {"message": "Photo uploaded"}

@app.post("/api/salon/{salon_id}/gallery")
async def upload_gallery(salon_id: str, request: Request):
    data = await request.json()
    photos = data.get("photos", [])
    gallery_items = [{"id": generate_id(), "url": url, "uploaded_at": datetime.now()} for url in photos]
    db.salons.update_one(
        {"salon_id": salon_id},
        {"$push": {"photo_gallery": {"$each": gallery_items}}}
    )
    return {"message": "Gallery updated"}

@app.post("/api/salon/{salon_id}/check-auto-close")
async def check_auto_close(salon_id: str):
    salon = db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(404, "Salon not found")
    
    today = get_today_str()
    today_bookings = db.bookings.count_documents({
        "salon_id": salon_id,
        "booking_date": today,
        "status": "confirmed"
    })
    
    max_slots = int(salon.get("staff_count", 1)) * 12
    if today_bookings >= max_slots and salon.get("auto_close_enabled", True):
        db.salons.update_one({"salon_id": salon_id}, {"$set": {"current_status": "fully_booked"}})
        return {"auto_closed": True, "reason": "fully_booked"}
    
    return {"auto_closed": False}

@app.get("/api/salon/{salon_id}/slots")
async def get_salon_slots(salon_id: str, date: str = None):
    target_date = date or get_today_str()
    salon = db.salons.find_one({"salon_id": salon_id})
    if not salon:
        raise HTTPException(404, "Salon not found")
    
    open_time = salon.get("opening_time", "09:00")
    close_time = salon.get("closing_time", "20:00")
    avg_time = int(salon.get("avg_service_time", 30))
    staff_count = int(salon.get("staff_count", 1))
    
    booked = db.bookings.find({
        "salon_id": salon_id,
        "booking_date": target_date,
        "status": {"$in": ["confirmed", "pending"]}
    })
    booked_slots = {}
    for b in booked:
        slot = b.get("slot_time")
        booked_slots[slot] = booked_slots.get(slot, 0) + 1
    
    locked = db.slot_locks.find({
        "salon_id": salon_id,
        "date": target_date,
        "expires_at": {"$gt": datetime.now()}
    })
    locked_slots = {}
    for l in locked:
        slot = l.get("slot_time")
        locked_slots[slot] = locked_slots.get(slot, 0) + 1
    
    slots = []
    open_h, open_m = map(int, open_time.split(":"))
    close_h, close_m = map(int, close_time.split(":"))
    current_minutes = open_h * 60 + open_m
    close_minutes = close_h * 60 + close_m
    
    while current_minutes < close_minutes:
        hour = current_minutes // 60
        minute = current_minutes % 60
        time_str = f"{hour:02d}:{minute:02d}"
        
        booked_count = booked_slots.get(time_str, 0)
        locked_count = locked_slots.get(time_str, 0)
        available = max(0, staff_count - booked_count - locked_count)
        
        slots.append({
            "time": time_str,
            "available": available,
            "total": staff_count,
            "booked": booked_count
        })
        
        current_minutes += avg_time
    
    return {
        "available_slots": slots,
        "date": target_date,
        "salon_id": salon_id
    }

@app.get("/api/salon/{salon_id}/reviews")
async def get_salon_reviews(salon_id: str):
    reviews = list(db.reviews.find({"salon_id": salon_id}, {"_id": 0}).sort("created_at", -1).limit(50))
    return [serialize_doc(r) for r in reviews]

# ==================== SALONS (PLURAL) ROUTES ====================
@app.get("/api/salons/nearby")
async def get_nearby_salons(lat: float, lng: float, radius: float = 10):
    salons = list(db.salons.find({"status": "approved"}, {"_id": 0}))
    result = []
    
    from math import radians, sin, cos, sqrt, atan2
    
    for salon in salons:
        s_lat = safe_num(salon.get("latitude"))
        s_lng = safe_num(salon.get("longitude"))
        
        R = 6371
        d_lat = radians(s_lat - lat)
        d_lon = radians(s_lng - lng)
        a = sin(d_lat/2)**2 + cos(radians(lat)) * cos(radians(s_lat)) * sin(d_lon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c
        
        if distance <= radius:
            salon_data = serialize_doc(salon)
            salon_data["distance"] = f"{distance:.2f}"
            salon_data["rating"] = safe_num(salon.get("rating"), 4.0)
            salon_data["review_count"] = int(salon.get("review_count", 0))
            result.append(salon_data)
    
    result.sort(key=lambda x: float(x["distance"]))
    return result

@app.get("/api/salons/trending")
async def get_trending_salons():
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    bookings = list(db.bookings.find({"booking_date": {"$gte": week_ago}}, {"salon_id": 1}))
    
    salon_bookings = {}
    for b in bookings:
        sid = b.get("salon_id")
        salon_bookings[sid] = salon_bookings.get(sid, 0) + 1
    
    top_ids = sorted(salon_bookings.keys(), key=lambda x: salon_bookings[x], reverse=True)[:10]
    
    if not top_ids:
        salons = list(db.salons.find({"status": "approved"}, {"_id": 0}).limit(10))
        return [serialize_doc(s) for s in salons]
    
    result = []
    for sid in top_ids:
        salon = db.salons.find_one({"salon_id": sid, "status": "approved"}, {"_id": 0})
        if salon:
            salon_data = serialize_doc(salon)
            salon_data["trending_score"] = salon_bookings[sid]
            result.append(salon_data)
    
    return result

@app.get("/api/salons/recommended")
async def get_recommended_salons(customer_phone: str = None):
    visited = set()
    if customer_phone:
        bookings = list(db.bookings.find({"customer_phone": customer_phone}, {"salon_id": 1}))
        visited = set(b.get("salon_id") for b in bookings)
    
    salons = list(db.salons.find({"status": "approved"}, {"_id": 0}).limit(20))
    result = []
    for s in salons:
        salon_data = serialize_doc(s)
        salon_data["visited"] = s.get("salon_id") in visited
        salon_data["rating"] = safe_num(s.get("rating"), 4.0)
        result.append(salon_data)
    
    result.sort(key=lambda x: (not x["visited"], -x["rating"]))
    return result[:10]

# ==================== SEARCH ROUTES ====================
@app.get("/api/search")
async def search(q: str = "", lat: float = None, lng: float = None):
    salons = list(db.salons.find({"status": "approved"}, {"_id": 0}))
    search_term = q.lower()
    
    if search_term:
        salons = [s for s in salons if 
            search_term in (s.get("salon_name", "")).lower() or
            search_term in (s.get("area", "")).lower() or
            any(search_term in (svc.get("name", "")).lower() for svc in s.get("services", []))
        ]
    
    result = [serialize_doc(s) for s in salons]
    
    if lat and lng:
        from math import radians, sin, cos, sqrt, atan2
        for salon in result:
            s_lat = safe_num(salon.get("latitude"))
            s_lng = safe_num(salon.get("longitude"))
            R = 6371
            d_lat = radians(s_lat - lat)
            d_lon = radians(s_lng - lng)
            a = sin(d_lat/2)**2 + cos(radians(lat)) * cos(radians(s_lat)) * sin(d_lon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance = R * c
            salon["distance"] = f"{distance:.2f}"
        result.sort(key=lambda x: float(x.get("distance", 999)))
    
    return result[:20]

# ==================== BOOKING ROUTES ====================
@app.post("/api/booking/create")
async def create_booking(request: Request):
    data = await request.json()
    now = datetime.now()
    booking_id = generate_id()
    approval_expires = now + timedelta(minutes=15)
    
    salon = db.salons.find_one({"salon_id": data.get("salon_id")})
    staff_count = int(salon.get("staff_count", 1)) if salon else 1
    
    existing = db.bookings.count_documents({
        "salon_id": data.get("salon_id"),
        "booking_date": data.get("booking_date"),
        "slot_time": data.get("slot_time"),
        "status": {"$in": ["confirmed", "pending"]}
    })
    
    if existing >= staff_count:
        raise HTTPException(400, "Slot is fully booked")
    
    booking_data = {
        "booking_id": booking_id,
        "salon_id": data.get("salon_id"),
        "salon_name": data.get("salon_name", ""),
        "customer_name": data.get("customer_name", ""),
        "customer_phone": data.get("customer_phone", ""),
        "service_name": data.get("service_name", ""),
        "service_price": safe_num(data.get("service_price")),
        "booking_date": data.get("booking_date"),
        "slot_time": data.get("slot_time"),
        "status": "pending",
        "payment_method": data.get("payment_method", "pay_at_salon"),
        "payment_status": "pending" if data.get("payment_method") == "online" else "pending_at_salon",
        "created_at": now,
        "approval_expires_at": approval_expires
    }
    
    db.bookings.insert_one(booking_data)
    
    db.slot_locks.delete_many({
        "salon_id": data.get("salon_id"),
        "date": data.get("booking_date"),
        "slot_time": data.get("slot_time"),
        "customer_phone": data.get("customer_phone")
    })
    
    return {"message": "Booking created. Waiting for salon approval.", "booking_id": booking_id}

@app.post("/api/booking/check-spam")
async def check_spam(request: Request):
    data = await request.json()
    phone = data.get("customer_phone")
    five_minutes_ago = datetime.now() - timedelta(minutes=5)
    
    recent = db.bookings.count_documents({
        "customer_phone": phone,
        "created_at": {"$gte": five_minutes_ago}
    })
    
    is_spam = recent >= 3
    return {
        "is_spam": is_spam,
        "recent_bookings": recent,
        "message": "Too many bookings. Please wait 5 minutes." if is_spam else "OK"
    }

@app.post("/api/booking/{booking_id}/approve")
async def approve_booking(booking_id: str):
    booking = db.bookings.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")
    
    if booking.get("status") != "pending":
        raise HTTPException(400, f"Booking already {booking.get('status')}")
    
    expires = booking.get("approval_expires_at")
    if expires and expires < datetime.now():
        db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "expired"}})
        raise HTTPException(400, "Booking approval window expired")
    
    db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "confirmed", "confirmed_at": datetime.now()}}
    )
    
    db.salons.update_one(
        {"salon_id": booking.get("salon_id")},
        {"$inc": {"total_bookings": 1}}
    )
    
    return {"message": "Booking confirmed"}

@app.post("/api/booking/{booking_id}/reject")
async def reject_booking(booking_id: str, reason: str = "Salon unavailable"):
    db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "rejected", "rejection_reason": reason, "rejected_at": datetime.now()}}
    )
    return {"message": "Booking rejected"}

@app.patch("/api/booking/{booking_id}/cancel")
async def cancel_booking(booking_id: str):
    db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now()}}
    )
    return {"message": "Booking cancelled"}

@app.get("/api/bookings/salon/{salon_id}/pending")
async def get_pending_bookings(salon_id: str):
    bookings = list(db.bookings.find(
        {"salon_id": salon_id, "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1))
    return [serialize_doc(b) for b in bookings]

@app.get("/api/bookings/salon/{salon_id}")
async def get_salon_bookings(salon_id: str):
    bookings = list(db.bookings.find(
        {"salon_id": salon_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100))
    return [serialize_doc(b) for b in bookings]

@app.get("/api/bookings/customer/{phone}")
async def get_customer_bookings(phone: str):
    bookings = list(db.bookings.find(
        {"customer_phone": phone},
        {"_id": 0}
    ).sort("created_at", -1).limit(50))
    return [serialize_doc(b) for b in bookings]

@app.get("/api/bookings/upcoming-reminders/{phone}")
async def get_upcoming_reminders(phone: str):
    today = get_today_str()
    now = datetime.now()
    later = now + timedelta(hours=1)
    current_time = now.strftime("%H:%M")
    later_time = later.strftime("%H:%M")
    
    bookings = list(db.bookings.find({
        "customer_phone": phone,
        "booking_date": today,
        "status": "confirmed"
    }, {"_id": 0}))
    
    upcoming = [b for b in bookings if current_time <= b.get("slot_time", "") <= later_time]
    return [serialize_doc(b) for b in upcoming]

# ==================== SLOT ROUTES ====================
@app.post("/api/slot/lock")
async def lock_slot(request: Request):
    data = await request.json()
    salon_id = data.get("salon_id")
    slot_time = data.get("slot_time")
    target_date = data.get("date") or data.get("booking_date")  # Support both field names
    customer_phone = data.get("customer_phone", "")
    
    if not salon_id or not target_date or not slot_time:
        return {"locked": False, "message": "salon_id, date, and slot_time are required"}
    
    # Check if slot is already booked
    salon = db.salons.find_one({"salon_id": salon_id})
    staff_count = int(salon.get("staff_count", 1)) if salon else 1
    
    existing_bookings = db.bookings.count_documents({
        "salon_id": salon_id,
        "booking_date": target_date,
        "slot_time": slot_time,
        "status": {"$in": ["confirmed", "pending"]}
    })
    
    existing_locks = db.slot_locks.count_documents({
        "salon_id": salon_id,
        "date": target_date,
        "slot_time": slot_time,
        "expires_at": {"$gt": datetime.now()}
    })
    
    total_occupied = existing_bookings + existing_locks
    
    if total_occupied >= staff_count:
        return {"locked": False, "message": "Slot is no longer available"}
    
    lock_id = generate_id()
    expires = datetime.now() + timedelta(minutes=5)
    
    db.slot_locks.insert_one({
        "lock_id": lock_id,
        "salon_id": salon_id,
        "date": target_date,
        "slot_time": slot_time,
        "customer_phone": customer_phone,
        "created_at": datetime.now(),
        "expires_at": expires
    })
    
    return {"locked": True, "message": "Slot locked for 5 minutes", "lock_id": lock_id, "expires_at": expires.isoformat()}

# ==================== REVIEW ROUTES ====================
@app.post("/api/review/create")
async def create_review(request: Request):
    data = await request.json()
    now = datetime.now()
    
    existing = db.reviews.find_one({
        "salon_id": data.get("salon_id"),
        "customer_phone": data.get("customer_phone")
    })
    
    if existing:
        db.reviews.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "rating": safe_num(data.get("rating"), 5),
                "review_text": data.get("review_text", ""),
                "updated_at": now
            }}
        )
    else:
        db.reviews.insert_one({
            "review_id": generate_id(),
            "salon_id": data.get("salon_id"),
            "customer_phone": data.get("customer_phone"),
            "customer_name": data.get("customer_name", ""),
            "rating": safe_num(data.get("rating"), 5),
            "review_text": data.get("review_text", ""),
            "created_at": now
        })
    
    reviews = list(db.reviews.find({"salon_id": data.get("salon_id")}, {"rating": 1}))
    total_rating = sum(safe_num(r.get("rating")) for r in reviews)
    avg_rating = round(total_rating / len(reviews), 1) if reviews else 4.0
    
    db.salons.update_one(
        {"salon_id": data.get("salon_id")},
        {"$set": {"rating": avg_rating, "review_count": len(reviews)}}
    )
    
    return {"message": "Review saved"}

# ==================== CUSTOMER ROUTES ====================
@app.get("/api/customer/{phone}/service-reminders")
async def get_service_reminders(phone: str):
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    bookings = list(db.bookings.find({
        "customer_phone": phone,
        "status": "completed",
        "booking_date": {"$lt": thirty_days_ago}
    }, {"_id": 0}).sort("booking_date", -1).limit(5))
    
    reminders = []
    for b in bookings:
        days_since = (datetime.now() - datetime.strptime(b.get("booking_date"), "%Y-%m-%d")).days
        reminder = serialize_doc(b)
        reminder["days_since_visit"] = days_since
        reminder["reminder_message"] = f"It's been {days_since} days since your last {b.get('service_name')} at {b.get('salon_name')}"
        reminders.append(reminder)
    
    return reminders

@app.get("/api/customer/{uid}/favorites")
async def get_favorites(uid: str):
    user_fav = db.users_favorites.find_one({"uid": uid})
    if not user_fav:
        return []
    
    salon_ids = user_fav.get("salon_ids", [])
    salons = []
    for sid in salon_ids[:20]:
        salon = db.salons.find_one({"salon_id": sid}, {"_id": 0})
        if salon:
            salons.append(serialize_doc(salon))
    
    return salons

@app.post("/api/customer/{uid}/favorites/{salon_id}")
async def toggle_favorite(uid: str, salon_id: str):
    user_fav = db.users_favorites.find_one({"uid": uid})
    
    if not user_fav:
        db.users_favorites.insert_one({"uid": uid, "salon_ids": [salon_id]})
        return {"added": True}
    
    favorites = user_fav.get("salon_ids", [])
    
    if salon_id in favorites:
        db.users_favorites.update_one({"uid": uid}, {"$pull": {"salon_ids": salon_id}})
        return {"added": False}
    else:
        db.users_favorites.update_one({"uid": uid}, {"$push": {"salon_ids": salon_id}})
        return {"added": True}

# ==================== COMMISSION ROUTES ====================
@app.get("/api/commission/salon/{salon_id}")
async def get_salon_commission(salon_id: str):
    return {
        "commission_rate": 0,
        "current_month_ledger": None,
        "message": "0% commission - salon receives 100% revenue"
    }

# ==================== ADMIN ROUTES ====================
@app.get("/api/admin/analytics")
async def admin_analytics():
    total_salons = db.salons.count_documents({"status": "approved"})
    total_bookings = db.bookings.count_documents({})
    
    completed = list(db.bookings.find({"status": "completed"}, {"service_price": 1}))
    total_revenue = sum(safe_num(b.get("service_price")) for b in completed)
    
    return {
        "total_salons": total_salons,
        "total_bookings": total_bookings,
        "total_revenue": total_revenue,
        "platform_earnings": 0
    }

@app.get("/api/admin/analytics/detailed")
async def admin_analytics_detailed():
    today = get_today_str()
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    bookings = list(db.bookings.find({}, {"booking_date": 1}))
    
    today_bookings = len([b for b in bookings if b.get("booking_date") == today])
    week_bookings = len([b for b in bookings if b.get("booking_date", "") >= week_ago])
    month_bookings = len([b for b in bookings if b.get("booking_date", "") >= month_ago])
    total_customers = db.users.count_documents({})
    
    return {
        "today_bookings": today_bookings,
        "week_bookings": week_bookings,
        "month_bookings": month_bookings,
        "total_customers": total_customers
    }

@app.get("/api/admin/salons")
async def admin_get_salons():
    salons = list(db.salons.find({}, {"_id": 0}))
    return [serialize_doc(s) for s in salons]

@app.get("/api/admin/salons/analytics-summary")
async def admin_salons_summary():
    salons = list(db.salons.find({}, {"_id": 0}))
    bookings = list(db.bookings.find({}, {"salon_id": 1, "status": 1, "service_price": 1}))
    
    salon_stats = {}
    for s in salons:
        salon_stats[s.get("salon_id")] = serialize_doc(s)
        salon_stats[s.get("salon_id")]["total_bookings"] = 0
        salon_stats[s.get("salon_id")]["total_revenue"] = 0
    
    for b in bookings:
        sid = b.get("salon_id")
        if sid in salon_stats:
            salon_stats[sid]["total_bookings"] += 1
            if b.get("status") == "completed":
                salon_stats[sid]["total_revenue"] += safe_num(b.get("service_price"))
    
    return list(salon_stats.values())

@app.get("/api/admin/bookings/all")
async def admin_get_all_bookings():
    bookings = list(db.bookings.find({}, {"_id": 0}).sort("created_at", -1).limit(200))
    return [serialize_doc(b) for b in bookings]

@app.get("/api/admin/user-analytics")
async def admin_user_analytics():
    now = datetime.now()
    today = get_today_str()
    week_ago = now - timedelta(days=7)
    
    users = list(db.users.find({}, {"_id": 0}))
    salons = list(db.salons.find({}, {"_id": 0}))
    bookings = list(db.bookings.find({}, {"_id": 0}))
    
    total_customers = len([u for u in users if u.get("role", "customer") == "customer"])
    total_partners = len(salons)
    total_salons = len([s for s in salons if s.get("status") == "approved"])
    
    active_customers = len([u for u in users if 
        u.get("last_login_at") and 
        (u["last_login_at"] if isinstance(u["last_login_at"], datetime) else datetime.now()) >= week_ago
    ])
    
    new_this_week = len([u for u in users if 
        u.get("created_at") and 
        (u["created_at"] if isinstance(u["created_at"], datetime) else datetime.now()) >= week_ago
    ])
    
    new_today = len([u for u in users if 
        u.get("created_at") and 
        (u["created_at"].strftime("%Y-%m-%d") if isinstance(u["created_at"], datetime) else "") == today
    ])
    
    new_salons_week = len([s for s in salons if 
        s.get("createdAt") and 
        (s["createdAt"] if isinstance(s["createdAt"], datetime) else datetime.now()) >= week_ago
    ])
    
    completed = len([b for b in bookings if b.get("status") == "completed"])
    cancelled = len([b for b in bookings if b.get("status") == "cancelled"])
    completion_rate = round((completed / len(bookings)) * 100) if bookings else 0
    
    total_revenue = sum(safe_num(b.get("service_price")) for b in bookings if b.get("status") == "completed")
    
    salon_stats = {}
    for b in bookings:
        sid = b.get("salon_id")
        if sid not in salon_stats:
            salon_stats[sid] = {"bookings": 0, "revenue": 0}
        salon_stats[sid]["bookings"] += 1
        if b.get("status") == "completed":
            salon_stats[sid]["revenue"] += safe_num(b.get("service_price"))
    
    top_salons = []
    for s in salons:
        sid = s.get("salon_id")
        if sid in salon_stats:
            top_salons.append({
                "salon_id": sid,
                "salon_name": s.get("salon_name", ""),
                "bookings": salon_stats[sid]["bookings"],
                "revenue": salon_stats[sid]["revenue"]
            })
    top_salons.sort(key=lambda x: x["bookings"], reverse=True)
    
    return {
        "users": {
            "total_customers": total_customers,
            "total_partners": total_partners,
            "total_salons": total_salons,
            "active_customers": active_customers,
            "new_this_week": new_this_week,
            "new_today": new_today,
            "new_salons_week": new_salons_week
        },
        "bookings": {
            "total": len(bookings),
            "completed": completed,
            "cancelled": cancelled,
            "completion_rate": completion_rate
        },
        "revenue": {
            "total": total_revenue,
            "platform_earnings": 0
        },
        "top_salons": top_salons[:10]
    }

@app.get("/api/admin/login-stats")
async def admin_login_stats():
    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    users = list(db.users.find({}, {"last_login_at": 1}))
    
    total_users = len(users)
    today_logins = 0
    weekly_logins = 0
    monthly_logins = 0
    
    for u in users:
        last_login = u.get("last_login_at")
        if last_login:
            if isinstance(last_login, datetime):
                if last_login >= today_start:
                    today_logins += 1
                if last_login >= week_ago:
                    weekly_logins += 1
                if last_login >= month_ago:
                    monthly_logins += 1
    
    return {
        "total_users": total_users,
        "today_logins": today_logins,
        "weekly_logins": weekly_logins,
        "monthly_logins": monthly_logins
    }

@app.get("/api/admin/commission/summary")
async def admin_commission_summary():
    return {
        "commission_rate": 0,
        "total_collected": 0,
        "pending_collection": 0,
        "message": "0% platform commission - salons receive 100% revenue"
    }

@app.patch("/api/admin/salon/{salon_id}/approve")
async def admin_approve_salon(salon_id: str):
    now = datetime.now()
    trial_end = now + timedelta(days=30)
    
    db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "status": "approved",
            "approved_at": now,
            "trialStartDate": now,
            "trialEndDate": trial_end,
            "subscriptionStatus": "trial",
            "subscription.trial_start_date": now,
            "subscription.trial_end_date": trial_end,
            "subscription.expires_at": trial_end
        }}
    )
    
    return {"message": "Salon approved. 1-month free trial started."}

@app.post("/api/admin/salon/{salon_id}/block")
async def admin_block_salon(salon_id: str, reason: str = "manual"):
    db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "status": "blocked",
            "blocked_at": datetime.now(),
            "block_reason": reason
        }}
    )
    return {"message": "Salon blocked"}

@app.post("/api/admin/salon/{salon_id}/unblock")
async def admin_unblock_salon(salon_id: str):
    db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {"status": "approved"},
         "$unset": {"blocked_at": "", "block_reason": ""}}
    )
    return {"message": "Salon unblocked"}

@app.get("/api/admin/salon/{salon_id}/analytics")
async def admin_salon_analytics(salon_id: str):
    salon = db.salons.find_one({"salon_id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(404, "Salon not found")
    
    bookings = list(db.bookings.find({"salon_id": salon_id}, {"_id": 0}))
    
    customer_phones = set(b.get("customer_phone") for b in bookings if b.get("customer_phone"))
    total_revenue = sum(safe_num(b.get("service_price")) for b in bookings if b.get("status") == "completed")
    
    service_counts = {}
    for b in bookings:
        svc = b.get("service_name")
        if svc:
            service_counts[svc] = service_counts.get(svc, 0) + 1
    popular_services = [{"_id": k, "count": v} for k, v in sorted(service_counts.items(), key=lambda x: x[1], reverse=True)[:5]]
    
    time_counts = {}
    for b in bookings:
        slot = b.get("slot_time")
        if slot:
            time_counts[slot] = time_counts.get(slot, 0) + 1
    peak_time_slots = [{"_id": k, "count": v} for k, v in sorted(time_counts.items(), key=lambda x: x[1], reverse=True)[:5]]
    
    return {
        "salon": serialize_doc(salon),
        "total_bookings": len(bookings),
        "unique_customers": len(customer_phones),
        "total_revenue": total_revenue,
        "popular_services": popular_services,
        "peak_time_slots": peak_time_slots
    }

@app.patch("/api/admin/booking/{booking_id}/status")
async def admin_update_booking_status(booking_id: str, status: str):
    update_data = {"status": status}
    
    if status == "completed":
        update_data["completed_at"] = datetime.now()
        
        booking = db.bookings.find_one({"booking_id": booking_id})
        if booking:
            db.salons.update_one(
                {"salon_id": booking.get("salon_id")},
                {"$inc": {"total_revenue": safe_num(booking.get("service_price"))}}
            )
    
    db.bookings.update_one({"booking_id": booking_id}, {"$set": update_data})
    return {"message": f"Booking marked as {status}"}

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# ==================== FEATURE: 50% DISCOUNT FOR FIRST 100 SALONS ====================

@app.get("/api/salon/discount-eligibility")
async def check_discount_eligibility():
    """Check if salon is eligible for 50% discount (first 100 salons)"""
    total_salons = db.salons.count_documents({})
    
    is_eligible = total_salons < 100
    discount_percent = 50 if is_eligible else 0
    slots_remaining = max(0, 100 - total_salons)
    
    return {
        "eligible": is_eligible,
        "discountPercent": discount_percent,
        "totalSalons": total_salons,
        "slotsRemaining": slots_remaining,
        "message": f"You're eligible for 50% OFF! Only {slots_remaining} slots left for this offer." if is_eligible else "The first 100 salons offer has ended."
    }

@app.post("/api/salon/subscribe")
async def salon_subscribe(request: Request):
    """Process salon subscription with discount logic"""
    data = await request.json()
    salon_id = data.get("salon_id")
    plan = data.get("plan")
    original_price = data.get("original_price")
    payment_id = data.get("payment_id")
    
    if not salon_id or not plan or not original_price:
        raise HTTPException(400, "salon_id, plan, and original_price are required")
    
    # Check discount eligibility
    total_salons = db.salons.count_documents({})
    is_eligible = total_salons < 100
    discount_percent = 50 if is_eligible else 0
    
    # Calculate final price
    final_price = round(original_price * 0.5) if is_eligible else original_price
    
    now = datetime.now()
    plan_days = 90 if plan == '3_months' else 30
    expires_at = now + timedelta(days=plan_days)
    
    # Update salon subscription
    db.salons.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "subscriptionStatus": "active",
            "subscription": {
                "plan": plan,
                "plan_name": "3 Months Plan" if plan == '3_months' else "1 Month Plan",
                "original_price": original_price,
                "final_price": final_price,
                "discountApplied": is_eligible,
                "discountPercent": discount_percent,
                "payment_status": "paid",
                "payment_id": payment_id,
                "purchased_at": now,
                "expires_at": expires_at
            }
        }}
    )
    
    return {
        "message": "Subscription activated successfully",
        "subscription": {
            "plan": plan,
            "original_price": original_price,
            "final_price": final_price,
            "discountApplied": is_eligible,
            "discountPercent": discount_percent,
            "expires_at": expires_at.isoformat()
        }
    }

# ==================== FEATURE: SALON PROFILE EDIT ====================

@app.put("/api/salon/update-profile")
async def update_salon_profile(request: Request):
    """Update salon profile with partial update support"""
    data = await request.json()
    salon_id = data.get("salonId")
    firebase_uid = data.get("firebase_uid")
    
    if not salon_id:
        raise HTTPException(400, "salonId is required")
    
    # Verify salon exists
    existing_salon = db.salons.find_one({"salon_id": salon_id})
    if not existing_salon:
        raise HTTPException(404, "Salon not found")
    
    # Optional: Verify ownership
    if firebase_uid and existing_salon.get("firebase_uid") != firebase_uid:
        raise HTTPException(403, "Unauthorized: You don't own this salon")
    
    # Build partial update - only update provided fields
    update_data = {}
    
    if data.get("name") is not None:
        update_data["salon_name"] = data["name"]
    if data.get("address") is not None:
        update_data["address"] = data["address"]
    if data.get("area") is not None:
        update_data["area"] = data["area"]
    if data.get("phone") is not None:
        update_data["phone"] = data["phone"]
    if data.get("secondary_phone") is not None:
        update_data["secondary_phone"] = data["secondary_phone"]
    if data.get("services") is not None:
        update_data["services"] = data["services"]
    if data.get("image") is not None:
        update_data["photo_url"] = data["image"]
    if data.get("staff_count") is not None:
        update_data["staff_count"] = int(data["staff_count"])
    if data.get("avg_service_time") is not None:
        update_data["avg_service_time"] = int(data["avg_service_time"])
    if data.get("business_type") is not None:
        update_data["business_type"] = data["business_type"]
    
    # Add updated timestamp
    update_data["updated_at"] = datetime.now()
    
    # Perform partial update
    db.salons.update_one({"salon_id": salon_id}, {"$set": update_data})
    
    # Fetch and return updated salon
    updated_salon = db.salons.find_one({"salon_id": salon_id}, {"_id": 0})
    
    return {
        "message": "Profile updated successfully",
        "salon": serialize_doc(updated_salon)
    }


# ==================== FEATURE: CUSTOMER PROFILE EDIT ====================

@app.put("/api/user/update-profile")
async def update_user_profile(request: Request):
    """Update customer profile with partial update support"""
    data = await request.json()
    phone = data.get("phone")
    firebase_uid = data.get("firebase_uid")
    
    if not phone and not firebase_uid:
        raise HTTPException(400, "phone or firebase_uid is required")
    
    # Find user by phone or firebase_uid
    query = {}
    if phone:
        query["phone"] = phone
    elif firebase_uid:
        query["firebase_uid"] = firebase_uid
    
    existing_user = db.users.find_one(query)
    if not existing_user:
        # Create new user if doesn't exist
        new_user = {
            "phone": phone or "",
            "firebase_uid": firebase_uid or "",
            "name": data.get("name", ""),
            "address": data.get("address", ""),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        db.users.insert_one(new_user)
        return {"message": "Profile created successfully", "user": serialize_doc(new_user)}
    
    # Build partial update - only update provided fields
    update_data = {}
    
    if data.get("name") is not None:
        update_data["name"] = data["name"]
    if data.get("address") is not None:
        update_data["address"] = data["address"]
    if data.get("email") is not None:
        update_data["email"] = data["email"]
    if data.get("gender") is not None:
        update_data["gender"] = data["gender"]
    
    # Add updated timestamp
    update_data["updated_at"] = datetime.now()
    
    # Perform partial update
    db.users.update_one(query, {"$set": update_data})
    
    # Fetch and return updated user
    updated_user = db.users.find_one(query, {"_id": 0})
    
    return {
        "message": "Profile updated successfully",
        "user": serialize_doc(updated_user)
    }

@app.get("/api/user/profile/{phone}")
async def get_user_profile(phone: str):
    """Get customer profile by phone"""
    user = db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        return {"phone": phone, "name": "", "address": "", "email": ""}
    return serialize_doc(user)

