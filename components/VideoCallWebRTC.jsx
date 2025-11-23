'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Video, VideoOff, Mic, MicOff, Phone, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function VideoCallWebRTC({ roomId, userId, userName, onLeave }) {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [status, setStatus] = useState('Initializing...')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [connectionState, setConnectionState] = useState('new')
  
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const candidateQueueRef = useRef([])
  const isPollingRef = useRef(false)

  useEffect(() => {
    init()
    return () => cleanup()
  }, [])

  const init = async () => {
    try {
      setStatus('Getting camera and microphone...')
      
      // Get media first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      })
      
      localStreamRef.current = stream
      setLocalStream(stream)
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      setStatus('Setting up connection...')
      
      // Create peer connection
      const pc = createPeerConnection(stream)
      pcRef.current = pc

      // Register in room
      await registerInRoom()

      // Start coordinating
      startCoordination()

    } catch (err) {
      console.error('Init error:', err)
      setStatus('Error: ' + err.message)
      toast.error('Failed to access camera/microphone. Please allow permissions.')
    }
  }

  const createPeerConnection = (stream) => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    }

    const pc = new RTCPeerConnection(config)

    // Add tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream)
      console.log('Added track:', track.kind)
    })

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('🎥 Remote track received:', event.track.kind)
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0])
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
        setStatus('Connected!')
        setConnectionState('connected')
        toast.success('Connected to other participant!')
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📤 Sending ICE candidate')
        sendToDatabase({
          type: 'candidate',
          candidate: event.candidate.toJSON()
        })
      }
    }

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState)
      setConnectionState(pc.connectionState)
      
      if (pc.connectionState === 'connected') {
        setStatus('Connected!')
      } else if (pc.connectionState === 'failed') {
        setStatus('Connection failed')
        toast.error('Connection failed. Click retry button.')
      } else if (pc.connectionState === 'disconnected') {
        setStatus('Disconnected')
      }
    }

    // ICE state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'checking') {
        setStatus('Connecting...')
      } else if (pc.iceConnectionState === 'connected') {
        setStatus('Connected!')
      } else if (pc.iceConnectionState === 'failed') {
        setStatus('Connection failed - Click retry')
      }
    }

    return pc
  }

  const registerInRoom = async () => {
    // Upsert to avoid duplicates
    await supabase.from('room_participants').upsert({
      id: `${roomId}_${userId}`,
      room_id: roomId,
      user_id: userId,
      user_name: userName,
      joined_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    }, { onConflict: 'id' })

    console.log('✅ Registered in room')
  }

  const startCoordination = () => {
    if (isPollingRef.current) return
    isPollingRef.current = true

    setStatus('Looking for other participant...')
    
    const interval = setInterval(async () => {
      await updatePresence()
      await checkForOtherParticipant()
      await processSignals()
    }, 1000)

    // Store for cleanup
    window.videoCallInterval = interval
  }

  const updatePresence = async () => {
    await supabase.from('room_participants')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', `${roomId}_${userId}`)
  }

  const checkForOtherParticipant = async () => {
    const pc = pcRef.current
    if (!pc || pc.connectionState === 'connected') return

    const { data } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .neq('user_id', userId)

    if (data && data.length > 0) {
      // Other participant found
      if (!pc.localDescription) {
        console.log('🚀 Other participant found, creating offer')
        setStatus('Other participant found, connecting...')
        await createOffer()
      }
    }
  }

  const createOffer = async () => {
    const pc = pcRef.current
    if (!pc || pc.signalingState !== 'stable') return

    try {
      console.log('Creating offer...')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      await sendToDatabase({
        type: 'offer',
        sdp: offer.sdp
      })
      
      console.log('✅ Offer sent')
      setStatus('Offer sent, waiting for answer...')
    } catch (err) {
      console.error('Error creating offer:', err)
    }
  }

  const processSignals = async () => {
    const pc = pcRef.current
    if (!pc) return

    const { data: signals } = await supabase
      .from('webrtc_signals')
      .select('*')
      .eq('room_id', roomId)
      .neq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!signals || signals.length === 0) return

    for (const signal of signals) {
      try {
        const data = signal.signal_data

        if (data.type === 'offer' && pc.signalingState === 'stable') {
          console.log('📥 Received offer')
          setStatus('Received offer, creating answer...')
          
          await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: data.sdp
          }))
          
          // Process queued candidates
          while (candidateQueueRef.current.length > 0) {
            const candidate = candidateQueueRef.current.shift()
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          }
          
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          
          await sendToDatabase({
            type: 'answer',
            sdp: answer.sdp
          })
          
          console.log('✅ Answer sent')
          setStatus('Answer sent, establishing connection...')
          
        } else if (data.type === 'answer' && pc.signalingState === 'have-local-offer') {
          console.log('📥 Received answer')
          setStatus('Received answer, connecting...')
          
          await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: data.sdp
          }))
          
          // Process queued candidates
          while (candidateQueueRef.current.length > 0) {
            const candidate = candidateQueueRef.current.shift()
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          }
          
        } else if (data.type === 'candidate') {
          console.log('📥 ICE candidate')
          
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          } else {
            // Queue until remote description is set
            candidateQueueRef.current.push(data.candidate)
          }
        }

        // Delete processed signal
        await supabase.from('webrtc_signals').delete().eq('id', signal.id)
        
      } catch (err) {
        console.error('Error processing signal:', err)
        // Delete bad signal
        await supabase.from('webrtc_signals').delete().eq('id', signal.id)
      }
    }
  }

  const sendToDatabase = async (data) => {
    try {
      await supabase.from('webrtc_signals').insert({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        room_id: roomId,
        user_id: userId,
        signal_type: data.type,
        signal_data: data,
        created_at: new Date().toISOString()
      })
    } catch (err) {
      console.error('Error sending to database:', err)
    }
  }

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0]
      if (track) {
        track.enabled = !track.enabled
        setAudioEnabled(track.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0]
      if (track) {
        track.enabled = !track.enabled
        setVideoEnabled(track.enabled)
      }
    }
  }

  const retry = () => {
    cleanup()
    setTimeout(() => init(), 1000)
  }

  const cleanup = async () => {
    console.log('Cleaning up...')
    
    if (window.videoCallInterval) {
      clearInterval(window.videoCallInterval)
      window.videoCallInterval = null
    }
    
    isPollingRef.current = false
    
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    
    try {
      await supabase.from('room_participants').delete().eq('id', `${roomId}_${userId}`)
      await supabase.from('webrtc_signals').delete().eq('room_id', roomId).eq('user_id', userId)
    } catch (err) {
      console.error('Cleanup error:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">{userName}</h2>
            <p className="text-sm text-gray-400">{status}</p>
          </div>
          <Button onClick={onLeave} variant="destructive" size="sm">
            <Phone className="w-4 h-4 mr-2" />
            Leave
          </Button>
        </div>
      </div>

      {/* Videos */}
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-6xl">
          {/* Local */}
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border-2 border-blue-500">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
            {!videoEnabled && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-blue-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <span className="text-3xl text-white">{userName.charAt(0).toUpperCase()}</span>
                  </div>
                  <p className="text-white text-sm">Camera Off</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 px-3 py-2 rounded">
              <p className="text-white text-sm font-medium">You</p>
            </div>
          </div>

          {/* Remote */}
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
            {remoteStream ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 px-3 py-2 rounded">
                  <p className="text-white text-sm font-medium">Other Participant</p>
                  <p className="text-green-400 text-xs">● Connected</p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-pulse mb-4">
                    <Video className="w-16 h-16 text-gray-400 mx-auto" />
                  </div>
                  <p className="text-white font-medium mb-2">Waiting for other participant...</p>
                  <p className="text-gray-400 text-sm">{status}</p>
                  {connectionState === 'checking' && (
                    <div className="mt-4">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-6">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={toggleAudio}
              variant={audioEnabled ? 'secondary' : 'destructive'}
              size="lg"
              className="rounded-full w-14 h-14"
              title={audioEnabled ? 'Mute' : 'Unmute'}
            >
              {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </Button>
            
            <Button
              onClick={toggleVideo}
              variant={videoEnabled ? 'secondary' : 'destructive'}
              size="lg"
              className="rounded-full w-14 h-14"
              title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </Button>

            {(connectionState === 'failed' || connectionState === 'disconnected') && (
              <Button
                onClick={retry}
                variant="outline"
                size="lg"
                className="rounded-full w-14 h-14"
                title="Retry connection"
              >
                <RefreshCw className="w-6 h-6" />
              </Button>
            )}
          </div>
        </div>
        
        <p className="text-center text-gray-400 text-xs mt-4">
          Room: {roomId} • State: {connectionState}
        </p>
      </div>
    </div>
  )
}
