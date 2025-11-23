#!/usr/bin/env python3
"""
Debug the authentication issue more carefully
"""

import requests
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://medmeet-2.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_auth_carefully():
    """Test authentication more carefully"""
    
    print("=== Step 1: Test with completely fresh session ===")
    fresh_session = requests.Session()
    response = fresh_session.get(f"{API_BASE}/auth/me")
    print(f"Fresh session /auth/me: {response.status_code}")
    print(f"Response: {response.text}")
    print(f"Session cookies: {dict(fresh_session.cookies)}")
    
    print("\n=== Step 2: Register and login ===")
    doctor_data = {
        "email": f"test.doctor.{int(__import__('time').time())}@medmeet.com",
        "password": "SecurePass123!",
        "name": "Test Doctor",
        "role": "doctor",
        "phone": "+1234567890",
        "specialization": "Cardiology",
        "bio": "Test doctor",
        "experience": 5
    }
    
    reg_response = fresh_session.post(f"{API_BASE}/auth/register", json=doctor_data)
    print(f"Registration: {reg_response.status_code}")
    print(f"Session cookies after registration: {dict(fresh_session.cookies)}")
    
    # Test auth/me with cookies
    auth_response = fresh_session.get(f"{API_BASE}/auth/me")
    print(f"Auth/me with cookies: {auth_response.status_code}")
    
    print("\n=== Step 3: Test with new session (no cookies) ===")
    new_session = requests.Session()
    
    # Make sure no cookies are set
    print(f"New session cookies before request: {dict(new_session.cookies)}")
    
    # Test various endpoints
    endpoints = [
        "/auth/me",
        "/appointments", 
        "/notifications",
    ]
    
    for endpoint in endpoints:
        response = new_session.get(f"{API_BASE}{endpoint}")
        print(f"GET {endpoint}: {response.status_code} - {response.text[:100]}")
        print(f"Cookies after request: {dict(new_session.cookies)}")
    
    print("\n=== Step 4: Test POST endpoints ===")
    post_endpoints = [
        ("/time-slots", {"date": "2025-11-25", "startTime": "09:00", "endTime": "09:30"}),
        ("/appointments", {"slotId": "fake_slot", "notes": "test"}),
    ]
    
    for endpoint, data in post_endpoints:
        response = new_session.post(f"{API_BASE}{endpoint}", json=data)
        print(f"POST {endpoint}: {response.status_code} - {response.text[:100]}")
    
    print("\n=== Step 5: Test with requests (no session) ===")
    for endpoint in endpoints:
        response = requests.get(f"{API_BASE}{endpoint}")
        print(f"No session GET {endpoint}: {response.status_code} - {response.text[:100]}")

if __name__ == "__main__":
    test_auth_carefully()