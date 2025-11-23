'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Video, VideoOff, Mic, MicOff, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SimplePeer from 'simple-peer'

export default function VideoCall({ roomId, userId, userName, onLeave }) {
  const [participants, setParticipants] = useState([])
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('Connecting...')
  const [isInitiator, setIsInitiator] = useState(false)
  
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerRef = useRef(null)
  const pollingIntervalRef = useRef(null)
  const streamRef = useRef(null)
  const processedSignalsRef = useRef(new Set())

  useEffect(() => {
    initializeCall()
    return () => {
      cleanup()
    }
  }, [])

  const initializeCall = async () => {
    try {
      setConnectionStatus('Getting camera access...')
      
      // Get local media stream first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      })
      
      streamRef.current = stream
      setLocalStream(stream)
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      setConnectionStatus('Joining room...')
      
      // Join room and check if we're first
      const amIFirst = await joinRoom()
      setIsInitiator(amIFirst)
      
      if (amIFirst) {
        setConnectionStatus('Waiting for other participant...')
      } else {
        setConnectionStatus('Found participant, connecting...')
        // If there's already someone, create peer as non-initiator
        setTimeout(() => createPeer(false, stream), 500)
      }
      
      // Start polling
      startPolling()
    } catch (error) {
      console.error('Failed to initialize call:', error)
      setConnectionStatus('Failed to access camera/microphone. Please allow permissions.')
    }
  }

  const joinRoom = async () => {
    // Check if there are existing participants first
    const { data: existingParticipants } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .neq('user_id', userId)
    
    const amIFirst = !existingParticipants || existingParticipants.length === 0
    
    const participantId = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await supabase.from('room_participants').insert([{
      id: participantId,
      room_id: roomId,
      user_id: userId,
      user_name: userName,
      joined_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    }])
    
    return amIFirst
  }

  const checkParticipants = async () => {
    const { data } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .neq('user_id', userId)
    
    if (data && data.length > 0) {
      setParticipants(data)
      // If there's another participant, initiate connection
      if (!peerRef.current) {
        initiateConnection(true)
      }
    }
  }

  const updateLastSeen = async () => {
    await supabase
      .from('room_participants')
      .update({ last_seen: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId)
  }

  const startPolling = () => {
    // Poll for participants and signals every 2 seconds
    pollingIntervalRef.current = setInterval(async () => {
      await updateLastSeen()
      await checkParticipants()
      await checkForSignals()
    }, 2000)
  }

  const initiateConnection = (isInitiator) => {
    if (peerRef.current) return

    setConnectionStatus(isInitiator ? 'Initiating connection...' : 'Waiting for peer...')

    const peer = new SimplePeer({
      initiator: isInitiator,
      stream: localStream,
      trickle: true
    })

    peer.on('signal', async (signal) => {
      // Send signal to other peer via database
      const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await supabase.from('webrtc_signals').insert([{
        id: signalId,
        room_id: roomId,
        user_id: userId,
        signal_type: signal.type === 'offer' ? 'offer' : signal.type === 'answer' ? 'answer' : 'ice-candidate',
        signal_data: signal,
        created_at: new Date().toISOString()
      }])
    })

    peer.on('stream', (stream) => {
      setRemoteStream(stream)
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
      }
      setConnectionStatus('Connected')
    })

    peer.on('connect', () => {
      setConnectionStatus('Connected')
    })

    peer.on('error', (err) => {
      console.error('Peer error:', err)
      setConnectionStatus('Connection error')
    })

    peerRef.current = peer
  }

  const checkForSignals = async () => {
    try {
      const { data } = await supabase
        .from('webrtc_signals')
        .select('*')
        .eq('room_id', roomId)
        .neq('user_id', userId)
        .order('created_at', { ascending: true })
      
      if (data && data.length > 0) {
        for (const signal of data) {
          if (peerRef.current) {
            try {
              peerRef.current.signal(signal.signal_data)
            } catch (error) {
              console.error('Error processing signal:', error)
            }
          } else if (signal.signal_type === 'offer') {
            // We received an offer, create peer as non-initiator
            initiateConnection(false)
            setTimeout(() => {
              if (peerRef.current) {
                peerRef.current.signal(signal.signal_data)
              }
            }, 100)
          }
          
          // Delete processed signal
          await supabase
            .from('webrtc_signals')
            .delete()
            .eq('id', signal.id)
        }
      }
    } catch (error) {
      console.error('Error checking signals:', error)
    }
  }

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      setAudioEnabled(!audioEnabled)
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      setVideoEnabled(!videoEnabled)
    }
  }

  const cleanup = async () => {
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Close peer connection
    if (peerRef.current) {
      peerRef.current.destroy()
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }

    // Remove from room
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId)
    
    // Clean up old signals
    await supabase
      .from('webrtc_signals')
      .delete()
      .eq('room_id', roomId)
  }

  const handleLeave = async () => {
    await cleanup()
    onLeave()
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-6 h-6 text-white" />
          <div>
            <h2 className="text-white font-semibold">Video Call</h2>
            <p className="text-gray-400 text-sm">{connectionStatus}</p>
          </div>
        </div>
        <Button onClick={handleLeave} variant="destructive" size="sm">
          <Phone className="w-4 h-4 mr-2" />
          Leave Call
        </Button>
      </div>
      
      {/* Video Grid */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-6xl">
          {/* Local Video */}
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border-4 border-blue-500">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-2 rounded-lg">
              <p className="text-white text-sm font-semibold">{userName} (You)</p>
              <p className="text-gray-300 text-xs">
                {videoEnabled ? 'Video Active' : 'Video Off'}
              </p>
            </div>
            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <VideoOff className="w-16 h-16 text-gray-500" />
              </div>
            )}
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
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-2 rounded-lg">
                  <p className="text-white text-sm font-semibold">
                    {participants[0]?.user_name || 'Participant'}
                  </p>
                  <p className="text-gray-300 text-xs">Connected</p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
                    <Video className="w-12 h-12 text-white" />
                  </div>
                  <p className="text-white text-lg font-semibold">
                    {participants.length > 0 ? participants[0].user_name : 'Waiting for participant'}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {participants.length > 0 ? connectionStatus : 'Waiting to connect...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
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
        
        <div className="text-center mt-4">
          <p className="text-gray-400 text-sm">Room ID: {roomId}</p>
          <p className="text-gray-500 text-xs mt-1">
            Participants: {participants.length + 1}
          </p>
        </div>
      </div>
    </div>
  )
}