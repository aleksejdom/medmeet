'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Video, VideoOff, Mic, MicOff, Phone, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function VideoCallPure({ roomId, userId, userName, onLeave }) {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [connectionState, setConnectionState] = useState('Initializing...')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [error, setError] = useState(null)
  
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const pollingIntervalRef = useRef(null)
  const localStreamRef = useRef(null)
  const iceCandidatesRef = useRef([])
  const isInitiatorRef = useRef(false)

  useEffect(() => {
    initializeCall()
    return () => cleanup()
  }, [])

  const initializeCall = async () => {
    try {
      setConnectionState('Getting camera access...')
      
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true }
      })
      
      localStreamRef.current = stream
      setLocalStream(stream)
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Join room and determine role
      setConnectionState('Joining room...')
      const amIFirst = await joinRoom()
      isInitiatorRef.current = amIFirst
      
      // Create peer connection
      createPeerConnection(stream)
      
      if (amIFirst) {
        setConnectionState('Waiting for other participant...')
        // Initiator waits for other peer
      } else {
        setConnectionState('Connecting to participant...')
        // Non-initiator creates and sends offer immediately
        setTimeout(() => createAndSendOffer(), 1000)
      }
      
      // Start polling for signals
      startPolling()
      
    } catch (err) {
      console.error('Failed to initialize:', err)
      setError(`Camera/microphone error: ${err.message}`)
      setConnectionState('Failed')
    }
  }

  const joinRoom = async () => {
    // Check if anyone else is in the room
    const { data: existing } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .neq('user_id', userId)
    
    // Add myself to the room
    const participantId = `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await supabase.from('room_participants').insert({
      id: participantId,
      room_id: roomId,
      user_id: userId,
      user_name: userName,
      joined_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    })
    
    return !existing || existing.length === 0
  }

  const createPeerConnection = (stream) => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }
    
    const pc = new RTCPeerConnection(config)
    peerConnectionRef.current = pc
    
    // Add local stream tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream)
    })
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate
        })
      }
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track')
      const remoteStream = event.streams[0]
      setRemoteStream(remoteStream)
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }
      setConnectionState('Connected')
    }
    
    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        setConnectionState('Connected')
      } else if (pc.connectionState === 'failed') {
        setConnectionState('Connection failed')
        setError('Connection failed. Please try reconnecting.')
      } else if (pc.connectionState === 'disconnected') {
        setConnectionState('Disconnected')
      }
    }
    
    // ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'checking') {
        setConnectionState('Connecting...')
      }
    }
  }

  const createAndSendOffer = async () => {
    const pc = peerConnectionRef.current
    if (!pc) return
    
    try {
      setConnectionState('Creating offer...')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      await sendSignal({
        type: 'offer',
        sdp: offer
      })
      
      setConnectionState('Waiting for answer...')
    } catch (err) {
      console.error('Error creating offer:', err)
      setError('Failed to create connection offer')
    }
  }

  const handleOffer = async (offer) => {
    const pc = peerConnectionRef.current
    if (!pc) return
    
    try {
      setConnectionState('Receiving offer...')
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      
      // Create answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      await sendSignal({
        type: 'answer',
        sdp: answer
      })
      
      // Add any queued ICE candidates
      for (const candidate of iceCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
      iceCandidatesRef.current = []
      
      setConnectionState('Connecting...')
    } catch (err) {
      console.error('Error handling offer:', err)
      setError('Failed to handle connection offer')
    }
  }

  const handleAnswer = async (answer) => {
    const pc = peerConnectionRef.current
    if (!pc) return
    
    try {
      setConnectionState('Receiving answer...')
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
      
      // Add any queued ICE candidates
      for (const candidate of iceCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
      iceCandidatesRef.current = []
      
      setConnectionState('Connecting...')
    } catch (err) {
      console.error('Error handling answer:', err)
      setError('Failed to handle connection answer')
    }
  }

  const handleIceCandidate = async (candidate) => {
    const pc = peerConnectionRef.current
    if (!pc) return
    
    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } else {
        // Queue candidates until remote description is set
        iceCandidatesRef.current.push(candidate)
      }
    } catch (err) {
      console.error('Error adding ICE candidate:', err)
    }
  }

  const sendSignal = async (signal) => {
    try {
      const signalId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await supabase.from('webrtc_signals').insert({
        id: signalId,
        room_id: roomId,
        user_id: userId,
        signal_type: signal.type,
        signal_data: signal,
        created_at: new Date().toISOString()
      })
    } catch (err) {
      console.error('Error sending signal:', err)
    }
  }

  const startPolling = () => {
    // Update presence
    pollingIntervalRef.current = setInterval(async () => {
      // Update last seen
      await supabase
        .from('room_participants')
        .update({ last_seen: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', userId)
      
      // Check for signals
      await checkForSignals()
      
      // Check if other participant joined (for initiator)
      if (isInitiatorRef.current && !peerConnectionRef.current?.remoteDescription) {
        await checkForParticipant()
      }
    }, 1000)
  }

  const checkForParticipant = async () => {
    const { data } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .neq('user_id', userId)
    
    if (data && data.length > 0 && !peerConnectionRef.current?.localDescription) {
      // Other participant joined, create offer
      setConnectionState('Participant joined! Connecting...')
      await createAndSendOffer()
    }
  }

  const checkForSignals = async () => {
    try {
      const { data: signals } = await supabase
        .from('webrtc_signals')
        .select('*')
        .eq('room_id', roomId)
        .neq('user_id', userId)
        .order('created_at', { ascending: true })
      
      if (!signals || signals.length === 0) return
      
      for (const signal of signals) {
        const signalData = signal.signal_data
        
        if (signal.signal_type === 'offer') {
          await handleOffer(signalData.sdp)
        } else if (signal.signal_type === 'answer') {
          await handleAnswer(signalData.sdp)
        } else if (signal.signal_type === 'ice-candidate') {
          await handleIceCandidate(signalData.candidate)
        }
        
        // Delete processed signal
        await supabase
          .from('webrtc_signals')
          .delete()
          .eq('id', signal.id)
      }
    } catch (err) {
      console.error('Error checking signals:', err)
    }
  }

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setAudioEnabled(audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setVideoEnabled(videoTrack.enabled)
      }
    }
  }

  const reconnect = () => {
    cleanup()
    setError(null)
    setConnectionState('Reconnecting...')
    setTimeout(() => initializeCall(), 1000)
  }

  const cleanup = async () => {
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    
    // Remove from room
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId)
    
    // Clean up signals
    await supabase
      .from('webrtc_signals')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId)
  }

  const handleLeave = async () => {
    await cleanup()
    onLeave()
  }

  if (error && !localStream) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Video className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={reconnect} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={handleLeave} variant="outline" className="w-full">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Video Call</h2>
            <p className="text-sm text-gray-400">{connectionState}</p>
          </div>
          <Button onClick={handleLeave} variant="destructive" size="sm">
            <Phone className="w-4 h-4 mr-2" />
            Leave Call
          </Button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-6xl">
          {/* Local Video */}
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!videoEnabled && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <span className="text-2xl text-white">{userName.charAt(0).toUpperCase()}</span>
                  </div>
                  <p className="text-white text-sm">Camera Off</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 px-3 py-1 rounded">
              <p className="text-white text-sm font-medium">You ({userName})</p>
            </div>
          </div>

          {/* Remote Video */}
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
            {remoteStream ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 px-3 py-1 rounded">
                  <p className="text-white text-sm font-medium">Other Participant</p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
                    <Video className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-white font-medium">Waiting for participant...</p>
                  <p className="text-gray-400 text-sm mt-2">{connectionState}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-6">
        <div className="max-w-md mx-auto flex items-center justify-center gap-4">
          <Button
            onClick={toggleAudio}
            variant={audioEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </Button>
          
          <Button
            onClick={toggleVideo}
            variant={videoEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </Button>

          {error && (
            <Button
              onClick={reconnect}
              variant="outline"
              size="lg"
              className="rounded-full w-14 h-14"
            >
              <RefreshCw className="w-6 h-6" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
