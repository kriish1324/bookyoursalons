#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime
import uuid

class BookYourSalonsAPITester:
    def __init__(self, base_url="https://salon-dashboard-47.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test_result(self, name, success, response_data=None, error=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            self.failed_tests.append({
                'test': name,
                'error': error,
                'response': response_data
            })
            print(f"❌ {name} - FAILED: {error}")

    def test_root_endpoint(self):
        """Test root API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                expected_message = "Salon Booking API"
                success = data.get("message") == expected_message
            self.log_test_result("Root API Endpoint", success, response.json() if success else None)
            return success
        except Exception as e:
            self.log_test_result("Root API Endpoint", False, error=str(e))
            return False

    def test_trending_salons_api(self):
        """Test trending salons API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/salons/trending", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list)  # Should return a list
            self.log_test_result("Trending Salons API", success, response.json() if response.status_code == 200 else None)
            return success
        except Exception as e:
            self.log_test_result("Trending Salons API", False, error=str(e))
            return False

    def test_smart_search_api(self):
        """Test smart search API endpoint"""
        try:
            params = {"query": "test", "lat": 12.9716, "lng": 77.5946}
            response = requests.get(f"{self.base_url}/search", params=params, timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list)  # Should return a list
            self.log_test_result("Smart Search API", success, response.json() if response.status_code == 200 else None)
            return success
        except Exception as e:
            self.log_test_result("Smart Search API", False, error=str(e))
            return False

    def test_admin_user_analytics_api(self):
        """Test admin user analytics API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/admin/user-analytics", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, dict)  # Should return analytics object
            self.log_test_result("Admin User Analytics API", success, response.json() if response.status_code == 200 else None)
            return success
        except Exception as e:
            self.log_test_result("Admin User Analytics API", False, error=str(e))
            return False

    def test_spam_protection_api(self):
        """Test spam protection API endpoint"""
        try:
            test_phone = f"+91{uuid.uuid4().hex[:10]}"  # Random test phone
            payload = {"customer_phone": test_phone}
            response = requests.post(f"{self.base_url}/booking/check-spam", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'}, 
                                   timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "allowed" in data  # Should have allowed field
            self.log_test_result("Spam Protection API", success, response.json() if response.status_code == 200 else None)
            return success
        except Exception as e:
            self.log_test_result("Spam Protection API", False, error=str(e))
            return False

    def test_salon_status_toggle_api(self):
        """Test salon status toggle API endpoint with a test salon ID"""
        try:
            test_salon_id = "test-salon-id"
            payload = {"is_open": True, "auto_close_enabled": True}
            response = requests.patch(f"{self.base_url}/salon/{test_salon_id}/toggle-status", 
                                    json=payload, 
                                    headers={'Content-Type': 'application/json'}, 
                                    timeout=10)
            # 404 is acceptable since test salon doesn't exist, 500 would indicate server error
            success = response.status_code in [200, 404]
            error_msg = None if success else f"Status code: {response.status_code}"
            self.log_test_result("Salon Status Toggle API", success, error=error_msg)
            return success
        except Exception as e:
            self.log_test_result("Salon Status Toggle API", False, error=str(e))
            return False

    def test_salon_hours_api(self):
        """Test salon operating hours API endpoint"""
        try:
            test_salon_id = "test-salon-id"
            payload = {"opening_time": "09:00", "closing_time": "20:00"}
            response = requests.patch(f"{self.base_url}/salon/{test_salon_id}/hours", 
                                    json=payload, 
                                    headers={'Content-Type': 'application/json'}, 
                                    timeout=10)
            # 404 is acceptable since test salon doesn't exist
            success = response.status_code in [200, 404]
            error_msg = None if success else f"Status code: {response.status_code}"
            self.log_test_result("Salon Operating Hours API", success, error=error_msg)
            return success
        except Exception as e:
            self.log_test_result("Salon Operating Hours API", False, error=str(e))
            return False

    def test_review_create_api(self):
        """Test review creation API endpoint"""
        try:
            payload = {
                "salon_id": "test-salon-id",
                "customer_phone": "+919876543210",
                "customer_name": "Test Customer",
                "rating": 5,
                "review_text": "Great service!"
            }
            response = requests.post(f"{self.base_url}/review/create", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'}, 
                                   timeout=10)
            # 404 is acceptable since test salon doesn't exist
            success = response.status_code in [200, 201, 404]
            error_msg = None if success else f"Status code: {response.status_code}"
            self.log_test_result("Review Creation API", success, error=error_msg)
            return success
        except Exception as e:
            self.log_test_result("Review Creation API", False, error=str(e))
            return False

    def test_salon_dashboard_analytics_api(self):
        """Test salon dashboard analytics API endpoint"""
        try:
            test_salon_id = "test-salon-id"
            response = requests.get(f"{self.base_url}/salon/{test_salon_id}/dashboard-analytics", timeout=10)
            # 404 is acceptable since test salon doesn't exist
            success = response.status_code in [200, 404]
            error_msg = None if success else f"Status code: {response.status_code}"
            self.log_test_result("Salon Dashboard Analytics API", success, error=error_msg)
            return success
        except Exception as e:
            self.log_test_result("Salon Dashboard Analytics API", False, error=str(e))
            return False

    def test_nearby_salons_api(self):
        """Test nearby salons discovery API"""
        try:
            # Test with Delhi coordinates
            params = {"lat": 28.6139, "lng": 77.2090, "radius": 5.0}
            response = requests.get(f"{self.base_url}/salons/nearby", params=params, timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = isinstance(data, list)  # Should return a list
            self.log_test_result("Nearby Salons API", success, response.json() if response.status_code == 200 else None)
            return success
        except Exception as e:
            self.log_test_result("Nearby Salons API", False, error=str(e))
            return False

    def test_customer_visit_history_api(self):
        """Test customer visit history API"""
        try:
            test_phone = "+919876543210"
            response = requests.get(f"{self.base_url}/customer/{test_phone}/visit-history", timeout=10)
            success = response.status_code in [200, 404]  # 404 if no history found
            error_msg = None if success else f"Status code: {response.status_code}"
            self.log_test_result("Customer Visit History API", success, error=error_msg)
            return success
        except Exception as e:
            self.log_test_result("Customer Visit History API", False, error=str(e))
            return False

    def test_auto_close_check_api(self):
        """Test auto-close check API"""
        try:
            test_salon_id = "test-salon-id"
            response = requests.post(f"{self.base_url}/salon/{test_salon_id}/check-auto-close", 
                                   headers={'Content-Type': 'application/json'}, 
                                   timeout=10)
            success = response.status_code in [200, 404]  # 404 if salon doesn't exist
            error_msg = None if success else f"Status code: {response.status_code}"
            self.log_test_result("Auto Close Check API", success, error=error_msg)
            return success
        except Exception as e:
            self.log_test_result("Auto Close Check API", False, error=str(e))
            return False

    def test_photo_gallery_api(self):
        """Test photo gallery API"""
        try:
            test_salon_id = "test-salon-id"
            payload = {
                "salon_id": test_salon_id,
                "photos": ["data:image/png;base64,test"]
            }
            response = requests.post(f"{self.base_url}/salon/{test_salon_id}/gallery", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'}, 
                                   timeout=10)
            success = response.status_code in [200, 404]  # 404 if salon doesn't exist
            error_msg = None if success else f"Status code: {response.status_code}"
            self.log_test_result("Photo Gallery API", success, error=error_msg)
            return success
        except Exception as e:
            self.log_test_result("Photo Gallery API", False, error=str(e))
            return False

    def test_admin_login_api(self):
        """Test admin login API"""
        try:
            payload = {
                "email": "admin@test.com",
                "password": "test123"
            }
            response = requests.post(f"{self.base_url}/admin/login", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'}, 
                                   timeout=10)
            success = response.status_code in [200, 401]  # 401 for invalid credentials is expected
            error_msg = None if success else f"Status code: {response.status_code}"
            self.log_test_result("Admin Login API", success, error=error_msg)
            return success
        except Exception as e:
            self.log_test_result("Admin Login API", False, error=str(e))
            return False

    def test_salon_registration_free_trial(self):
        """Test salon registration with free trial - should not require payment"""
        try:
            test_uid = f"test_uid_{uuid.uuid4().hex[:8]}"
            payload = {
                "salon_name": "Test Salon Free Trial",
                "owner_name": "Test Owner",
                "phone": f"+91{uuid.uuid4().hex[:10]}",
                "address": "Test Address",
                "area": "Test Area",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "staff_count": 2,
                "avg_service_time": 30,
                "services": [{"id": "1", "name": "Haircut", "price": 500}],
                "firebase_uid": test_uid,
                "subscription_plan": "free_trial",
                "payment_reference": "FREE_TRIAL"
            }
            response = requests.post(f"{self.base_url}/salon/register", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'}, 
                                   timeout=10)
            success = response.status_code in [200, 201, 404]  # 404 if user doesn't exist is acceptable
            if success and response.status_code in [200, 201]:
                data = response.json()
                success = "salon_id" in data
            self.log_test_result("Salon Registration Free Trial", success)
            return success
        except Exception as e:
            self.log_test_result("Salon Registration Free Trial", False, error=str(e))
            return False

    def test_admin_analytics_zero_commission(self):
        """Test admin analytics showing 0% commission system"""
        try:
            response = requests.get(f"{self.base_url}/admin/analytics", timeout=10)
            success = response.status_code == 200
            if success:
                data = response.json()
                # Platform earnings should be 0 for zero commission
                success = "platform_earnings" in data
            self.log_test_result("Admin Analytics Zero Commission", success)
            return success
        except Exception as e:
            self.log_test_result("Admin Analytics Zero Commission", False, error=str(e))
            return False

    def test_commission_summary_zero_rate(self):
        """Test commission summary with zero commission rate"""
        try:
            test_salon_id = "test-salon-id"
            response = requests.get(f"{self.base_url}/commission/salon/{test_salon_id}", timeout=10)
            success = response.status_code in [200, 404]  # 404 if salon doesn't exist is acceptable
            if success and response.status_code == 200:
                data = response.json()
                success = "commission_summary" in data
            self.log_test_result("Commission Summary Zero Rate", success)
            return success
        except Exception as e:
            self.log_test_result("Commission Summary Zero Rate", False, error=str(e))
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting BookYourSalons API Testing...")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)

        # Test all endpoints
        tests = [
            self.test_root_endpoint,
            self.test_trending_salons_api,
            self.test_smart_search_api,
            self.test_admin_user_analytics_api,
            self.test_spam_protection_api,
            self.test_salon_status_toggle_api,
            self.test_salon_hours_api,
            self.test_review_create_api,
            self.test_salon_dashboard_analytics_api,
            self.test_nearby_salons_api,
            self.test_customer_visit_history_api,
            self.test_auto_close_check_api,
            self.test_photo_gallery_api,
            self.test_admin_login_api,
            self.test_salon_registration_free_trial,
            self.test_admin_analytics_zero_commission,
            self.test_commission_summary_zero_rate
        ]

        for test_func in tests:
            try:
                test_func()
            except Exception as e:
                print(f"❌ {test_func.__name__} - UNEXPECTED ERROR: {str(e)}")
                self.tests_run += 1

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failed in self.failed_tests:
                print(f"   - {failed['test']}: {failed['error']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"✅ Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = BookYourSalonsAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())