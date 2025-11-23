#!/usr/bin/env python3
"""
Test specific endpoints that are failing
"""

import requests
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://medmeet-2.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_endpoint(method, endpoint, data=None):
    """Test a specific endpoint without authentication"""
    print(f"\n--- Testing {method} {endpoint} ---")
    
    # Use a completely fresh request (no session)
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Test-Client/1.0'
    }
    
    try:
        if method == "GET":
            response = requests.get(f"{API_BASE}{endpoint}", headers=headers)
        elif method == "POST":
            response = requests.post(f"{API_BASE}{endpoint}", json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(f"{API_BASE}{endpoint}", headers=headers)
        elif method == "PATCH":
            response = requests.patch(f"{API_BASE}{endpoint}", json=data, headers=headers)
            
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response Body: {response.text[:500]}")
        
        # Check if response has any cookies
        if response.cookies:
            print(f"Response Cookies: {dict(response.cookies)}")
        else:
            print("No cookies in response")
            
        return response.status_code
        
    except Exception as e:
        print(f"Exception: {e}")
        return None

# Test the problematic endpoints
endpoints_to_test = [
    ("GET", "/api/auth/me"),
    ("GET", "/api/appointments"),
    ("GET", "/api/notifications"),
    ("POST", "/api/time-slots", {"date": "2025-11-25", "startTime": "09:00", "endTime": "09:30"}),
    ("DELETE", "/api/time-slots/fake_id"),
    ("PATCH", "/api/notifications/fake_id"),
    ("POST", "/api/appointments", {"slotId": "fake_slot", "notes": "test"}),
]

print("Testing endpoints without authentication...")
print("=" * 60)

for test_case in endpoints_to_test:
    if len(test_case) == 3:
        method, endpoint, data = test_case
    else:
        method, endpoint = test_case
        data = None
    
    test_endpoint(method, endpoint, data)

print("\n" + "=" * 60)
print("Test completed")