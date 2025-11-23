#!/usr/bin/env python3
"""
Debug authentication issues
"""

import requests
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://medmeet-2.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_auth_without_cookies():
    """Test auth endpoints without any cookies"""
    print("Testing auth endpoints without cookies...")
    
    # Create a fresh session
    session = requests.Session()
    
    # Clear any existing cookies
    session.cookies.clear()
    
    # Test /api/auth/me
    response = session.get(f"{API_BASE}/auth/me")
    print(f"GET /api/auth/me: {response.status_code}")
    print(f"Response: {response.text[:200]}")
    print(f"Cookies in response: {dict(response.cookies)}")
    print(f"Session cookies: {dict(session.cookies)}")
    
    # Test with explicit empty cookies
    response2 = requests.get(f"{API_BASE}/auth/me", cookies={})
    print(f"\nGET /api/auth/me (explicit empty cookies): {response2.status_code}")
    print(f"Response: {response2.text[:200]}")
    
    # Test with no session at all
    response3 = requests.get(f"{API_BASE}/auth/me")
    print(f"\nGET /api/auth/me (no session): {response3.status_code}")
    print(f"Response: {response3.text[:200]}")

if __name__ == "__main__":
    test_auth_without_cookies()