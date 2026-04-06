import requests
import sys
import json
from datetime import datetime

class BookYourSalonsAPITester:
    def __init__(self, base_url="https://book-final-deploy.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_salon_id = None
        self.test_booking_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 200:
                        print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_api(self):
        """Test root API health check"""
        return self.run_test("Root API Health Check", "GET", "api", 200)

    def test_geocode_reverse(self):
        """Test reverse geocoding"""
        params = {"lat": "28.6139", "lon": "77.2090"}  # Delhi coordinates
        return self.run_test("Reverse Geocoding", "GET", "api/geocode/reverse", 200, params=params)

    def test_salon_registration(self):
        """Test salon registration"""
        salon_data = {
            "salon_name": f"Test Salon {datetime.now().strftime('%H%M%S')}",
            "owner_name": "Test Owner",
            "phone": f"9876543{datetime.now().strftime('%H%M')}",
            "address": "Test Address, Delhi",
            "area": "Test Area",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "staff_count": 2,
            "avg_service_time": 30,
            "services": [
                {"name": "Haircut", "price": 200},
                {"name": "Shave", "price": 100}
            ],
            "business_type": "salon",
            "opening_time": "09:00",
            "closing_time": "20:00"
        }
        
        success, response = self.run_test("Salon Registration", "POST", "api/salon/register", 200, salon_data)
        if success and response.get("salon_id"):
            self.test_salon_id = response["salon_id"]
            print(f"   Created salon ID: {self.test_salon_id}")
        return success, response

    def test_admin_analytics(self):
        """Test admin analytics"""
        return self.run_test("Admin Analytics", "GET", "api/admin/analytics", 200)

    def test_admin_salons(self):
        """Test get all salons"""
        return self.run_test("Admin Get All Salons", "GET", "api/admin/salons", 200)

    def test_admin_user_analytics(self):
        """Test admin user analytics"""
        return self.run_test("Admin User Analytics", "GET", "api/admin/user-analytics", 200)

    def test_admin_bookings_all(self):
        """Test get all bookings"""
        return self.run_test("Admin Get All Bookings", "GET", "api/admin/bookings/all", 200)

    def test_approve_salon(self):
        """Test salon approval"""
        if not self.test_salon_id:
            print("❌ Skipping salon approval - no test salon created")
            return False, {}
        
        return self.run_test("Admin Approve Salon", "PATCH", f"api/admin/salon/{self.test_salon_id}/approve", 200)

    def test_nearby_salons(self):
        """Test nearby salons"""
        params = {"lat": 28.6139, "lng": 77.2090, "radius": 10}
        return self.run_test("Get Nearby Salons", "GET", "api/salons/nearby", 200, params=params)

    def test_trending_salons(self):
        """Test trending salons"""
        return self.run_test("Get Trending Salons", "GET", "api/salons/trending", 200)

    def test_salon_slots(self):
        """Test get salon slots"""
        if not self.test_salon_id:
            print("❌ Skipping salon slots - no test salon created")
            return False, {}
        
        today = datetime.now().strftime("%Y-%m-%d")
        params = {"date": today}
        return self.run_test("Get Salon Slots", "GET", f"api/salon/{self.test_salon_id}/slots", 200, params=params)

    def test_create_booking(self):
        """Test create booking"""
        if not self.test_salon_id:
            print("❌ Skipping booking creation - no test salon created")
            return False, {}
        
        booking_data = {
            "salon_id": self.test_salon_id,
            "salon_name": "Test Salon",
            "customer_name": "Test Customer",
            "customer_phone": f"9876543{datetime.now().strftime('%H%M')}",
            "service_name": "Haircut",
            "service_price": 200,
            "booking_date": datetime.now().strftime("%Y-%m-%d"),
            "slot_time": "10:00",
            "payment_method": "pay_at_salon"
        }
        
        success, response = self.run_test("Create Booking", "POST", "api/booking/create", 200, booking_data)
        if success and response.get("booking_id"):
            self.test_booking_id = response["booking_id"]
            print(f"   Created booking ID: {self.test_booking_id}")
        return success, response

    def test_approve_booking(self):
        """Test approve booking"""
        if not self.test_booking_id:
            print("❌ Skipping booking approval - no test booking created")
            return False, {}
        
        return self.run_test("Approve Booking", "POST", f"api/booking/{self.test_booking_id}/approve", 200)

    def test_discount_eligibility(self):
        """Test 50% discount eligibility for first 100 salons"""
        return self.run_test("Check Discount Eligibility", "GET", "api/salon/discount-eligibility", 200)

    def test_salon_subscribe(self):
        """Test salon subscription with discount logic"""
        if not self.test_salon_id:
            print("❌ Skipping salon subscription - no test salon created")
            return False, {}
        
        subscription_data = {
            "salon_id": self.test_salon_id,
            "plan": "1_month",
            "original_price": 999,
            "payment_id": "test_payment_123"
        }
        
        return self.run_test("Salon Subscribe", "POST", "api/salon/subscribe", 200, subscription_data)

    def test_update_salon_profile(self):
        """Test salon profile update with partial update support"""
        # Use the existing test salon from credentials
        test_salon_id = "8746ea9e-c78a-460f-a347-062a13ff8ca5"
        
        update_data = {
            "salonId": test_salon_id,
            "firebase_uid": "test-uid-123",
            "name": "Updated Test Salon",
            "address": "Updated Address, Delhi",
            "area": "Updated Area",
            "phone": "+919999999999",
            "secondary_phone": "+919876543211",
            "staff_count": 3,
            "avg_service_time": 45,
            "business_type": "spa",
            "services": [
                {"name": "Updated Haircut", "price": 250},
                {"name": "Updated Shave", "price": 150},
                {"name": "Facial", "price": 500}
            ]
        }
        
        return self.run_test("Update Salon Profile", "PUT", "api/salon/update-profile", 200, update_data)

def main():
    print("🚀 Starting BookYourSalons API Tests")
    print("=" * 50)
    
    tester = BookYourSalonsAPITester()
    
    # Test sequence
    tests = [
        ("Root API", tester.test_root_api),
        ("Geocode Reverse", tester.test_geocode_reverse),
        ("Salon Registration", tester.test_salon_registration),
        ("Admin Analytics", tester.test_admin_analytics),
        ("Admin Salons", tester.test_admin_salons),
        ("Admin User Analytics", tester.test_admin_user_analytics),
        ("Admin All Bookings", tester.test_admin_bookings_all),
        ("Approve Salon", tester.test_approve_salon),
        ("Nearby Salons", tester.test_nearby_salons),
        ("Trending Salons", tester.test_trending_salons),
        ("Salon Slots", tester.test_salon_slots),
        ("Create Booking", tester.test_create_booking),
        ("Approve Booking", tester.test_approve_booking),
        ("Discount Eligibility", tester.test_discount_eligibility),
        ("Salon Subscribe", tester.test_salon_subscribe),
        ("Update Salon Profile", tester.test_update_salon_profile),
    ]
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())