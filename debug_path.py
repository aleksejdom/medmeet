#!/usr/bin/env python3
"""
Debug path handling
"""

import requests
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://medmeet-3.preview.emergentagent.com')

def test_path_handling():
    """Test different path formats"""
    
    paths_to_test = [
        "/api/auth/me",
        "/api/appointments", 
        "/api/notifications",
        "/api/doctors",
        "/api/time-slots",
        "/api/nonexistent"
    ]
    
    for path in paths_to_test:
        print(f"\n--- Testing {path} ---")
        try:
            response = requests.get(f"{BASE_URL}{path}")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text[:200]}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_path_handling()