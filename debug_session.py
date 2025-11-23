#!/usr/bin/env python3
"""
Debug session and cookie handling
"""

import requests
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://medmeet-3.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_session_behavior():
    """Test how session behaves across requests"""
    print("Testing session behavior...")
    
    # Create session and login
    session = requests.Session()
    
    # Register a test user
    doctor_data = {
        "email": f"debug.doctor.{int(__import__('time').time())}@medmeet.com",
        "password": "SecurePass123!",
        "name": "Debug Doctor",
        "role": "doctor",
        "phone": "+1234567890",
        "specialization": "Cardiology",
        "bio": "Test doctor",
        "experience": 5
    }
    
    print("1. Registering doctor...")
    reg_response = session.post(f"{API_BASE}/auth/register", json=doctor_data)
    print(f"Registration: {reg_response.status_code}")
    print(f"Session cookies after registration: {dict(session.cookies)}")
    
    # Test auth/me with session
    print("\n2. Testing auth/me with session...")
    auth_response = session.get(f"{API_BASE}/auth/me")
    print(f"Auth/me with session: {auth_response.status_code}")
    print(f"Session cookies: {dict(session.cookies)}")
    
    # Clear cookies and test again
    print("\n3. Clearing cookies and testing auth/me...")
    session.cookies.clear()
    auth_response2 = session.get(f"{API_BASE}/auth/me")
    print(f"Auth/me after clearing cookies: {auth_response2.status_code}")
    print(f"Session cookies after clear: {dict(session.cookies)}")
    
    # Test with a completely new session
    print("\n4. Testing with new session...")
    new_session = requests.Session()
    auth_response3 = new_session.get(f"{API_BASE}/auth/me")
    print(f"Auth/me with new session: {auth_response3.status_code}")
    
    # Test other endpoints that should require auth
    print("\n5. Testing other protected endpoints...")
    endpoints = [
        ("GET", "/api/appointments", None),
        ("GET", "/api/notifications", None),
        ("POST", "/api/time-slots", {"date": "2025-11-25", "startTime": "09:00", "endTime": "09:30"}),
        ("DELETE", "/api/time-slots/fake_id", None)
    ]
    
    for method, endpoint, data in endpoints:
        if method == "GET":
            resp = new_session.get(f"{API_BASE}{endpoint}")
        elif method == "POST":
            resp = new_session.post(f"{API_BASE}{endpoint}", json=data)
        elif method == "DELETE":
            resp = new_session.delete(f"{API_BASE}{endpoint}")
        
        print(f"{method} {endpoint}: {resp.status_code}")

if __name__ == "__main__":
    test_session_behavior()