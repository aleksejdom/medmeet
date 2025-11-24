'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'

export default function VideoCallFixed({ appointmentId, onLeave }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('Initializing...')

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const supabaseChannelRef = useRef(null)
  const supabaseClientRef = useRef(null)
  const makingOfferRef = useRef(false)
  const ignoreOfferRef = useRef(false)
  const isPoliteRef = useRef(false)

  useEffect(() => {
    let mounted = true
    let channel = null

    const initializeCall = async () => {
      try {
        // Initialize Supabase
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
        supabaseClientRef.current = supabase

        setConnectionStatus('Getting camera and microphone...')
        
        // Get local media
        const localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
        
        localStreamRef.current = localStream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream
        }

        setConnectionStatus('Setting up connection...')

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        })
        peerConnectionRef.current = pc

        // Add local tracks
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream)
        })

        // Handle remote tracks - SIMPLIFIED
        pc.ontrack = (event) => {
          console.log('🎥 Received track:', event.track.kind)
          if (remoteVideoRef.current) {
            if (!remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.srcObject = new MediaStream()
            }
            const stream = remoteVideoRef.current.srcObject
            stream.addTrack(event.track)
            console.log('✅ Remote video now has tracks:', stream.getTracks().length)
            setIsConnected(true)
            setConnectionStatus('Connected')
          }
        }

        // ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && channel) {
            channel.send({
              type: 'broadcast',
              event: 'ice',
              payload: { candidate: event.candidate }
            })
          }
        }

        // Connection state
        pc.onconnectionstatechange = () => {
          console.log('Connection state:', pc.connectionState)
          if (pc.connectionState === 'connected') {
            setConnectionStatus('Connected')
            setIsConnected(true)
            toast.success('Call connected!')
          } else if (pc.connectionState === 'failed') {
            toast.error('Connection failed')
            setConnectionStatus('Connection failed')
          }
        }

        // Setup Supabase channel with Perfect Negotiation pattern
        channel = supabase.channel(`call-${appointmentId}`)
        supabaseChannelRef.current = channel

        // Determine if we're polite (lower timestamp = polite)
        const myTimestamp = Date.now()

        channel
          .on('broadcast', { event: 'join' }, async ({ payload }) => {
            console.log('👋 Peer joined')
            // Determine politeness based on timestamp
            if (payload.timestamp < myTimestamp) {
              isPoliteRef.current = false // We're impolite, we initiate
              console.log('🎯 I am impolite (initiator)')
              
              // Wait a bit for peer to be ready
              await new Promise(r => setTimeout(r, 500))
              
              try {
                makingOfferRef.current = true
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                channel.send({
                  type: 'broadcast',
                  event: 'description',
                  payload: { description: pc.localDescription }
                })
                console.log('📤 Sent offer')
              } catch (err) {
                console.error('Error creating offer:', err)
              } finally {
                makingOfferRef.current = false
              }
            } else {
              isPoliteRef.current = true // We're polite, we wait
              console.log('😊 I am polite (waiter)')
            }
          })
          .on('broadcast', { event: 'description' }, async ({ payload }) => {
            console.log('📨 Received description:', payload.description.type)
            
            try {
              const offerCollision = payload.description.type === 'offer' &&
                                    (makingOfferRef.current || pc.signalingState !== 'stable')
              
              ignoreOfferRef.current = !isPoliteRef.current && offerCollision
              
              if (ignoreOfferRef.current) {
                console.log('⚠️ Ignoring offer due to collision (I am impolite)')
                return
              }
              
              await pc.setRemoteDescription(payload.description)
              
              if (payload.description.type === 'offer') {
                await pc.setLocalDescription(await pc.createAnswer())
                channel.send({
                  type: 'broadcast',
                  event: 'description',
                  payload: { description: pc.localDescription }
                })
                console.log('📤 Sent answer')
              }
            } catch (err) {
              console.error('Error handling description:', err)
            }
          })
          .on('broadcast', { event: 'ice' }, async ({ payload }) => {
            try {
              if (payload.candidate) {
                await pc.addIceCandidate(payload.candidate)
              }
            } catch (err) {
              if (!ignoreOfferRef.current) {
                console.error('Error adding ICE candidate:', err)
              }
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Subscribed to channel')
              setConnectionStatus('Waiting for other participant...')
              // Announce presence with timestamp
              channel.send({
                type: 'broadcast',
                event: 'join',
                payload: { timestamp: myTimestamp }
              })
              console.log('📢 Announced presence with timestamp:', myTimestamp)
            }
          })

      } catch (error) {
        console.error('❌ Error:', error)
        toast.error('Failed to initialize call')
        setConnectionStatus('Failed to initialize')
      }
    }

    initializeCall()

    return () => {
      mounted = false
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop())
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      if (channel && supabaseClientRef.current) {
        supabaseClientRef.current.removeChannel(channel)
      }
    }
  }, [appointmentId])

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0]
      if (track) {
        track.enabled = !track.enabled
        setIsVideoEnabled(track.enabled)
      }
    }
  }

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0]
      if (track) {
        track.enabled = !track.enabled
        setIsAudioEnabled(track.enabled)
      }
    }
  }

  const handleLeave = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
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
        {/* Local Video - YOU */}
        <Card className="relative bg-gray-800 border-gray-700 overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute top-4 left-4 bg-blue-600 px-3 py-1 rounded text-white text-sm font-semibold">
            You (Local)
          </div>
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff className="h-16 w-16 text-gray-400" />
            </div>
          )}
        </Card>

        {/* Remote Video - OTHER PERSON */}
        <Card className="relative bg-gray-800 border-gray-700 overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4 bg-green-600 px-3 py-1 rounded text-white text-sm font-semibold">
            {isConnected ? 'Other Participant' : 'Waiting...'}
          </div>
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-gray-400">
                <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Waiting for other participant...</p>
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
