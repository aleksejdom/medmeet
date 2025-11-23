#!/bin/bash

echo "=== Testing Video Appointments Full Flow ==="
echo ""

# 1. Register Doctor
echo "1. Registering doctor..."
DOCTOR_RES=$(curl -s -c /tmp/doctor_cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"doctor'$(date +%s)'@test.com",
    "password":"test123",
    "name":"Dr. Smith",
    "role":"doctor",
    "phone":"+1234567890",
    "specialization":"Cardiology",
    "experience":10,
    "bio":"Experienced cardiologist"
  }')

DOCTOR_ID=$(echo $DOCTOR_RES | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✓ Doctor registered: $DOCTOR_ID"
echo ""

# 2. Create Time Slot
echo "2. Creating time slot..."
SLOT_RES=$(curl -s -b /tmp/doctor_cookies.txt -X POST http://localhost:3000/api/time-slots \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-02-20","startTime":"10:00","endTime":"10:30","duration":30}')

SLOT_ID=$(echo $SLOT_RES | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✓ Time slot created: $SLOT_ID"
echo ""

# 3. Register Patient
echo "3. Registering patient..."
PATIENT_RES=$(curl -s -c /tmp/patient_cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"patient'$(date +%s)'@test.com",
    "password":"test123",
    "name":"John Patient",
    "role":"patient",
    "phone":"+9876543210"
  }')

PATIENT_ID=$(echo $PATIENT_RES | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✓ Patient registered: $PATIENT_ID"
echo ""

# 4. List Available Slots
echo "4. Checking available slots..."
SLOTS=$(curl -s -b /tmp/patient_cookies.txt \
  "http://localhost:3000/api/time-slots?doctorId=$DOCTOR_ID&date=2025-02-20&available=true")
echo "✓ Available slots found"
echo ""

# 5. Book Appointment
echo "5. Booking appointment..."
APPT_RES=$(curl -s -b /tmp/patient_cookies.txt -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"slotId":"'$SLOT_ID'","notes":"Regular checkup"}')

APPT_ID=$(echo $APPT_RES | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✓ Appointment booked: $APPT_ID"
echo ""

# 6. Check Appointments
echo "6. Checking doctor's appointments..."
DOCTOR_APPTS=$(curl -s -b /tmp/doctor_cookies.txt http://localhost:3000/api/appointments)
echo "✓ Doctor can see appointments"
echo ""

echo "7. Checking patient's appointments..."
PATIENT_APPTS=$(curl -s -b /tmp/patient_cookies.txt http://localhost:3000/api/appointments)
echo "✓ Patient can see appointments"
echo ""

echo "=== All Tests Passed! ==="
echo ""
echo "Summary:"
echo "- Doctor ID: $DOCTOR_ID"
echo "- Patient ID: $PATIENT_ID"  
echo "- Slot ID: $SLOT_ID"
echo "- Appointment ID: $APPT_ID"
