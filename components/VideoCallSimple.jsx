'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'

export default function VideoCallSimple({ appointmentId, userRole, onLeave }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('Initializing...')

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const channelRef = useRef(null)
  const localStreamRef = useRef(null)
  const pendingCandidatesRef = useRef([])

  useEffect(() => {
    let supabase = null
    const isDoctor = userRole === 'doctor'

    const init = async () => {
      try {
        console.log(`🚀 Starting as ${isDoctor ? 'DOCTOR (Caller)' : 'PATIENT (Callee)'}`)
        
        // Init Supabase
        supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        // Get media
        setConnectionStatus('Getting camera and microphone...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true
        })
        
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        })
        pcRef.current = pc

        // Add tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream)
          console.log('➕ Added track:', track.kind)
        })

        // Handle incoming track
        pc.ontrack = (e) => {
          console.log('🎥 Received track:', e.track.kind)
          if (!remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.srcObject = new MediaStream()
          }
          remoteVideoRef.current.srcObject.addTrack(e.track)
          setIsConnected(true)
          setConnectionStatus('Connected')
          toast.success('Video connected!')
        }

        // ICE candidate
        pc.onicecandidate = (e) => {
          if (e.candidate && channelRef.current) {
            console.log('📡 Sending ICE candidate')
            channelRef.current.send({
              type: 'broadcast',
              event: 'candidate',
              payload: { candidate: e.candidate.toJSON() }
            })
          }
        }

        // Connection state
        pc.onconnectionstatechange = () => {
          console.log('🔗 Connection state:', pc.connectionState)
          if (pc.connectionState === 'connected') {
            setIsConnected(true)
            setConnectionStatus('Connected')
          } else if (pc.connectionState === 'failed') {
            setConnectionStatus('Connection failed')
            toast.error('Connection failed')
          }
        }

        // Setup channel
        const channel = supabase.channel(`videocall-${appointmentId}`)
        channelRef.current = channel

        if (isDoctor) {
          // DOCTOR: Creates offer when patient signals ready
          channel.on('broadcast', { event: 'patient-ready' }, async () => {
            console.log('👨‍⚕️ DOCTOR: Patient is ready, creating offer...')
            setConnectionStatus('Calling patient...')
            
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            
            channel.send({
              type: 'broadcast',
              event: 'offer',
              payload: { offer: offer.toJSON() }
            })
            console.log('📤 DOCTOR: Sent offer')
          })

          channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
            console.log('📥 DOCTOR: Received answer')
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
            
            // Add pending candidates
            for (const c of pendingCandidatesRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(c))
            }
            pendingCandidatesRef.current = []
          })
        } else {
          // PATIENT: Waits for offer and answers
          channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
            console.log('📥 PATIENT: Received offer')
            setConnectionStatus('Answering call...')
            
            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
            
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            
            channel.send({
              type: 'broadcast',
              event: 'answer',
              payload: { answer: answer.toJSON() }
            })
            console.log('📤 PATIENT: Sent answer')
            
            // Add pending candidates
            for (const c of pendingCandidatesRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(c))
            }
            pendingCandidatesRef.current = []
          })
        }

        // Both handle ICE candidates
        channel.on('broadcast', { event: 'candidate' }, async ({ payload }) => {
          console.log('📥 Received ICE candidate')
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } else {
            pendingCandidatesRef.current.push(payload.candidate)
          }
        })

        // Subscribe and signal ready
        await channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Subscribed to channel')
            setConnectionStatus('Waiting for other participant...')
            
            if (isDoctor) {
              console.log('👨‍⚕️ DOCTOR: Ready and waiting for patient')
            } else {
              console.log('🤒 PATIENT: Signaling ready to doctor')
              // Patient signals ready immediately
              channel.send({
                type: 'broadcast',
                event: 'patient-ready',
                payload: { ready: true }
              })
            }
          }
        })

      } catch (err) {
        console.error('❌ Error:', err)
        toast.error('Failed to initialize: ' + err.message)
        setConnectionStatus('Failed to initialize')
      }
    }

    init()

    return () => {
      console.log('🧹 Cleaning up...')
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop())
      }
      if (pcRef.current) {
        pcRef.current.close()
      }
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [appointmentId, userRole])

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
    if (pcRef.current) {
      pcRef.current.close()
    }
    onLeave()
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
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

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-900">
        <Card className="relative bg-gray-800 border-gray-700 overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute top-4 left-4 bg-blue-600 px-3 py-1 rounded text-white text-sm font-semibold">
            You ({userRole === 'doctor' ? 'Doctor' : 'Patient'})
          </div>
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff className="h-16 w-16 text-gray-400" />
            </div>
          )}
        </Card>

        <Card className="relative bg-gray-800 border-gray-700 overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4 bg-green-600 px-3 py-1 rounded text-white text-sm font-semibold">
            {isConnected ? (userRole === 'doctor' ? 'Patient' : 'Doctor') : 'Waiting...'}
          </div>
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-gray-400">
                <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Waiting for {userRole === 'doctor' ? 'patient' : 'doctor'}...</p>
              </div>
            </div>
          )}
        </Card>
      </div>

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
