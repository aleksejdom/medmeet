# Video Call Troubleshooting Guide

## Issue: "Nothing happens after allowing camera/microphone"

### What's Been Fixed:
1. ✅ Added detailed console logging for debugging
2. ✅ Added 15-second timeout fallback (will show interface anyway)
3. ✅ Better error messages with reload option
4. ✅ Loading message updates to show progress

### How to Debug:

#### Step 1: Open Browser Console
**On Desktop:**
- Press `F12` or right-click → Inspect → Console tab

**On Mobile:**
- iOS Safari: Settings → Safari → Advanced → Web Inspector
- Android Chrome: Use Chrome DevTools via USB debugging

#### Step 2: Look for Logs
You should see:
```
VideoCallJitsi mounted {roomId: "...", userId: "...", userName: "..."}
Loading Jitsi script...
Jitsi script loaded successfully
Initializing Jitsi...
Creating Jitsi meeting: {domain: "meet.jit.si", roomName: "MedMeet_...", userName: "..."}
Jitsi API created, waiting for events...
✅ User joined the conference: {...}
```

#### Step 3: Identify the Issue

**If you see: "Failed to load Jitsi script"**
- **Problem:** Can't load from meet.jit.si
- **Solution:** 
  - Check internet connection
  - Try different network (mobile data vs WiFi)
  - Check if firewall is blocking meet.jit.si
  - Try in incognito/private mode

**If you see: "Container ref not available"**
- **Problem:** React rendering issue
- **Solution:**
  - Refresh the page
  - Clear browser cache
  - Try different browser

**If you see: "Jitsi error occurred"**
- **Problem:** Jitsi-specific error
- **Solution:**
  - Check the error message in console
  - Ensure camera/mic permissions granted
  - Try at https://meet.jit.si/test to verify Jitsi works

**If logs stop after "Jitsi API created"**
- **Problem:** Waiting for permissions or Jitsi initialization
- **Solution:**
  - Check browser permission popup (might be hidden)
  - Wait 15 seconds (timeout will show interface)
  - Check if camera is in use by another app

**If you see network errors**
- **Problem:** Can't connect to Jitsi servers
- **Solution:**
  - Check internet speed (need at least 1 Mbps)
  - Disable VPN
  - Try different browser

### Quick Fixes:

#### Fix 1: Refresh the Page
```
Click "Reload Page" button or press Ctrl+R (Cmd+R on Mac)
```

#### Fix 2: Clear Permissions
**Chrome:**
1. Click lock icon in address bar
2. Click "Site settings"
3. Reset camera/microphone permissions
4. Refresh and allow again

**Safari:**
1. Safari → Settings → Websites
2. Find your site under Camera/Microphone
3. Remove and try again

#### Fix 3: Different Browser
- Try Chrome if using Safari
- Try Firefox if using Chrome
- Try Edge if on Windows

#### Fix 4: Check Camera/Mic
1. Close all other apps using camera (Zoom, Teams, etc.)
2. Test camera at: https://webcamtests.com
3. Test mic at: https://www.onlinemictest.com

### Testing Jitsi Directly

Visit: https://meet.jit.si/TestRoom123

If this works:
- ✅ Jitsi is accessible
- ✅ Your camera/mic work
- ✅ Network is fine
- ❌ Issue is in our integration

If this doesn't work:
- ❌ Problem with Jitsi service or your network
- Try different network/browser

### Platform-Specific Issues:

#### iOS Safari:
- Camera/mic permissions are per-session
- May need to allow each time
- Works better in-app browser sometimes

#### Android Chrome:
- Check Android app permissions
- Settings → Apps → Chrome → Permissions
- Enable Camera and Microphone

#### Desktop Chrome:
- Check system permissions (especially Mac)
- System Preferences → Security & Privacy → Camera/Microphone

### Network Issues:

#### Behind Corporate Firewall:
- Jitsi uses ports 443 (HTTPS) and 10000 (UDP)
- WebRTC might be blocked
- Try mobile data instead

#### Slow Internet:
- Need minimum 1 Mbps up/down
- Test at: https://www.speedtest.net
- Close bandwidth-heavy apps

#### VPN Issues:
- Some VPNs block WebRTC
- Temporarily disable and test
- Or use VPN that supports WebRTC

### Still Not Working?

#### Option 1: Wait for Timeout
- After 15 seconds, interface shows anyway
- Some features might not work but you can try

#### Option 2: Alternative Meeting Link
If you have Jitsi working at meet.jit.si/test:
1. Note the room name: `MedMeet_{appointment_id}`
2. Join directly at: `https://meet.jit.si/MedMeet_{appointment_id}`
3. Both users use same link

#### Option 3: Use Different Device
- If desktop fails, try mobile
- If WiFi fails, try mobile data
- If one browser fails, try another

### Getting More Help:

#### What to Share:
1. Browser console logs (copy all text)
2. Browser and version (Chrome 120, Safari 17, etc.)
3. Device type (iPhone 15, Windows 11, etc.)
4. Network type (Home WiFi, Office, Mobile data)
5. Error messages shown

#### Where to Check:
- Browser console (F12)
- Network tab in DevTools
- Jitsi test page results

### Prevention:

Before important calls:
1. ✅ Test camera/mic: https://webcamtests.com
2. ✅ Test Jitsi: https://meet.jit.si/test
3. ✅ Close other video apps
4. ✅ Use Chrome for best compatibility
5. ✅ Have good internet (3+ Mbps)
6. ✅ Allow permissions when asked
7. ✅ Join 5 minutes early to troubleshoot

### Emergency Backup:

If video completely fails:
1. Both users go to: https://meet.jit.si/MedMeetBackup123
2. Or use phone call as backup
3. Or reschedule when technical issues resolved

### Success Indicators:

You know it's working when:
- ✅ Console shows: "User joined the conference"
- ✅ Loading screen disappears
- ✅ You see Jitsi interface
- ✅ Your video appears
- ✅ Toolbar buttons visible
- ✅ Can toggle mic/camera
