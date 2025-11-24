'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'

export default function VideoCallSupabase({ appointmentId, onLeave }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('Initializing...')

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const supabaseChannelRef = useRef(null)
  const supabaseClientRef = useRef(null)
  const iceCandidatesQueueRef = useRef([])
  const isInitiatorRef = useRef(false)
  const hasReceivedOfferRef = useRef(false)

  // Initialize WebRTC and Supabase signaling
  useEffect(() => {
    let mounted = true

    const initializeCall = async () => {
      try {
        // Initialize Supabase client
        supabaseClientRef.current = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        setConnectionStatus('Getting camera and microphone access...')
        
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        
        if (!mounted) return

        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        setConnectionStatus('Setting up connection...')

        // Create RTCPeerConnection
        const configuration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
          ]
        }

        const peerConnection = new RTCPeerConnection(configuration)
        peerConnectionRef.current = peerConnection

        // Add local stream tracks to peer connection
        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream)
        })

        // Handle incoming tracks
        remoteStreamRef.current = new MediaStream()
        
        peerConnection.ontrack = (event) => {
          console.log('Received remote track:', event.track.kind, event)
          
          // Add track to remote stream
          if (event.track && remoteStreamRef.current) {
            remoteStreamRef.current.addTrack(event.track)
            console.log('Added track to remote stream. Total tracks:', remoteStreamRef.current.getTracks().length)
          }
          
          // Set the stream on the video element
          if (remoteVideoRef.current && remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current
            console.log('Set remote video srcObject. Video tracks:', remoteStreamRef.current.getVideoTracks().length)
          }
          
          // Update connection status when we have both audio and video
          if (remoteStreamRef.current) {
            const videoTracks = remoteStreamRef.current.getVideoTracks()
            const audioTracks = remoteStreamRef.current.getAudioTracks()
            
            if (videoTracks.length > 0 || audioTracks.length > 0) {
              setIsConnected(true)
              setConnectionStatus('Connected')
              toast.success('Video call connected!')
            }
          }
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && supabaseChannelRef.current) {
            console.log('Sending ICE candidate')
            supabaseChannelRef.current.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: { candidate: event.candidate }
            })
          }
        }

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
          console.log('Connection state:', peerConnection.connectionState)
          switch (peerConnection.connectionState) {
            case 'connected':
              setConnectionStatus('Connected')
              setIsConnected(true)
              toast.success('Video call connected!')
              break
            case 'disconnected':
              setConnectionStatus('Disconnected')
              setIsConnected(false)
              break
            case 'failed':
              setConnectionStatus('Connection failed')
              toast.error('Connection failed. Please try again.')
              break
            case 'closed':
              setConnectionStatus('Connection closed')
              setIsConnected(false)
              break
          }
        }

        // Subscribe to Supabase Realtime channel for signaling
        const channel = supabaseClientRef.current.channel(`video-call-${appointmentId}`)
        supabaseChannelRef.current = channel

        channel
          .on('broadcast', { event: 'ready' }, async ({ payload }) => {
            console.log('Peer is ready')
            // If we haven't received an offer and we're not the initiator, we become the initiator
            if (!hasReceivedOfferRef.current && !isInitiatorRef.current) {
              isInitiatorRef.current = true
              console.log('Becoming initiator')
              
              // Wait a bit to ensure peer is set up
              await new Promise(resolve => setTimeout(resolve, 500))
              
              try {
                const offer = await peerConnection.createOffer()
                await peerConnection.setLocalDescription(offer)
                
                channel.send({
                  type: 'broadcast',
                  event: 'offer',
                  payload: { offer }
                })
                
                console.log('Sent offer')
                setConnectionStatus('Calling...')
              } catch (error) {
                console.error('Error creating offer:', error)
                toast.error('Failed to initiate call')
              }
            }
          })
          .on('broadcast', { event: 'offer' }, async ({ payload }) => {
            console.log('Received offer')
            hasReceivedOfferRef.current = true
            
            try {
              if (peerConnection.signalingState !== 'stable') {
                console.log('Signaling state not stable, ignoring offer')
                return
              }
              
              await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer))
              
              // Process queued ICE candidates
              while (iceCandidatesQueueRef.current.length > 0) {
                const candidate = iceCandidatesQueueRef.current.shift()
                try {
                  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                } catch (e) {
                  console.error('Error adding queued candidate:', e)
                }
              }
              
              const answer = await peerConnection.createAnswer()
              await peerConnection.setLocalDescription(answer)
              
              channel.send({
                type: 'broadcast',
                event: 'answer',
                payload: { answer }
              })
              
              console.log('Sent answer')
              setConnectionStatus('Connecting...')
            } catch (error) {
              console.error('Error handling offer:', error)
              toast.error('Failed to process call offer')
            }
          })
          .on('broadcast', { event: 'answer' }, async ({ payload }) => {
            console.log('Received answer')
            try {
              if (peerConnection.signalingState === 'have-local-offer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer))
                
                // Process queued ICE candidates
                while (iceCandidatesQueueRef.current.length > 0) {
                  const candidate = iceCandidatesQueueRef.current.shift()
                  try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                  } catch (e) {
                    console.error('Error adding queued candidate:', e)
                  }
                }
                
                setConnectionStatus('Connecting...')
              }
            } catch (error) {
              console.error('Error handling answer:', error)
            }
          })
          .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
            console.log('Received ICE candidate')
            try {
              if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate))
              } else {
                // Queue candidates until remote description is set
                iceCandidatesQueueRef.current.push(payload.candidate)
              }
            } catch (error) {
              console.error('Error adding ICE candidate:', error)
            }
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscribed to channel')
              setConnectionStatus('Waiting for other participant...')
              
              // Announce we're ready
              channel.send({
                type: 'broadcast',
                event: 'ready',
                payload: { timestamp: Date.now() }
              })
              
              console.log('Sent ready signal')
            }
          })

      } catch (error) {
        console.error('Error initializing call:', error)
        toast.error('Failed to access camera/microphone')
        setConnectionStatus('Failed to initialize')
      }
    }

    initializeCall()

    // Cleanup
    return () => {
      mounted = false
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      
      if (supabaseChannelRef.current) {
        supabaseClientRef.current.removeChannel(supabaseChannelRef.current)
      }
    }
  }, [appointmentId])

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
      }
    }
  }

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }

  // Leave call
  const handleLeave = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
    if (supabaseChannelRef.current && supabaseClientRef.current) {
      supabaseClientRef.current.removeChannel(supabaseChannelRef.current)
    }
    onLeave()
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Video Consultation</h2>
            <p className="text-sm text-blue-100">{connectionStatus}</p>
          </div>
          <Button 
            onClick={handleLeave}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            Leave Call
          </Button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-900">
        {/* Local Video */}
        <Card className="relative bg-gray-800 border-gray-700 overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded text-white text-sm">
            You
          </div>
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff className="h-16 w-16 text-gray-400" />
            </div>
          )}
        </Card>

        {/* Remote Video */}
        <Card className="relative bg-gray-800 border-gray-700 overflow-hidden">
          {isConnected ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded text-white text-sm">
                Other Participant
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Waiting for other participant...</p>
                <p className="text-sm mt-2">{connectionStatus}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="max-w-7xl mx-auto flex justify-center gap-4">
          <Button
            onClick={toggleVideo}
            variant={isVideoEnabled ? "default" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>
          <Button
            onClick={toggleAudio}
            variant={isAudioEnabled ? "default" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
