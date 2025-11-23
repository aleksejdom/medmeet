#!/usr/bin/env python3
"""
MedMeet Backend API Regression Test
Quick regression test for critical endpoints after PeerJS implementation
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "https://medmeet-3.preview.emergentagent.com/api"

def test_critical_endpoints():
    """Test critical backend endpoints for regression"""
    print("🔍 MedMeet Backend API Regression Test")
    print("=" * 50)
    
    results = []
    
    # Test 1: Authentication endpoints
    print("\n🔐 Testing Authentication Endpoints...")
    
    # Register new users
    doctor_data = {
        "email": f"regression.doctor.{int(datetime.now().timestamp())}@test.com",
        "password": "TestPass123!",
        "name": "Dr. Regression Test",
        "role": "doctor",
        "phone": "+1234567890",
        "specialization": "General Medicine",
        "bio": "Test doctor for regression testing",
        "experience": 5
    }
    
    patient_data = {
        "email": f"regression.patient.{int(datetime.now().timestamp())}@test.com",
        "password": "TestPass123!",
        "name": "Patient Test",
        "role": "patient",
        "phone": "+1987654321"
    }
    
    session = requests.Session()
    
    # Test doctor registration
    try:
        response = session.post(f"{BASE_URL}/auth/register", json=doctor_data)
        if response.status_code == 200 and response.json().get('success'):
            print("✅ Doctor registration: WORKING")
            doctor_cookies = response.cookies
            results.append(("Doctor Registration", True))
        else:
            print(f"❌ Doctor registration: FAILED - {response.status_code}")
            results.append(("Doctor Registration", False))
            return results
    except Exception as e:
        print(f"❌ Doctor registration: ERROR - {e}")
        results.append(("Doctor Registration", False))
        return results
    
    # Test patient registration
    try:
        response = session.post(f"{BASE_URL}/auth/register", json=patient_data)
        if response.status_code == 200 and response.json().get('success'):
            print("✅ Patient registration: WORKING")
            patient_cookies = response.cookies
            results.append(("Patient Registration", True))
        else:
            print(f"❌ Patient registration: FAILED - {response.status_code}")
            results.append(("Patient Registration", False))
            return results
    except Exception as e:
        print(f"❌ Patient registration: ERROR - {e}")
        results.append(("Patient Registration", False))
        return results
    
    # Test login
    try:
        login_response = session.post(f"{BASE_URL}/auth/login", json={
            "email": doctor_data["email"],
            "password": doctor_data["password"]
        })
        if login_response.status_code == 200 and login_response.json().get('success'):
            print("✅ Doctor login: WORKING")
            doctor_cookies = login_response.cookies
            results.append(("Doctor Login", True))
        else:
            print(f"❌ Doctor login: FAILED - {login_response.status_code}")
            results.append(("Doctor Login", False))
    except Exception as e:
        print(f"❌ Doctor login: ERROR - {e}")
        results.append(("Doctor Login", False))
    
    # Test session check
    try:
        me_response = session.get(f"{BASE_URL}/auth/me", cookies=doctor_cookies)
        if me_response.status_code == 200 and me_response.json().get('user'):
            print("✅ Session check: WORKING")
            results.append(("Session Check", True))
        else:
            print(f"❌ Session check: FAILED - {me_response.status_code}")
            results.append(("Session Check", False))
    except Exception as e:
        print(f"❌ Session check: ERROR - {e}")
        results.append(("Session Check", False))
    
    # Test 2: Time slot management
    print("\n⏰ Testing Time Slot Management...")
    
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    slot_data = {
        "date": tomorrow,
        "startTime": "10:00",
        "endTime": "10:30",
        "duration": 30
    }
    
    try:
        slot_response = session.post(f"{BASE_URL}/time-slots", json=slot_data, cookies=doctor_cookies)
        if slot_response.status_code == 200 and slot_response.json().get('success'):
            print("✅ Create time slot: WORKING")
            slot_id = slot_response.json()['slot']['id']
            results.append(("Create Time Slot", True))
        else:
            print(f"❌ Create time slot: FAILED - {slot_response.status_code}")
            results.append(("Create Time Slot", False))
            slot_id = None
    except Exception as e:
        print(f"❌ Create time slot: ERROR - {e}")
        results.append(("Create Time Slot", False))
        slot_id = None
    
    # Test get time slots
    try:
        get_slots_response = session.get(f"{BASE_URL}/time-slots?available=true")
        if get_slots_response.status_code == 200 and 'slots' in get_slots_response.json():
            print("✅ Get time slots: WORKING")
            results.append(("Get Time Slots", True))
        else:
            print(f"❌ Get time slots: FAILED - {get_slots_response.status_code}")
            results.append(("Get Time Slots", False))
    except Exception as e:
        print(f"❌ Get time slots: ERROR - {e}")
        results.append(("Get Time Slots", False))
    
    # Test 3: Appointment management
    print("\n📅 Testing Appointment Management...")
    
    # Login as patient for booking
    try:
        patient_login = session.post(f"{BASE_URL}/auth/login", json={
            "email": patient_data["email"],
            "password": patient_data["password"]
        })
        if patient_login.status_code == 200:
            patient_cookies = patient_login.cookies
            
            if slot_id:
                # Book appointment
                booking_data = {
                    "slotId": slot_id,
                    "notes": "Regression test appointment"
                }
                
                book_response = session.post(f"{BASE_URL}/appointments", json=booking_data, cookies=patient_cookies)
                if book_response.status_code == 200 and book_response.json().get('success'):
                    print("✅ Book appointment: WORKING")
                    results.append(("Book Appointment", True))
                    appointment_id = book_response.json()['appointment']['id']
                else:
                    print(f"❌ Book appointment: FAILED - {book_response.status_code}")
                    results.append(("Book Appointment", False))
                    appointment_id = None
            else:
                print("❌ Book appointment: SKIPPED - No slot available")
                results.append(("Book Appointment", False))
                appointment_id = None
        else:
            print(f"❌ Patient login for booking: FAILED - {patient_login.status_code}")
            results.append(("Book Appointment", False))
            appointment_id = None
    except Exception as e:
        print(f"❌ Book appointment: ERROR - {e}")
        results.append(("Book Appointment", False))
        appointment_id = None
    
    # Test get appointments
    try:
        appointments_response = session.get(f"{BASE_URL}/appointments", cookies=patient_cookies)
        if appointments_response.status_code == 200 and 'appointments' in appointments_response.json():
            print("✅ Get appointments: WORKING")
            results.append(("Get Appointments", True))
        else:
            print(f"❌ Get appointments: FAILED - {appointments_response.status_code}")
            results.append(("Get Appointments", False))
    except Exception as e:
        print(f"❌ Get appointments: ERROR - {e}")
        results.append(("Get Appointments", False))
    
    # Test 4: Additional endpoints
    print("\n🔍 Testing Additional Endpoints...")
    
    # Test get doctors
    try:
        doctors_response = session.get(f"{BASE_URL}/doctors")
        if doctors_response.status_code == 200 and 'doctors' in doctors_response.json():
            print("✅ Get doctors list: WORKING")
            results.append(("Get Doctors", True))
        else:
            print(f"❌ Get doctors list: FAILED - {doctors_response.status_code}")
            results.append(("Get Doctors", False))
    except Exception as e:
        print(f"❌ Get doctors list: ERROR - {e}")
        results.append(("Get Doctors", False))
    
    # Test logout
    try:
        logout_response = session.post(f"{BASE_URL}/auth/logout")
        if logout_response.status_code == 200 and logout_response.json().get('success'):
            print("✅ Logout: WORKING")
            results.append(("Logout", True))
        else:
            print(f"❌ Logout: FAILED - {logout_response.status_code}")
            results.append(("Logout", False))
    except Exception as e:
        print(f"❌ Logout: ERROR - {e}")
        results.append(("Logout", False))
    
    return results

def main():
    results = test_critical_endpoints()
    
    print("\n" + "=" * 50)
    print("📊 REGRESSION TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    if total - passed > 0:
        print("\n❌ FAILED TESTS:")
        for test_name, success in results:
            if not success:
                print(f"  - {test_name}")
    else:
        print("\n🎉 ALL TESTS PASSED!")
    
    # Return success if all critical tests pass
    critical_tests = ["Doctor Registration", "Patient Registration", "Doctor Login", "Session Check", 
                     "Create Time Slot", "Get Time Slots", "Book Appointment", "Get Appointments"]
    
    critical_passed = sum(1 for test_name, success in results 
                         if test_name in critical_tests and success)
    
    print(f"\n🎯 Critical Tests: {critical_passed}/{len(critical_tests)} passed")
    
    return critical_passed == len(critical_tests)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)