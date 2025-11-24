'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'

export default function VideoCallReliable({ appointmentId, userRole, onLeave }) {
  const [remoteConnected, setRemoteConnected] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [status, setStatus] = useState('Starting...')

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const channelRef = useRef(null)
  const pendingCandidatesRef = useRef([])

  useEffect(() => {
    let supabase = null
    let cleanedUp = false

    const init = async () => {
      try {
        console.log('=== STARTING VIDEO CALL ===')
        console.log('Role:', userRole)
        console.log('Appointment ID:', appointmentId)

        // Initialize Supabase
        supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        // Get media
        setStatus('Getting camera...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
        
        if (cleanedUp) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        console.log('✅ Got local stream')

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        })
        pcRef.current = pc

        // Add tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream)
        })
        console.log('✅ Added local tracks')

        // Handle remote stream
        pc.ontrack = (e) => {
          console.log('🎥 GOT REMOTE TRACK:', e.track.kind)
          
          if (remoteVideoRef.current) {
            if (!remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.srcObject = new MediaStream()
            }
            remoteVideoRef.current.srcObject.addTrack(e.track)
            
            const tracks = remoteVideoRef.current.srcObject.getTracks()
            console.log('Remote stream tracks:', tracks.length)
            
            if (tracks.length > 0) {
              setRemoteConnected(true)
              setStatus('Connected')
              toast.success('Connected!')
            }
          }
        }

        // ICE
        pc.onicecandidate = (e) => {
          if (e.candidate && channelRef.current) {
            console.log('📡 Sending ICE')
            channelRef.current.send({
              type: 'broadcast',
              event: 'ice',
              payload: { 
                ice: JSON.stringify(e.candidate),
                from: userRole
              }
            })
          }
        }

        // States
        pc.oniceconnectionstatechange = () => {
          console.log('ICE:', pc.iceConnectionState)
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setStatus('Connected')
          }
        }

        // Setup channel
        setStatus('Connecting...')
        const roomName = `room-${appointmentId}`
        const channel = supabase.channel(roomName)
        channelRef.current = channel

        const isDoctor = userRole === 'doctor'

        await channel
          .on('broadcast', { event: 'offer' }, async ({ payload }) => {
            if (payload.from === userRole) return
            
            console.log('📨 GOT OFFER')
            try {
              await pc.setRemoteDescription(JSON.parse(payload.offer))
              
              // Add pending candidates
              while (pendingCandidatesRef.current.length > 0) {
                const c = pendingCandidatesRef.current.shift()
                await pc.addIceCandidate(JSON.parse(c))
              }
              
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              
              channel.send({
                type: 'broadcast',
                event: 'answer',
                payload: { 
                  answer: JSON.stringify(answer),
                  from: userRole
                }
              })
              console.log('📤 SENT ANSWER')
            } catch (err) {
              console.error('Error handling offer:', err)
            }
          })
          .on('broadcast', { event: 'answer' }, async ({ payload }) => {
            if (payload.from === userRole) return
            
            console.log('📨 GOT ANSWER')
            try {
              await pc.setRemoteDescription(JSON.parse(payload.answer))
              
              // Add pending candidates
              while (pendingCandidatesRef.current.length > 0) {
                const c = pendingCandidatesRef.current.shift()
                await pc.addIceCandidate(JSON.parse(c))
              }
            } catch (err) {
              console.error('Error handling answer:', err)
            }
          })
          .on('broadcast', { event: 'ice' }, async ({ payload }) => {
            if (payload.from === userRole) return
            
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(JSON.parse(payload.ice))
              } else {
                pendingCandidatesRef.current.push(payload.ice)
              }
            } catch (err) {
              console.error('ICE error:', err)
            }
          })
          .subscribe(async (status) => {
            console.log('Channel status:', status)
            
            if (status === 'SUBSCRIBED') {
              console.log('✅ SUBSCRIBED')
              
              // Wait for both to be ready
              await new Promise(r => setTimeout(r, 2000))
              
              // Doctor creates offer
              if (isDoctor) {
                console.log('👨‍⚕️ DOCTOR CREATING OFFER')
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                
                channel.send({
                  type: 'broadcast',
                  event: 'offer',
                  payload: { 
                    offer: JSON.stringify(offer),
                    from: 'doctor'
                  }
                })
                console.log('📤 SENT OFFER')
                setStatus('Calling...')
              } else {
                console.log('🤒 PATIENT WAITING')
                setStatus('Waiting...')
              }
            }
          })

      } catch (err) {
        console.error('❌ SETUP ERROR:', err)
        setStatus('Error: ' + err.message)
        toast.error(err.message)
      }
    }

    init()

    return () => {
      cleanedUp = true
      console.log('🧹 CLEANUP')
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
        setVideoEnabled(track.enabled)
      }
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

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Video Call</h2>
            <p className="text-sm">{status}</p>
          </div>
          <Button onClick={onLeave} variant="destructive">
            <PhoneOff className="mr-2 h-4 w-4" />
            Leave
          </Button>
        </div>
      </div>

      {/* Videos */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Local */}
        <Card className="relative bg-black overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute top-4 left-4 bg-blue-500 px-3 py-1 rounded text-white font-bold">
            You
          </div>
        </Card>

        {/* Remote */}
        <Card className="relative bg-black overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className={`absolute top-4 left-4 px-3 py-1 rounded text-white font-bold ${remoteConnected ? 'bg-green-500' : 'bg-gray-500'}`}>
            {remoteConnected ? 'Other Person' : 'Waiting...'}
          </div>
          {!remoteConnected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white text-lg">Waiting for other person...</p>
            </div>
          )}
        </Card>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4">
        <div className="flex justify-center gap-4">
          <Button
            onClick={toggleVideo}
            variant={videoEnabled ? "default" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {videoEnabled ? <Video /> : <VideoOff />}
          </Button>
          <Button
            onClick={toggleAudio}
            variant={audioEnabled ? "default" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
          >
            {audioEnabled ? <Mic /> : <MicOff />}
          </Button>
        </div>
      </div>
    </div>
  )
}
