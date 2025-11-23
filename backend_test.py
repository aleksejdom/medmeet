#!/usr/bin/env python3
"""
Comprehensive Backend API Test Suite for Video Appointment Booking System
Tests all API endpoints with proper authentication flow
"""

import requests
import json
import time
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://medmeet-3.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.doctor_user = None
        self.patient_user = None
        self.doctor_cookies = None
        self.patient_cookies = None
        self.test_results = []
        
    def log_test(self, test_name, success, message="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'response_data': response_data
        })
        
    def test_doctor_registration(self):
        """Test doctor user registration"""
        print("\n=== Testing Doctor Registration ===")
        
        doctor_data = {
            "email": f"doctor.smith.{int(time.time())}@medmeet.com",
            "password": "SecurePass123!",
            "name": "Dr. John Smith",
            "role": "doctor",
            "phone": "+1234567890",
            "specialization": "Cardiology",
            "bio": "Experienced cardiologist with 15 years of practice",
            "experience": 15
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json=doctor_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('user'):
                    self.doctor_user = data['user']
                    self.doctor_cookies = response.cookies
                    self.log_test("Doctor Registration", True, f"Doctor registered: {self.doctor_user['name']}")
                    return True
                else:
                    self.log_test("Doctor Registration", False, f"Invalid response format: {data}")
            else:
                self.log_test("Doctor Registration", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Doctor Registration", False, f"Exception: {str(e)}")
            
        return False
        
    def test_patient_registration(self):
        """Test patient user registration"""
        print("\n=== Testing Patient Registration ===")
        
        patient_data = {
            "email": f"patient.doe.{int(time.time())}@medmeet.com",
            "password": "SecurePass123!",
            "name": "Jane Doe",
            "role": "patient",
            "phone": "+1987654321"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json=patient_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('user'):
                    self.patient_user = data['user']
                    self.patient_cookies = response.cookies
                    self.log_test("Patient Registration", True, f"Patient registered: {self.patient_user['name']}")
                    return True
                else:
                    self.log_test("Patient Registration", False, f"Invalid response format: {data}")
            else:
                self.log_test("Patient Registration", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Patient Registration", False, f"Exception: {str(e)}")
            
        return False
        
    def test_duplicate_registration(self):
        """Test duplicate email registration should fail"""
        print("\n=== Testing Duplicate Registration ===")
        
        if not self.doctor_user:
            self.log_test("Duplicate Registration", False, "No doctor user to test with")
            return False
            
        duplicate_data = {
            "email": self.doctor_user['email'],
            "password": "AnotherPass123!",
            "name": "Another Doctor",
            "role": "doctor",
            "phone": "+1111111111"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/register", json=duplicate_data)
            
            if response.status_code == 400:
                data = response.json()
                if 'already registered' in data.get('error', '').lower():
                    self.log_test("Duplicate Registration", True, "Correctly rejected duplicate email")
                    return True
                else:
                    self.log_test("Duplicate Registration", False, f"Wrong error message: {data}")
            else:
                self.log_test("Duplicate Registration", False, f"Should return 400, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Duplicate Registration", False, f"Exception: {str(e)}")
            
        return False
        
    def test_login(self):
        """Test user login"""
        print("\n=== Testing Login ===")
        
        if not self.doctor_user:
            self.log_test("Login", False, "No doctor user to test with")
            return False
            
        # Test doctor login
        login_data = {
            "email": self.doctor_user['email'],
            "password": "SecurePass123!"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('user'):
                    self.doctor_cookies = response.cookies
                    self.log_test("Doctor Login", True, f"Doctor logged in: {data['user']['name']}")
                    
                    # Test patient login
                    patient_login = {
                        "email": self.patient_user['email'],
                        "password": "SecurePass123!"
                    }
                    
                    patient_response = self.session.post(f"{API_BASE}/auth/login", json=patient_login)
                    if patient_response.status_code == 200:
                        patient_data = patient_response.json()
                        if patient_data.get('success'):
                            self.patient_cookies = patient_response.cookies
                            self.log_test("Patient Login", True, f"Patient logged in: {patient_data['user']['name']}")
                            return True
                    
                    self.log_test("Patient Login", False, f"Patient login failed: {patient_response.text}")
                else:
                    self.log_test("Doctor Login", False, f"Invalid response format: {data}")
            else:
                self.log_test("Doctor Login", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Login", False, f"Exception: {str(e)}")
            
        return False
        
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        print("\n=== Testing Invalid Login ===")
        
        invalid_login = {
            "email": "nonexistent@medmeet.com",
            "password": "wrongpassword"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=invalid_login)
            
            if response.status_code == 401:
                data = response.json()
                if 'invalid credentials' in data.get('error', '').lower():
                    self.log_test("Invalid Login", True, "Correctly rejected invalid credentials")
                    return True
                else:
                    self.log_test("Invalid Login", False, f"Wrong error message: {data}")
            else:
                self.log_test("Invalid Login", False, f"Should return 401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Invalid Login", False, f"Exception: {str(e)}")
            
        return False
        
    def test_auth_me(self):
        """Test getting current user info"""
        print("\n=== Testing Auth Me ===")
        
        if not self.doctor_cookies:
            self.log_test("Auth Me", False, "No doctor cookies available")
            return False
            
        try:
            response = self.session.get(f"{API_BASE}/auth/me", cookies=self.doctor_cookies)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('user') and data['user']['role'] == 'doctor':
                    self.log_test("Auth Me", True, f"Retrieved user info: {data['user']['name']}")
                    return True
                else:
                    self.log_test("Auth Me", False, f"Invalid user data: {data}")
            else:
                self.log_test("Auth Me", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Auth Me", False, f"Exception: {str(e)}")
            
        return False
        
    def test_auth_me_unauthorized(self):
        """Test auth/me without cookies"""
        print("\n=== Testing Auth Me Unauthorized ===")
        
        try:
            response = self.session.get(f"{API_BASE}/auth/me")
            
            if response.status_code == 401:
                self.log_test("Auth Me Unauthorized", True, "Correctly rejected unauthorized request")
                return True
            else:
                self.log_test("Auth Me Unauthorized", False, f"Should return 401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Auth Me Unauthorized", False, f"Exception: {str(e)}")
            
        return False
        
    def test_create_time_slots(self):
        """Test creating time slots as doctor"""
        print("\n=== Testing Time Slot Creation ===")
        
        if not self.doctor_cookies:
            self.log_test("Create Time Slots", False, "No doctor cookies available")
            return False
            
        # Create multiple time slots for testing
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        day_after = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
        
        slots = [
            {"date": tomorrow, "startTime": "09:00", "endTime": "09:30", "duration": 30},
            {"date": tomorrow, "startTime": "10:00", "endTime": "10:30", "duration": 30},
            {"date": day_after, "startTime": "14:00", "endTime": "14:30", "duration": 30},
        ]
        
        created_slots = 0
        
        for slot in slots:
            try:
                response = self.session.post(f"{API_BASE}/time-slots", json=slot, cookies=self.doctor_cookies)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success') and data.get('slot'):
                        created_slots += 1
                        self.log_test(f"Create Time Slot {slot['date']} {slot['startTime']}", True, "Slot created successfully")
                    else:
                        self.log_test(f"Create Time Slot {slot['date']} {slot['startTime']}", False, f"Invalid response: {data}")
                else:
                    self.log_test(f"Create Time Slot {slot['date']} {slot['startTime']}", False, f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test(f"Create Time Slot {slot['date']} {slot['startTime']}", False, f"Exception: {str(e)}")
                
        return created_slots > 0
        
    def test_create_time_slot_unauthorized(self):
        """Test creating time slot without authentication"""
        print("\n=== Testing Time Slot Creation Unauthorized ===")
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        slot = {"date": tomorrow, "startTime": "11:00", "endTime": "11:30", "duration": 30}
        
        try:
            response = self.session.post(f"{API_BASE}/time-slots", json=slot)
            
            if response.status_code == 401:
                self.log_test("Create Time Slot Unauthorized", True, "Correctly rejected unauthorized request")
                return True
            else:
                self.log_test("Create Time Slot Unauthorized", False, f"Should return 401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Create Time Slot Unauthorized", False, f"Exception: {str(e)}")
            
        return False
        
    def test_get_doctor_time_slots(self):
        """Test getting doctor's time slots"""
        print("\n=== Testing Get Doctor Time Slots ===")
        
        if not self.doctor_user:
            self.log_test("Get Doctor Time Slots", False, "No doctor user available")
            return False
            
        try:
            response = self.session.get(f"{API_BASE}/time-slots?doctorId={self.doctor_user['id']}")
            
            if response.status_code == 200:
                data = response.json()
                if 'slots' in data:
                    slots = data['slots']
                    self.log_test("Get Doctor Time Slots", True, f"Retrieved {len(slots)} time slots")
                    return True
                else:
                    self.log_test("Get Doctor Time Slots", False, f"Invalid response format: {data}")
            else:
                self.log_test("Get Doctor Time Slots", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Get Doctor Time Slots", False, f"Exception: {str(e)}")
            
        return False
        
    def test_get_available_slots(self):
        """Test getting available slots for a specific date"""
        print("\n=== Testing Get Available Slots ===")
        
        if not self.doctor_user:
            self.log_test("Get Available Slots", False, "No doctor user available")
            return False
            
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        try:
            response = self.session.get(f"{API_BASE}/time-slots?doctorId={self.doctor_user['id']}&date={tomorrow}&available=true")
            
            if response.status_code == 200:
                data = response.json()
                if 'slots' in data:
                    slots = data['slots']
                    available_slots = [s for s in slots if s.get('is_available')]
                    self.log_test("Get Available Slots", True, f"Retrieved {len(available_slots)} available slots for {tomorrow}")
                    return len(available_slots) > 0
                else:
                    self.log_test("Get Available Slots", False, f"Invalid response format: {data}")
            else:
                self.log_test("Get Available Slots", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Get Available Slots", False, f"Exception: {str(e)}")
            
        return False
        
    def test_get_doctors_list(self):
        """Test getting list of all doctors"""
        print("\n=== Testing Get Doctors List ===")
        
        try:
            response = self.session.get(f"{API_BASE}/doctors")
            
            if response.status_code == 200:
                data = response.json()
                if 'doctors' in data:
                    doctors = data['doctors']
                    doctor_found = any(d['id'] == self.doctor_user['id'] for d in doctors)
                    self.log_test("Get Doctors List", True, f"Retrieved {len(doctors)} doctors, test doctor found: {doctor_found}")
                    return True
                else:
                    self.log_test("Get Doctors List", False, f"Invalid response format: {data}")
            else:
                self.log_test("Get Doctors List", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Get Doctors List", False, f"Exception: {str(e)}")
            
        return False
        
    def test_book_appointment(self):
        """Test booking an appointment as patient"""
        print("\n=== Testing Book Appointment ===")
        
        if not self.patient_cookies or not self.doctor_user:
            self.log_test("Book Appointment", False, "Missing patient cookies or doctor user")
            return False
            
        # First get available slots
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        try:
            slots_response = self.session.get(f"{API_BASE}/time-slots?doctorId={self.doctor_user['id']}&date={tomorrow}&available=true")
            
            if slots_response.status_code != 200:
                self.log_test("Book Appointment", False, f"Failed to get slots: {slots_response.status_code}")
                return False
                
            slots_data = slots_response.json()
            available_slots = [s for s in slots_data.get('slots', []) if s.get('is_available')]
            
            if not available_slots:
                self.log_test("Book Appointment", False, "No available slots to book")
                return False
                
            # Book the first available slot
            slot_to_book = available_slots[0]
            booking_data = {
                "slotId": slot_to_book['id'],
                "notes": "Regular checkup appointment"
            }
            
            response = self.session.post(f"{API_BASE}/appointments", json=booking_data, cookies=self.patient_cookies)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('appointment'):
                    self.log_test("Book Appointment", True, f"Appointment booked successfully: {data['appointment']['id']}")
                    return True
                else:
                    self.log_test("Book Appointment", False, f"Invalid response format: {data}")
            else:
                self.log_test("Book Appointment", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Book Appointment", False, f"Exception: {str(e)}")
            
        return False
        
    def test_book_appointment_unauthorized(self):
        """Test booking appointment without authentication"""
        print("\n=== Testing Book Appointment Unauthorized ===")
        
        booking_data = {
            "slotId": "fake_slot_id",
            "notes": "Test appointment"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/appointments", json=booking_data)
            
            if response.status_code == 401:
                self.log_test("Book Appointment Unauthorized", True, "Correctly rejected unauthorized request")
                return True
            else:
                self.log_test("Book Appointment Unauthorized", False, f"Should return 401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Book Appointment Unauthorized", False, f"Exception: {str(e)}")
            
        return False
        
    def test_get_appointments(self):
        """Test getting user appointments"""
        print("\n=== Testing Get Appointments ===")
        
        # Test doctor appointments
        if self.doctor_cookies:
            try:
                response = self.session.get(f"{API_BASE}/appointments", cookies=self.doctor_cookies)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'appointments' in data:
                        appointments = data['appointments']
                        self.log_test("Get Doctor Appointments", True, f"Retrieved {len(appointments)} doctor appointments")
                    else:
                        self.log_test("Get Doctor Appointments", False, f"Invalid response format: {data}")
                else:
                    self.log_test("Get Doctor Appointments", False, f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test("Get Doctor Appointments", False, f"Exception: {str(e)}")
                
        # Test patient appointments
        if self.patient_cookies:
            try:
                response = self.session.get(f"{API_BASE}/appointments", cookies=self.patient_cookies)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'appointments' in data:
                        appointments = data['appointments']
                        self.log_test("Get Patient Appointments", True, f"Retrieved {len(appointments)} patient appointments")
                        return True
                    else:
                        self.log_test("Get Patient Appointments", False, f"Invalid response format: {data}")
                else:
                    self.log_test("Get Patient Appointments", False, f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test("Get Patient Appointments", False, f"Exception: {str(e)}")
                
        return False
        
    def test_get_appointments_unauthorized(self):
        """Test getting appointments without authentication"""
        print("\n=== Testing Get Appointments Unauthorized ===")
        
        try:
            response = self.session.get(f"{API_BASE}/appointments")
            
            if response.status_code == 401:
                self.log_test("Get Appointments Unauthorized", True, "Correctly rejected unauthorized request")
                return True
            else:
                self.log_test("Get Appointments Unauthorized", False, f"Should return 401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Appointments Unauthorized", False, f"Exception: {str(e)}")
            
        return False
        
    def test_update_appointment_status(self):
        """Test updating appointment status"""
        print("\n=== Testing Update Appointment Status ===")
        
        if not self.doctor_cookies:
            self.log_test("Update Appointment Status", False, "No doctor cookies available")
            return False
            
        # First get doctor's appointments
        try:
            response = self.session.get(f"{API_BASE}/appointments", cookies=self.doctor_cookies)
            
            if response.status_code != 200:
                self.log_test("Update Appointment Status", False, f"Failed to get appointments: {response.status_code}")
                return False
                
            data = response.json()
            appointments = data.get('appointments', [])
            
            if not appointments:
                self.log_test("Update Appointment Status", False, "No appointments to update")
                return False
                
            # Update the first appointment to completed
            appointment = appointments[0]
            update_data = {"status": "completed"}
            
            update_response = self.session.post(
                f"{API_BASE}/appointments/{appointment['id']}/status",
                json=update_data,
                cookies=self.doctor_cookies
            )
            
            if update_response.status_code == 200:
                update_result = update_response.json()
                if update_result.get('success'):
                    self.log_test("Update Appointment Status", True, f"Appointment {appointment['id']} marked as completed")
                    return True
                else:
                    self.log_test("Update Appointment Status", False, f"Invalid response: {update_result}")
            else:
                self.log_test("Update Appointment Status", False, f"HTTP {update_response.status_code}: {update_response.text}")
                
        except Exception as e:
            self.log_test("Update Appointment Status", False, f"Exception: {str(e)}")
            
        return False
        
    def test_get_notifications(self):
        """Test getting user notifications"""
        print("\n=== Testing Get Notifications ===")
        
        # Test doctor notifications
        if self.doctor_cookies:
            try:
                response = self.session.get(f"{API_BASE}/notifications", cookies=self.doctor_cookies)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'notifications' in data:
                        notifications = data['notifications']
                        self.log_test("Get Doctor Notifications", True, f"Retrieved {len(notifications)} doctor notifications")
                    else:
                        self.log_test("Get Doctor Notifications", False, f"Invalid response format: {data}")
                else:
                    self.log_test("Get Doctor Notifications", False, f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test("Get Doctor Notifications", False, f"Exception: {str(e)}")
                
        # Test patient notifications
        if self.patient_cookies:
            try:
                response = self.session.get(f"{API_BASE}/notifications", cookies=self.patient_cookies)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'notifications' in data:
                        notifications = data['notifications']
                        self.log_test("Get Patient Notifications", True, f"Retrieved {len(notifications)} patient notifications")
                        return True
                    else:
                        self.log_test("Get Patient Notifications", False, f"Invalid response format: {data}")
                else:
                    self.log_test("Get Patient Notifications", False, f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test("Get Patient Notifications", False, f"Exception: {str(e)}")
                
        return False
        
    def test_get_notifications_unauthorized(self):
        """Test getting notifications without authentication"""
        print("\n=== Testing Get Notifications Unauthorized ===")
        
        try:
            response = self.session.get(f"{API_BASE}/notifications")
            
            if response.status_code == 401:
                self.log_test("Get Notifications Unauthorized", True, "Correctly rejected unauthorized request")
                return True
            else:
                self.log_test("Get Notifications Unauthorized", False, f"Should return 401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Get Notifications Unauthorized", False, f"Exception: {str(e)}")
            
        return False
        
    def test_mark_notification_read(self):
        """Test marking notification as read"""
        print("\n=== Testing Mark Notification Read ===")
        
        if not self.patient_cookies:
            self.log_test("Mark Notification Read", False, "No patient cookies available")
            return False
            
        # First get patient notifications
        try:
            response = self.session.get(f"{API_BASE}/notifications", cookies=self.patient_cookies)
            
            if response.status_code != 200:
                self.log_test("Mark Notification Read", False, f"Failed to get notifications: {response.status_code}")
                return False
                
            data = response.json()
            notifications = data.get('notifications', [])
            
            if not notifications:
                self.log_test("Mark Notification Read", False, "No notifications to mark as read")
                return False
                
            # Mark the first notification as read
            notification = notifications[0]
            
            mark_response = self.session.patch(
                f"{API_BASE}/notifications/{notification['id']}",
                cookies=self.patient_cookies
            )
            
            if mark_response.status_code == 200:
                mark_result = mark_response.json()
                if mark_result.get('success'):
                    self.log_test("Mark Notification Read", True, f"Notification {notification['id']} marked as read")
                    return True
                else:
                    self.log_test("Mark Notification Read", False, f"Invalid response: {mark_result}")
            else:
                self.log_test("Mark Notification Read", False, f"HTTP {mark_response.status_code}: {mark_response.text}")
                
        except Exception as e:
            self.log_test("Mark Notification Read", False, f"Exception: {str(e)}")
            
        return False
        
    def test_delete_time_slot(self):
        """Test deleting a time slot"""
        print("\n=== Testing Delete Time Slot ===")
        
        if not self.doctor_cookies or not self.doctor_user:
            self.log_test("Delete Time Slot", False, "No doctor cookies or user available")
            return False
            
        # First get available slots to delete
        try:
            response = self.session.get(f"{API_BASE}/time-slots?doctorId={self.doctor_user['id']}")
            
            if response.status_code != 200:
                self.log_test("Delete Time Slot", False, f"Failed to get slots: {response.status_code}")
                return False
                
            data = response.json()
            slots = data.get('slots', [])
            available_slots = [s for s in slots if s.get('is_available')]
            
            if not available_slots:
                self.log_test("Delete Time Slot", False, "No available slots to delete")
                return False
                
            # Delete the first available slot
            slot_to_delete = available_slots[0]
            
            delete_response = self.session.delete(
                f"{API_BASE}/time-slots/{slot_to_delete['id']}",
                cookies=self.doctor_cookies
            )
            
            if delete_response.status_code == 200:
                delete_result = delete_response.json()
                if delete_result.get('success'):
                    self.log_test("Delete Time Slot", True, f"Time slot {slot_to_delete['id']} deleted successfully")
                    return True
                else:
                    self.log_test("Delete Time Slot", False, f"Invalid response: {delete_result}")
            else:
                self.log_test("Delete Time Slot", False, f"HTTP {delete_response.status_code}: {delete_response.text}")
                
        except Exception as e:
            self.log_test("Delete Time Slot", False, f"Exception: {str(e)}")
            
        return False
        
    def test_delete_time_slot_unauthorized(self):
        """Test deleting time slot without authentication"""
        print("\n=== Testing Delete Time Slot Unauthorized ===")
        
        try:
            response = self.session.delete(f"{API_BASE}/time-slots/fake_slot_id")
            
            if response.status_code == 401:
                self.log_test("Delete Time Slot Unauthorized", True, "Correctly rejected unauthorized request")
                return True
            else:
                self.log_test("Delete Time Slot Unauthorized", False, f"Should return 401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Delete Time Slot Unauthorized", False, f"Exception: {str(e)}")
            
        return False
        
    def test_update_doctor_profile(self):
        """Test updating doctor profile"""
        print("\n=== Testing Update Doctor Profile ===")
        
        if not self.doctor_cookies:
            self.log_test("Update Doctor Profile", False, "No doctor cookies available")
            return False
            
        profile_data = {
            "specialization": "Interventional Cardiology",
            "bio": "Updated bio: Specialized in interventional cardiology with 15+ years experience",
            "experience": 16
        }
        
        try:
            response = self.session.post(f"{API_BASE}/doctor/profile", json=profile_data, cookies=self.doctor_cookies)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('profile'):
                    self.log_test("Update Doctor Profile", True, f"Profile updated: {data['profile']['specialization']}")
                    return True
                else:
                    self.log_test("Update Doctor Profile", False, f"Invalid response format: {data}")
            else:
                self.log_test("Update Doctor Profile", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Update Doctor Profile", False, f"Exception: {str(e)}")
            
        return False
        
    def test_logout(self):
        """Test user logout"""
        print("\n=== Testing Logout ===")
        
        try:
            response = self.session.post(f"{API_BASE}/auth/logout")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_test("Logout", True, "User logged out successfully")
                    return True
                else:
                    self.log_test("Logout", False, f"Invalid response format: {data}")
            else:
                self.log_test("Logout", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Logout", False, f"Exception: {str(e)}")
            
        return False
        
    def run_all_tests(self):
        """Run all backend API tests"""
        print(f"🚀 Starting Backend API Tests for {BASE_URL}")
        print("=" * 60)
        
        # Authentication Tests
        self.test_doctor_registration()
        self.test_patient_registration()
        self.test_duplicate_registration()
        self.test_login()
        self.test_invalid_login()
        self.test_auth_me()
        self.test_auth_me_unauthorized()
        
        # Time Slot Tests
        self.test_create_time_slots()
        self.test_create_time_slot_unauthorized()
        self.test_get_doctor_time_slots()
        self.test_get_available_slots()
        
        # Doctor Operations
        self.test_get_doctors_list()
        self.test_update_doctor_profile()
        self.test_delete_time_slot()
        self.test_delete_time_slot_unauthorized()
        
        # Appointment Tests
        self.test_book_appointment()
        self.test_book_appointment_unauthorized()
        self.test_get_appointments()
        self.test_get_appointments_unauthorized()
        self.test_update_appointment_status()
        
        # Notification Tests
        self.test_get_notifications()
        self.test_get_notifications_unauthorized()
        self.test_mark_notification_read()
        
        # Cleanup
        self.test_logout()
        
        # Print Summary
        self.print_summary()
        
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("🏁 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    tester = APITester()
    tester.run_all_tests()