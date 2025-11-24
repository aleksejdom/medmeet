'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VideoCallDatabase({ appointmentId, userRole, onLeave }) {
  const [remoteConnected, setRemoteConnected] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [status, setStatus] = useState('Starting...')

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const pollIntervalRef = useRef(null)

  useEffect(() => {
    let cleanedUp = false

    const init = async () => {
      try {
        console.log('=== VIDEO CALL START ===')
        console.log('Role:', userRole, 'Appointment:', appointmentId)

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
        console.log('✅ Got media')

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        })
        pcRef.current = pc

        // Add tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream)
        })
        console.log('✅ Added tracks')

        // Handle remote
        pc.ontrack = (e) => {
          console.log('🎥 Got remote track:', e.track.kind)
          
          if (remoteVideoRef.current) {
            if (!remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.srcObject = new MediaStream()
            }
            remoteVideoRef.current.srcObject.addTrack(e.track)
            
            if (remoteVideoRef.current.srcObject.getTracks().length > 0) {
              setRemoteConnected(true)
              setStatus('Connected')
              toast.success('Connected!')
            }
          }
        }

        // ICE
        pc.onicecandidate = async (e) => {
          if (e.candidate) {
            console.log('📡 Sending ICE')
            await sendSignal('ice', {
              candidate: e.candidate.candidate,
              sdpMid: e.candidate.sdpMid,
              sdpMLineIndex: e.candidate.sdpMLineIndex
            })
          }
        }

        // States
        pc.oniceconnectionstatechange = () => {
          console.log('ICE:', pc.iceConnectionState)
          if (pc.iceConnectionState === 'connected') {
            setStatus('Connected')
          }
        }

        // Start signaling
        setStatus('Connecting...')
        const isDoctor = userRole === 'doctor'

        if (isDoctor) {
          // Doctor waits then creates offer
          await new Promise(r => setTimeout(r, 2000))
          console.log('👨‍⚕️ Creating offer')
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await sendSignal('offer', {
            type: offer.type,
            sdp: offer.sdp
          })
          console.log('📤 Sent offer')
          setStatus('Calling...')
        }

        // Poll for signals
        pollIntervalRef.current = setInterval(async () => {
          const signals = await getSignals()
          
          for (const signal of signals) {
            try {
              if (signal.type === 'offer' && !isDoctor) {
                console.log('📨 Got offer')
                await pc.setRemoteDescription(signal.data)
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                await sendSignal('answer', {
                  type: answer.type,
                  sdp: answer.sdp
                })
                console.log('📤 Sent answer')
                await deleteSignal(signal.id)
              } else if (signal.type === 'answer' && isDoctor) {
                console.log('📨 Got answer')
                await pc.setRemoteDescription(signal.data)
                await deleteSignal(signal.id)
              } else if (signal.type === 'ice') {
                await pc.addIceCandidate(signal.data)
                await deleteSignal(signal.id)
              }
            } catch (err) {
              console.error('Signal error:', err)
            }
          }
        }, 1000)

      } catch (err) {
        console.error('❌ Setup error:', err)
        setStatus('Error: ' + err.message)
        toast.error(err.message)
      }
    }

    // Helper functions using API
    const sendSignal = async (type, data) => {
      await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          from: userRole,
          type,
          data
        })
      })
    }

    const getSignals = async () => {
      const res = await fetch(`/api/signals?appointmentId=${appointmentId}&to=${userRole}`)
      if (res.ok) {
        return await res.json()
      }
      return []
    }

    const deleteSignal = async (id) => {
      await fetch(`/api/signals/${id}`, { method: 'DELETE' })
    }

    init()

    return () => {
      cleanedUp = true
      console.log('🧹 Cleanup')
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop())
      }
      if (pcRef.current) {
        pcRef.current.close()
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

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
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
              <p className="text-white text-lg">Waiting...</p>
            </div>
          )}
        </Card>
      </div>

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
