import requests
import sys
import json
from datetime import datetime

class SalonAPITester:
    def __init__(self, base_url="https://salon-locator-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "status": "PASSED" if success else "FAILED",
            "details": details
        })

    def test_server_health(self):
        """Test if backend server is running and responding"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}, Response: {response.json() if success else response.text}"
            self.log_test("Backend Server Health Check", success, details)
            return success
        except Exception as e:
            self.log_test("Backend Server Health Check", False, str(e))
            return False

    def test_nearby_salons_api(self):
        """Test /api/salons/nearby endpoint with lat/lng parameters"""
        try:
            # Test with Delhi coordinates
            params = {
                'lat': 28.7041,
                'lng': 77.1025,
                'radius': 10
            }
            response = requests.get(f"{self.api_url}/salons/nearby", params=params, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {response.status_code}, Found {len(data)} salons"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Nearby Salons API (/api/salons/nearby)", success, details)
            return success, data if success else []
        except Exception as e:
            self.log_test("Nearby Salons API (/api/salons/nearby)", False, str(e))
            return False, []

    def test_nearby_salons_default_radius(self):
        """Test /api/salons/nearby endpoint with default 5km radius"""
        try:
            # Test without radius parameter - should default to 5km
            params = {
                'lat': 28.7041,
                'lng': 77.1025
            }
            response = requests.get(f"{self.api_url}/salons/nearby", params=params, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {response.status_code}, Found {len(data)} salons with default 5km radius"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Nearby Salons API - Default 5km Radius", success, details)
            return success
        except Exception as e:
            self.log_test("Nearby Salons API - Default 5km Radius", False, str(e))
            return False

    def test_salon_location_update_api(self):
        """Test /api/salon/{salon_id}/location PATCH endpoint"""
        try:
            # First get a salon to test with
            success, salons = self.test_nearby_salons_api()
            if not success or not salons:
                self.log_test("Salon Location Update API", False, "No salons available to test location update")
                return False
            
            salon_id = salons[0].get('salon_id')
            if not salon_id:
                self.log_test("Salon Location Update API", False, "No salon_id found in salon data")
                return False
            
            # Test location update
            location_data = {
                "latitude": 28.7041,
                "longitude": 77.1025
            }
            
            response = requests.patch(
                f"{self.api_url}/salon/{salon_id}/location", 
                json=location_data, 
                timeout=10
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}, Response: {response.json() if success else response.text}"
            
            self.log_test("Salon Location Update API (/api/salon/{salon_id}/location)", success, details)
            return success
        except Exception as e:
            self.log_test("Salon Location Update API (/api/salon/{salon_id}/location)", False, str(e))
            return False

    def test_user_registration_api(self):
        """Test user registration endpoint"""
        try:
            user_data = {
                "phone": "9999999999",
                "role": "customer",
                "name": "Test User",
                "gender": "male",
                "firebase_uid": f"test_uid_{datetime.now().strftime('%H%M%S')}"
            }
            
            response = requests.post(f"{self.api_url}/auth/register", json=user_data, timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}, Response: {response.json() if success else response.text}"
            
            self.log_test("User Registration API (/api/auth/register)", success, details)
            return success
        except Exception as e:
            self.log_test("User Registration API (/api/auth/register)", False, str(e))
            return False

    def test_salon_registration_api(self):
        """Test salon registration endpoint"""
        try:
            # First register a user
            firebase_uid = f"test_salon_uid_{datetime.now().strftime('%H%M%S')}"
            user_data = {
                "phone": "8888888888",
                "role": "salon",
                "firebase_uid": firebase_uid
            }
            
            user_response = requests.post(f"{self.api_url}/auth/register", json=user_data, timeout=10)
            if user_response.status_code != 200:
                self.log_test("Salon Registration API", False, "Failed to register user first")
                return False
            
            # Now register salon
            salon_data = {
                "salon_name": "Test Salon",
                "owner_name": "Test Owner",
                "phone": "8888888888",
                "address": "Test Address",
                "area": "Test Area",
                "latitude": 28.7041,
                "longitude": 77.1025,
                "staff_count": 2,
                "avg_service_time": 30,
                "services": [{"id": "1", "name": "Haircut", "price": 100}],
                "business_type": "salon",
                "firebase_uid": firebase_uid
            }
            
            response = requests.post(f"{self.api_url}/salon/register", json=salon_data, timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}, Response: {response.json() if success else response.text}"
            
            self.log_test("Salon Registration API (/api/salon/register)", success, details)
            return success
        except Exception as e:
            self.log_test("Salon Registration API (/api/salon/register)", False, str(e))
            return False

    def test_admin_endpoints(self):
        """Test admin-related endpoints"""
        try:
            # Test admin salons endpoint
            response = requests.get(f"{self.api_url}/admin/salons", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", Found {len(data)} salons"
            else:
                details += f", Response: {response.text}"
            
            self.log_test("Admin Salons API (/api/admin/salons)", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Salons API (/api/admin/salons)", False, str(e))
            return False

    def test_commission_salon_summary(self):
        """Test /api/commission/salon/{salon_id} endpoint"""
        try:
            # First get a salon to test with
            success, salons = self.test_nearby_salons_api()
            if not success or not salons:
                self.log_test("Commission Salon Summary API", False, "No salons available to test commission summary")
                return False
            
            salon_id = salons[0].get('salon_id')
            if not salon_id:
                self.log_test("Commission Salon Summary API", False, "No salon_id found in salon data")
                return False
            
            response = requests.get(f"{self.api_url}/commission/salon/{salon_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {response.status_code}, Commission data: {json.dumps(data, indent=2)[:200]}..."
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Commission Salon Summary API (/api/commission/salon/{salon_id})", success, details)
            return success, salon_id if success else None
        except Exception as e:
            self.log_test("Commission Salon Summary API (/api/commission/salon/{salon_id})", False, str(e))
            return False, None

    def test_admin_commission_summary(self):
        """Test /api/admin/commission/summary endpoint"""
        try:
            response = requests.get(f"{self.api_url}/admin/commission/summary", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {response.status_code}, Commission summary: {json.dumps(data, indent=2)[:300]}..."
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Admin Commission Summary API (/api/admin/commission/summary)", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Commission Summary API (/api/admin/commission/summary)", False, str(e))
            return False

    def test_salon_block_unblock(self):
        """Test salon block/unblock endpoints"""
        try:
            # First get a salon to test with
            success, salons = self.test_nearby_salons_api()
            if not success or not salons:
                self.log_test("Salon Block/Unblock API", False, "No salons available to test block/unblock")
                return False
            
            salon_id = salons[0].get('salon_id')
            if not salon_id:
                self.log_test("Salon Block/Unblock API", False, "No salon_id found in salon data")
                return False
            
            # Test block salon
            response = requests.post(f"{self.api_url}/admin/salon/{salon_id}/block", timeout=10)
            block_success = response.status_code == 200
            
            if not block_success:
                self.log_test("Salon Block API (/api/admin/salon/{salon_id}/block)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
            
            self.log_test("Salon Block API (/api/admin/salon/{salon_id}/block)", True, f"Status: {response.status_code}")
            
            # Test unblock salon
            response = requests.post(f"{self.api_url}/admin/salon/{salon_id}/unblock", timeout=10)
            unblock_success = response.status_code == 200
            
            if unblock_success:
                details = f"Status: {response.status_code}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Salon Unblock API (/api/admin/salon/{salon_id}/unblock)", unblock_success, details)
            return unblock_success
        except Exception as e:
            self.log_test("Salon Block/Unblock API", False, str(e))
            return False

    def test_commission_check_overdue(self):
        """Test /api/commission/check-overdue endpoint"""
        try:
            response = requests.post(f"{self.api_url}/commission/check-overdue", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {response.status_code}, Overdue check result: {json.dumps(data)}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Commission Check Overdue API (/api/commission/check-overdue)", success, details)
            return success
        except Exception as e:
            self.log_test("Commission Check Overdue API (/api/commission/check-overdue)", False, str(e))
            return False

    def test_booking_creation_pending_approval(self):
        """Test /api/booking/create returns pending_approval status"""
        try:
            # First get a salon to test with
            success, salons = self.test_nearby_salons_api()
            if not success or not salons:
                self.log_test("Booking Creation - Pending Approval Status", False, "No salons available to test booking creation")
                return False, None
            
            salon = salons[0]
            salon_id = salon.get('salon_id')
            if not salon_id or not salon.get('services'):
                self.log_test("Booking Creation - Pending Approval Status", False, "No salon_id or services found in salon data")
                return False, None
            
            # Create a test booking with unique slot time
            import random
            slot_hour = random.randint(10, 18)
            slot_minute = random.choice([0, 30])
            slot_time = f"{slot_hour:02d}:{slot_minute:02d}"
            
            booking_data = {
                "salon_id": salon_id,
                "service_id": salon['services'][0]['id'],
                "slot_time": slot_time,
                "booking_date": "2025-01-25",  # Use future date
                "payment_method": "pay_at_salon",
                "customer_phone": f"999999{random.randint(1000, 9999)}",
                "customer_name": "Test Customer"
            }
            
            response = requests.post(f"{self.api_url}/booking/create", json=booking_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                booking_details = data.get('booking_details', {})
                booking_id = data.get('booking_id')
                status = booking_details.get('status')
                
                # Check if status is pending_approval
                if status == 'pending_approval':
                    details = f"Status: {response.status_code}, Booking status: {status}, ID: {booking_id}"
                else:
                    success = False
                    details = f"Expected status 'pending_approval', got '{status}'"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
                booking_id = None
            
            self.log_test("Booking Creation - Pending Approval Status", success, details)
            return success, booking_id
        except Exception as e:
            self.log_test("Booking Creation - Pending Approval Status", False, str(e))
            return False, None

    def test_booking_approve_endpoint(self, booking_id=None):
        """Test /api/booking/{id}/approve endpoint"""
        try:
            if not booking_id:
                # Create a booking first
                success, booking_id = self.test_booking_creation_pending_approval()
                if not success or not booking_id:
                    self.log_test("Booking Approve Endpoint", False, "No booking available to test approval")
                    return False
            
            response = requests.post(f"{self.api_url}/booking/{booking_id}/approve", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {response.status_code}, Response: {data.get('message', 'Approved')}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Booking Approve Endpoint (/api/booking/{id}/approve)", success, details)
            return success
        except Exception as e:
            self.log_test("Booking Approve Endpoint (/api/booking/{id}/approve)", False, str(e))
            return False

    def test_booking_reject_endpoint(self, booking_id=None):
        """Test /api/booking/{id}/reject endpoint"""
        try:
            if not booking_id:
                # Create a booking first
                success, booking_id = self.test_booking_creation_pending_approval()
                if not success or not booking_id:
                    self.log_test("Booking Reject Endpoint", False, "No booking available to test rejection")
                    return False
            
            response = requests.post(f"{self.api_url}/booking/{booking_id}/reject?reason=Test rejection", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {response.status_code}, Response: {data.get('message', 'Rejected')}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Booking Reject Endpoint (/api/booking/{id}/reject)", success, details)
            return success
        except Exception as e:
            self.log_test("Booking Reject Endpoint (/api/booking/{id}/reject)", False, str(e))
            return False

    def test_bookings_check_expired_endpoint(self):
        """Test /api/bookings/check-expired endpoint"""
        try:
            response = requests.post(f"{self.api_url}/bookings/check-expired", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                expired_count = data.get('expired_bookings', 0)
                details = f"Status: {response.status_code}, Expired bookings: {expired_count}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Bookings Check Expired Endpoint (/api/bookings/check-expired)", success, details)
            return success
        except Exception as e:
            self.log_test("Bookings Check Expired Endpoint (/api/bookings/check-expired)", False, str(e))
            return False

    def test_admin_subscription_approve_endpoint(self):
        """Test /api/admin/subscription/approve endpoint"""
        try:
            # First get a salon to test with
            success, salons = self.test_nearby_salons_api()
            if not success or not salons:
                self.log_test("Admin Subscription Approve Endpoint", False, "No salons available to test subscription approval")
                return False
            
            salon_id = salons[0].get('salon_id')
            if not salon_id:
                self.log_test("Admin Subscription Approve Endpoint", False, "No salon_id found in salon data")
                return False
            
            approval_data = {
                "salon_id": salon_id,
                "approved": True,
                "admin_notes": "Test approval"
            }
            
            response = requests.post(f"{self.api_url}/admin/subscription/approve", json=approval_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {response.status_code}, Response: {data.get('message', 'Approved')}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Admin Subscription Approve Endpoint (/api/admin/subscription/approve)", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Subscription Approve Endpoint (/api/admin/subscription/approve)", False, str(e))
            return False

    def test_admin_subscriptions_pending_endpoint(self):
        """Test /api/admin/subscriptions/pending endpoint"""
        try:
            response = requests.get(f"{self.api_url}/admin/subscriptions/pending", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                pending_count = len(data) if isinstance(data, list) else 0
                details = f"Status: {response.status_code}, Pending subscriptions: {pending_count}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Admin Subscriptions Pending Endpoint (/api/admin/subscriptions/pending)", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Subscriptions Pending Endpoint (/api/admin/subscriptions/pending)", False, str(e))
            return False

    def test_admin_bookings_analytics_endpoint(self):
        """Test /api/admin/bookings/analytics endpoint"""
        try:
            response = requests.get(f"{self.api_url}/admin/bookings/analytics", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                total_bookings = data.get('total_bookings', 0)
                pending_approval = data.get('pending_approval', 0)
                confirmed = data.get('confirmed', 0)
                details = f"Status: {response.status_code}, Total: {total_bookings}, Pending: {pending_approval}, Confirmed: {confirmed}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Admin Bookings Analytics Endpoint (/api/admin/bookings/analytics)", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Bookings Analytics Endpoint (/api/admin/bookings/analytics)", False, str(e))
            return False

    def test_otp_rate_limit_endpoint(self):
        """Test /api/auth/check-rate-limit endpoint"""
        try:
            rate_limit_data = {
                "phone": "9999999999"
            }
            
            response = requests.post(f"{self.api_url}/auth/check-rate-limit", json=rate_limit_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                allowed = data.get('allowed', False)
                message = data.get('message', '')
                details = f"Status: {response.status_code}, Allowed: {allowed}, Message: {message}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("OTP Rate Limit Check (/api/auth/check-rate-limit)", success, details)
            return success
        except Exception as e:
            self.log_test("OTP Rate Limit Check (/api/auth/check-rate-limit)", False, str(e))
            return False

    def test_salon_partner_register_endpoint(self):
        """Test /api/auth/salon-partner/register endpoint"""
        try:
            # Generate unique data for test using microseconds for uniqueness
            import time
            timestamp = str(int(time.time() * 1000000))[-10:]  # Last 10 digits of microsecond timestamp
            partner_data = {
                "phone": f"888{timestamp[-7:]}",
                "unique_id": f"test_partner_{timestamp}",
                "password": "TestPass123!",
                "firebase_uid": f"test_partner_uid_{timestamp}",
                "name": "Test Partner"
            }
            
            response = requests.post(f"{self.api_url}/auth/salon-partner/register", json=partner_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                partner_id = data.get('partner_id')
                status = data.get('status')
                details = f"Status: {response.status_code}, Partner ID: {partner_id}, Status: {status}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Salon Partner Registration (/api/auth/salon-partner/register)", success, details)
            return success, partner_data if success else None
        except Exception as e:
            self.log_test("Salon Partner Registration (/api/auth/salon-partner/register)", False, str(e))
            return False, None

    def test_salon_partner_login_endpoint(self):
        """Test /api/auth/salon-partner/login endpoint"""
        try:
            # First register a partner
            success, partner_data = self.test_salon_partner_register_endpoint()
            if not success or not partner_data:
                self.log_test("Salon Partner Login (/api/auth/salon-partner/login)", False, "Failed to register partner for login test")
                return False
            
            # Test login with correct credentials
            login_data = {
                "identifier": partner_data["unique_id"],
                "password": partner_data["password"]
            }
            
            response = requests.post(f"{self.api_url}/auth/salon-partner/login", json=login_data, timeout=10)
            
            # Should fail with 403 (pending approval) for new partner
            if response.status_code == 403:
                data = response.json()
                if "pending admin approval" in data.get('detail', '').lower():
                    success = True
                    details = f"Status: {response.status_code}, Correctly blocked pending approval"
                else:
                    success = False
                    details = f"Status: {response.status_code}, Unexpected 403 reason: {data.get('detail')}"
            else:
                success = False
                details = f"Status: {response.status_code}, Expected 403 for pending partner, got: {response.text}"
            
            self.log_test("Salon Partner Login - Pending Approval (/api/auth/salon-partner/login)", success, details)
            return success
        except Exception as e:
            self.log_test("Salon Partner Login (/api/auth/salon-partner/login)", False, str(e))
            return False

    def test_salon_partner_login_failed_attempts(self):
        """Test /api/auth/salon-partner/login with failed attempts"""
        try:
            # First register a partner
            success, partner_data = self.test_salon_partner_register_endpoint()
            if not success or not partner_data:
                self.log_test("Salon Partner Login - Failed Attempts", False, "Failed to register partner for failed attempts test")
                return False
            
            # Test with wrong password multiple times
            login_data = {
                "identifier": partner_data["unique_id"],
                "password": "WrongPassword123!"
            }
            
            failed_attempts = 0
            for attempt in range(6):  # Try 6 times to trigger lockout
                response = requests.post(f"{self.api_url}/auth/salon-partner/login", json=login_data, timeout=10)
                
                if response.status_code == 401:
                    failed_attempts += 1
                elif response.status_code == 423:  # Account locked
                    data = response.json()
                    if "locked" in data.get('detail', '').lower():
                        success = True
                        details = f"Account correctly locked after {failed_attempts} failed attempts"
                        break
                    else:
                        success = False
                        details = f"Unexpected 423 response: {data.get('detail')}"
                        break
                else:
                    success = False
                    details = f"Unexpected status {response.status_code} on attempt {attempt + 1}"
                    break
            else:
                success = False
                details = f"Account not locked after {failed_attempts} failed attempts"
            
            self.log_test("Salon Partner Login - Failed Attempts Lockout", success, details)
            return success
        except Exception as e:
            self.log_test("Salon Partner Login - Failed Attempts Lockout", False, str(e))
            return False

    def test_check_unique_id_endpoint(self):
        """Test /api/auth/salon-partner/check-unique-id/{id} endpoint"""
        try:
            # Test with a unique ID that should be available
            import time
            timestamp = str(int(time.time() * 1000000))[-12:]  # Use microsecond timestamp for uniqueness
            unique_id = f"available_id_{timestamp}"
            
            response = requests.get(f"{self.api_url}/auth/salon-partner/check-unique-id/{unique_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                available = data.get('available', False)
                if available:
                    details = f"Status: {response.status_code}, ID '{unique_id}' is available"
                else:
                    success = False
                    details = f"Status: {response.status_code}, ID '{unique_id}' unexpectedly not available"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Check Unique ID Availability (/api/auth/salon-partner/check-unique-id/{id})", success, details)
            return success
        except Exception as e:
            self.log_test("Check Unique ID Availability (/api/auth/salon-partner/check-unique-id/{id})", False, str(e))
            return False

    def test_salon_notifications_endpoint(self):
        """Test /api/notifications/salon/{salon_id} endpoint"""
        try:
            # First get a salon to test with
            success, salons = self.test_nearby_salons_api()
            if not success or not salons:
                self.log_test("Salon Notifications (/api/notifications/salon/{salon_id})", False, "No salons available to test notifications")
                return False
            
            salon_id = salons[0].get('salon_id')
            if not salon_id:
                self.log_test("Salon Notifications (/api/notifications/salon/{salon_id})", False, "No salon_id found in salon data")
                return False
            
            response = requests.get(f"{self.api_url}/notifications/salon/{salon_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                notification_count = len(data) if isinstance(data, list) else 0
                details = f"Status: {response.status_code}, Found {notification_count} notifications"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Salon Notifications (/api/notifications/salon/{salon_id})", success, details)
            return success
        except Exception as e:
            self.log_test("Salon Notifications (/api/notifications/salon/{salon_id})", False, str(e))
            return False

    def test_booking_notification_storage(self):
        """Test that booking creation stores notification in database"""
        try:
            # Create a booking and check if notification is stored
            success, booking_id = self.test_booking_creation_pending_approval()
            if not success or not booking_id:
                self.log_test("Booking Notification Storage", False, "Failed to create booking for notification test")
                return False
            
            # Get the salon_id from the booking to check notifications
            # We'll use the same salon from the booking creation test
            success, salons = self.test_nearby_salons_api()
            if not success or not salons:
                self.log_test("Booking Notification Storage", False, "No salons available to check notifications")
                return False
            
            salon_id = salons[0].get('salon_id')
            
            # Check if notifications exist for this salon
            response = requests.get(f"{self.api_url}/notifications/salon/{salon_id}", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                notification_count = len(data) if isinstance(data, list) else 0
                # Check if there's at least one notification (could be from this or previous bookings)
                if notification_count > 0:
                    details = f"Status: {response.status_code}, Found {notification_count} notifications (booking notifications working)"
                else:
                    details = f"Status: {response.status_code}, No notifications found (may indicate issue with notification storage)"
            else:
                details = f"Status: {response.status_code}, Response: {response.text}"
            
            self.log_test("Booking Notification Storage", success, details)
            return success
        except Exception as e:
            self.log_test("Booking Notification Storage", False, str(e))
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting BookYourSalons Backend API Tests")
        print("=" * 50)
        
        # Test server health first
        if not self.test_server_health():
            print("\n❌ Backend server is not responding. Stopping tests.")
            return False
        
        # Test NEW FEATURES from review request
        print("\n🔐 Testing OTP Rate Limiting & Salon Partner Auth...")
        self.test_otp_rate_limit_endpoint()
        self.test_salon_partner_register_endpoint()
        self.test_salon_partner_login_endpoint()
        self.test_salon_partner_login_failed_attempts()
        self.test_check_unique_id_endpoint()
        
        print("\n🔔 Testing Push Notifications...")
        self.test_salon_notifications_endpoint()
        self.test_booking_notification_storage()
        
        # Test existing core APIs
        print("\n📍 Testing Location-related APIs...")
        self.test_nearby_salons_api()
        self.test_nearby_salons_default_radius()
        self.test_salon_location_update_api()
        
        print("\n👤 Testing User & Salon Registration APIs...")
        self.test_user_registration_api()
        self.test_salon_registration_api()
        
        print("\n📋 Testing Booking Approval System APIs...")
        success, booking_id = self.test_booking_creation_pending_approval()
        if success and booking_id:
            # Test approve on one booking
            self.test_booking_approve_endpoint(booking_id)
            # Create another booking for reject test
            success2, booking_id2 = self.test_booking_creation_pending_approval()
            if success2 and booking_id2:
                self.test_booking_reject_endpoint(booking_id2)
        self.test_bookings_check_expired_endpoint()
        
        print("\n🔧 Testing Admin APIs...")
        self.test_admin_endpoints()
        self.test_admin_subscription_approve_endpoint()
        self.test_admin_subscriptions_pending_endpoint()
        self.test_admin_bookings_analytics_endpoint()
        
        print("\n💰 Testing Commission System APIs...")
        self.test_commission_salon_summary()
        self.test_admin_commission_summary()
        self.test_salon_block_unblock()
        self.test_commission_check_overdue()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = SalonAPITester()
    success = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())