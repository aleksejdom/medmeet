'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Video, VideoOff, Mic, MicOff, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function VideoCallSimpleWebRTC({ roomId, userId, userName, onLeave }) {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [status, setStatus] = useState('Connecting...')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    startCall()
    return () => cleanup()
  }, [])

  const startCall = async () => {
    try {
      // Get camera/mic
      setStatus('Getting camera access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      
      streamRef.current = stream
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // Create peer connection
      setStatus('Creating connection...')
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      })
      pcRef.current = pc

      // Add local tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Got remote stream')
        setRemoteStream(event.streams[0])
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
        setStatus('Connected')
        toast.success('Connected to other participant!')
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ type: 'candidate', candidate: event.candidate })
        }
      }

      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState)
        if (pc.connectionState === 'connected') {
          setStatus('Connected')
        } else if (pc.connectionState === 'failed') {
          setStatus('Connection failed')
          toast.error('Connection failed. Try refreshing.')
        }
      }

      // Wait a bit then check room
      setTimeout(() => checkAndConnect(pc), 1000)

      // Poll for signals
      const interval = setInterval(() => checkSignals(pc), 1000)
      return () => clearInterval(interval)

    } catch (err) {
      console.error('Error:', err)
      setStatus('Error: ' + err.message)
      toast.error('Failed to access camera/microphone')
    }
  }

  const checkAndConnect = async (pc) => {
    try {
      // Check if anyone else is in room
      const { data: others } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId)
        .neq('user_id', userId)

      console.log('Found other participants:', others?.length || 0)

      // Add myself
      await supabase.from('room_participants').upsert({
        id: `${roomId}_${userId}`,
        room_id: roomId,
        user_id: userId,
        user_name: userName,
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      })

      if (others && others.length > 0) {
        // Someone else is here, I'll create offer immediately
        setStatus('Other participant found, connecting...')
        console.log('Other participant found, creating offer')
        setTimeout(() => createOffer(pc), 500)
      } else {
        // I'm first, wait for other
        setStatus('Waiting for other participant...')
        console.log('I am first, will wait for other to join')
        setTimeout(() => createOffer(pc), 2000)
      }
    } catch (err) {
      console.error('Error checking room:', err)
    }
  }

  const createOffer = async (pc) => {
    try {
      // Check if we already have remote description (already connected)
      if (pc.remoteDescription) {
        console.log('Already connected, skipping offer')
        return
      }

      // Check if other user joined
      const { data: others } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId)
        .neq('user_id', userId)

      if (!others || others.length === 0) {
        // Still alone, check again in 2 seconds
        console.log('Still alone, checking again in 2s...')
        setTimeout(() => createOffer(pc), 2000)
        return
      }

      console.log('Creating offer...')
      setStatus('Creating connection offer...')
      
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      await sendSignal({
        type: 'offer',
        offer: offer
      })
      
      console.log('Offer sent successfully')
      setStatus('Waiting for answer...')
    } catch (err) {
      console.error('Error creating offer:', err)
      setStatus('Error creating offer')
    }
  }

  const checkSignals = async (pc) => {
    try {
      const { data: signals } = await supabase
        .from('webrtc_signals')
        .select('*')
        .eq('room_id', roomId)
        .neq('user_id', userId)
        .order('created_at', { ascending: true })

      if (!signals || signals.length === 0) return

      for (const signal of signals) {
        const data = signal.signal_data

        if (data.type === 'offer') {
          console.log('Received offer')
          setStatus('Connecting...')
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
          
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          
          await sendSignal({
            type: 'answer',
            answer: answer
          })
          
          console.log('Answer sent')
        } else if (data.type === 'answer') {
          console.log('Received answer')
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
        } else if (data.type === 'candidate') {
          console.log('Received ICE candidate')
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        }

        // Delete signal
        await supabase.from('webrtc_signals').delete().eq('id', signal.id)
      }
    } catch (err) {
      console.error('Error checking signals:', err)
    }
  }

  const sendSignal = async (data) => {
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
      console.error('Error sending signal:', err)
    }
  }

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setAudioEnabled(audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setVideoEnabled(videoTrack.enabled)
      }
    }
  }

  const cleanup = async () => {
    if (pcRef.current) {
      pcRef.current.close()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Video Call - {userName}</h2>
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
                <div className="text-white text-4xl">{userName.charAt(0).toUpperCase()}</div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 px-3 py-1 rounded">
              <p className="text-white text-sm">You</p>
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
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 px-3 py-1 rounded">
                  <p className="text-white text-sm">Other Participant</p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-pulse mb-4">
                    <Video className="w-16 h-16 text-gray-400 mx-auto" />
                  </div>
                  <p className="text-white">Waiting for other participant...</p>
                  <p className="text-gray-400 text-sm mt-2">{status}</p>
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
        </div>
        <p className="text-center text-gray-400 text-xs mt-4">
          Room: {roomId} • Both users must join within 30 seconds
        </p>
      </div>
    </div>
  )
}
