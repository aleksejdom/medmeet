# Video Call Testing Guide

## Fixes Applied to Resolve "Connection Closed" Issue

### Key Changes:
1. **Prevented Duplicate Peer Creation**: Changed from destroying old peer to skipping creation if peer already exists
2. **Fixed Signal Processing**: Improved signal handling logic to check `peer.destroyed` instead of `peer.connected`
3. **Added More STUN Servers**: Added multiple Google STUN servers for better NAT traversal
4. **Improved Timing**: Added delays for peer creation and signal processing to avoid race conditions
5. **Better Error Handling**: Distinguished between connection errors and participant leaving
6. **Signal Cleanup**: Properly delete processed signals after a delay

### How It Works:
1. First user joins → becomes initiator → waits for second user
2. Second user joins → becomes receiver → creates peer immediately
3. Initiator detects second user → creates peer and sends offer
4. Receiver receives offer → sends answer back
5. Both exchange ICE candidates → connection established
6. Video streams displayed on both sides

## Testing Instructions

### Setup:
You need TWO separate browser sessions to test:

**Option A: Same Computer**
- Browser 1: Regular Chrome window (Doctor)
- Browser 2: Chrome Incognito/Private window (Patient)

**Option B: Different Devices**
- Device 1: Computer (Doctor)
- Device 2: Phone/Tablet (Patient)

### Step-by-Step Test:

#### 1. Doctor Setup:
1. Open the app in Browser 1
2. Register/Login as Doctor
3. Go to "Time Slots" tab
4. Create a time slot for today or tomorrow:
   - Date: Select a date
   - Start Time: e.g., 10:00
   - End Time: e.g., 10:30
   - Click "Create Slot"

#### 2. Patient Setup:
1. Open the app in Browser 2 (Incognito/Private)
2. Register/Login as Patient
3. Go to "Book Appointment" tab
4. Click on the doctor you just created
5. You should see available slots
6. Click on a time slot to select it
7. Add optional notes
8. Click "Confirm Booking"
9. Go to "My Appointments" tab

#### 3. Join Video Call:
**IMPORTANT: Both users must join within a short time of each other**

1. **Doctor** (Browser 1):
   - Go to "Appointments" tab
   - Click "Join Call" on the scheduled appointment
   - Allow camera and microphone when prompted
   - You should see: "Waiting for other participant..."

2. **Patient** (Browser 2) - Join within 10 seconds:
   - Go to "My Appointments" tab
   - Click "Join Call" on the same appointment
   - Allow camera and microphone when prompted
   - You should see: "Found participant, connecting..."

#### 4. Expected Behavior:
- Both should see their own video in the left panel
- After a few seconds (5-10s), you should see:
  - "Initiating connection..." or "Accepting connection..."
  - "Connected"
  - Remote participant's video in the right panel

#### 5. During Call:
- Test audio mute/unmute button
- Test video on/off button
- Both controls should work
- Click "Leave Call" to exit

## Troubleshooting:

### If you see "Connection closed":
1. **Check Browser Console**: 
   - Press F12 → Console tab
   - Look for error messages
   - Common issues:
     - "Permission denied" → Allow camera/microphone
     - "ICE failed" → Network/firewall issue
     - "Signal error" → Database connection issue

2. **Timing Issue**:
   - Both users must join within 10-15 seconds of each other
   - First user should wait for "Waiting for other participant..."
   - Second user should join immediately

3. **Browser Permissions**:
   - Make sure camera/microphone permissions are granted
   - Click the camera icon in browser address bar to check
   - Try refreshing and allowing again

4. **Network Issues**:
   - If on different networks, STUN servers might not work
   - Try using same WiFi network
   - Corporate firewalls might block WebRTC

5. **Clean Start**:
   - Both users leave the call
   - Wait 5 seconds
   - First user joins
   - Wait for "Waiting for participant..." message
   - Second user joins immediately

### Console Logs to Look For:

**Good Connection:**
```
Creating peer as initiator
Sending signal: offer
Signal sent successfully
Received remote stream!
Peer data channel connected!
Connected
```

**Bad Connection:**
```
Peer error: [error message]
Connection closed by remote
Connection failed
```

### Common Issues:

1. **"Failed to access camera/microphone"**
   - Solution: Check browser permissions, allow access

2. **"Connection error: Ice connection failed"**
   - Solution: Network/firewall blocking WebRTC
   - Try same network or disable VPN

3. **"Participant left"** (immediately after connecting)
   - Solution: Timing issue, both rejoin quickly

4. **Video freezes**
   - Solution: Poor network connection
   - Try reducing video quality in getUserMedia

## Debug Mode:

Open browser console (F12) to see detailed logs:
- Peer creation
- Signal sending/receiving
- Connection state changes
- Error messages

All operations are logged with descriptive messages to help diagnose issues.

## Known Limitations:

1. **One-to-One Only**: Currently supports only 2 participants
2. **No Recording**: Video calls are not recorded
3. **Network Dependent**: Quality depends on internet connection
4. **STUN Only**: No TURN server for complex NAT scenarios
5. **Browser Support**: Works best in Chrome/Edge, may have issues in Safari/Firefox

## Success Criteria:

✅ Both users can see their own video
✅ Both users can see each other's video
✅ Audio works in both directions
✅ Mute buttons work
✅ Video on/off works
✅ Connection stays stable
✅ "Connected" status displayed
