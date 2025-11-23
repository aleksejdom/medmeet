'use client'

import { useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VideoCallPeerJS({ appointmentId, onLeave }) {
  const [peer, setPeer] = useState(null)
  const [myPeerId, setMyPeerId] = useState('')
  const [remotePeerId, setRemotePeerId] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('Initializing...')

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const currentCallRef = useRef(null)

  // Initialize PeerJS and get local media
  useEffect(() => {
    let peerInstance = null
    
    const initializePeer = async () => {
      try {
        setConnectionStatus('Getting camera and microphone access...')
        
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
        
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        setConnectionStatus('Connecting to peer server...')
        
        // Create peer with the appointment ID as the peer ID
        // This ensures both doctor and patient can find each other
        peerInstance = new Peer(`medmeet-${appointmentId}`, {
          host: 'peerjs-server.herokuapp.com',
          port: 443,
          path: '/',
          secure: true,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        })

        peerInstance.on('open', (id) => {
          console.log('My peer ID:', id)
          setMyPeerId(id)
          setConnectionStatus('Ready. Waiting for other participant...')
          setPeer(peerInstance)
          toast.success('Connected to video service')
        })

        peerInstance.on('call', (call) => {
          console.log('Receiving call from:', call.peer)
          setConnectionStatus('Incoming call...')
          
          // Answer the call with our stream
          call.answer(localStreamRef.current)
          currentCallRef.current = call

          call.on('stream', (remoteStream) => {
            console.log('Received remote stream')
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream
            }
            setIsConnected(true)
            setConnectionStatus('Connected')
            toast.success('Video call connected!')
          })

          call.on('close', () => {
            console.log('Call closed')
            setIsConnected(false)
            setConnectionStatus('Call ended')
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = null
            }
          })

          call.on('error', (err) => {
            console.error('Call error:', err)
            toast.error('Connection error occurred')
            setConnectionStatus('Connection error')
          })
        })

        peerInstance.on('disconnected', () => {
          console.log('Peer disconnected')
          setConnectionStatus('Disconnected. Trying to reconnect...')
          peerInstance.reconnect()
        })

        peerInstance.on('error', (err) => {
          console.error('Peer error:', err)
          if (err.type === 'unavailable-id') {
            // ID is taken, someone else is already using this appointment ID
            // Try to call them instead
            setConnectionStatus('Other participant is already here. Connecting...')
            setTimeout(() => {
              makeCall(peerInstance)
            }, 1000)
          } else {
            toast.error(`Connection error: ${err.type}`)
            setConnectionStatus(`Error: ${err.type}`)
          }
        })

        setPeer(peerInstance)

      } catch (error) {
        console.error('Error initializing:', error)
        toast.error('Failed to access camera/microphone')
        setConnectionStatus('Failed to access media devices')
      }
    }

    initializePeer()

    // Cleanup
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (currentCallRef.current) {
        currentCallRef.current.close()
      }
      if (peerInstance) {
        peerInstance.destroy()
      }
    }
  }, [appointmentId])

  // Make a call to the other peer
  const makeCall = (peerInstance) => {
    if (!localStreamRef.current) {
      toast.error('Local stream not ready')
      return
    }

    const remotePeer = `medmeet-${appointmentId}`
    console.log('Calling peer:', remotePeer)
    setConnectionStatus('Calling...')

    const call = peerInstance.call(remotePeer, localStreamRef.current)
    currentCallRef.current = call

    call.on('stream', (remoteStream) => {
      console.log('Received remote stream')
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }
      setIsConnected(true)
      setConnectionStatus('Connected')
      toast.success('Video call connected!')
    })

    call.on('close', () => {
      console.log('Call closed')
      setIsConnected(false)
      setConnectionStatus('Call ended')
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
      }
    })

    call.on('error', (err) => {
      console.error('Call error:', err)
      toast.error('Failed to connect')
      setConnectionStatus('Connection failed')
    })
  }

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
    if (currentCallRef.current) {
      currentCallRef.current.close()
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (peer) {
      peer.destroy()
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
