#!/usr/bin/env python3
"""
Test cookie parsing logic to understand the issue
"""

def getUserFromRequest_simulation(cookie_header):
    """Simulate the getUserFromRequest function"""
    print(f"Input cookie_header: '{cookie_header}'")
    
    cookie_header = cookie_header or ''
    print(f"After or '': '{cookie_header}'")
    
    if not cookie_header:
        print("Empty cookie header, should return None")
        return None
        
    try:
        cookie_parts = cookie_header.split('; ')
        print(f"Split by '; ': {cookie_parts}")
        
        cookies = {}
        for c in cookie_parts:
            if '=' in c:
                key_value = c.split('=')
                key = key_value[0]
                value = '='.join(key_value[1:])  # Handle values with = in them
                cookies[key] = value
            else:
                print(f"Skipping invalid cookie part: '{c}'")
        
        print(f"Parsed cookies: {cookies}")
        
        return {'userId': cookies['userId']} if cookies.get('userId') else None
        
    except Exception as e:
        print(f"Exception in cookie parsing: {e}")
        return None

# Test different scenarios
test_cases = [
    "",  # Empty string
    None,  # None value
    "userId=user123",  # Valid cookie
    "userId=user123; sessionId=abc",  # Multiple cookies
    "invalidcookie",  # Invalid format
    "; ; ;",  # Multiple empty parts
]

for test_case in test_cases:
    print(f"\n--- Testing: {repr(test_case)} ---")
    result = getUserFromRequest_simulation(test_case)
    print(f"Result: {result}")
    print()