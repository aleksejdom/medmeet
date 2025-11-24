'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Video, VideoOff, Mic, MicOff, PhoneOff, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@supabase/supabase-js'

export default function VideoCallWorking({ appointmentId, userRole, onLeave }) {
  const [isConnected, setIsConnected] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [status, setStatus] = useState('Initializing...')
  const [debugLog, setDebugLog] = useState([])

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const channelRef = useRef(null)
  const localStreamRef = useRef(null)
  const supabaseRef = useRef(null)

  const addLog = (msg) => {
    console.log(msg)
    setDebugLog(prev => [...prev.slice(-5), `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  useEffect(() => {
    const setupCall = async () => {
      try {
        const isDoctor = userRole === 'doctor'
        addLog(`🚀 Starting as ${isDoctor ? 'DOCTOR' : 'PATIENT'}`)
        setStatus('Getting camera and microphone...')

        // Get Supabase
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
        supabaseRef.current = supabase

        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
          addLog('✅ Local video set')
        }

        setStatus('Creating peer connection...')

        // Create RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        })
        pcRef.current = pc

        // Add local tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream)
          addLog(`➕ Added ${track.kind} track`)
        })

        // Handle remote tracks
        pc.ontrack = (event) => {
          addLog(`🎥 Received ${event.track.kind} track`)
          
          if (!remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.srcObject = new MediaStream()
            addLog('Created remote MediaStream')
          }
          
          const remoteStream = remoteVideoRef.current.srcObject
          remoteStream.addTrack(event.track)
          addLog(`Remote stream now has ${remoteStream.getTracks().length} tracks`)
          
          setIsConnected(true)
          setStatus('Connected!')
          toast.success('Call connected!')
        }

        // ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && channelRef.current) {
            addLog('📡 Sending ICE candidate')
            channelRef.current.send({
              type: 'broadcast',
              event: 'ice',
              payload: { 
                candidate: {
                  candidate: event.candidate.candidate,
                  sdpMLineIndex: event.candidate.sdpMLineIndex,
                  sdpMid: event.candidate.sdpMid
                },
                from: isDoctor ? 'doctor' : 'patient'
              }
            })
          } else if (!event.candidate) {
            addLog('✅ ICE gathering complete')
          }
        }

        // Connection state
        pc.oniceconnectionstatechange = () => {
          addLog(`🔗 ICE state: ${pc.iceConnectionState}`)
        }

        pc.onconnectionstatechange = () => {
          addLog(`🔗 Connection state: ${pc.connectionState}`)
          if (pc.connectionState === 'connected') {
            setIsConnected(true)
            setStatus('Connected!')
          } else if (pc.connectionState === 'failed') {
            setStatus('Connection failed - try refreshing')
            toast.error('Connection failed')
          }
        }

        // Setup Supabase channel
        setStatus('Joining channel...')
        const channel = supabase.channel(`medmeet-${appointmentId}`)
        channelRef.current = channel

        // Subscribe to channel
        channel
          .on('broadcast', { event: 'signal' }, async ({ payload }) => {
            // Ignore own messages
            const myRole = isDoctor ? 'doctor' : 'patient'
            if (payload.from === myRole) {
              return
            }
            
            addLog(`📨 Received: ${payload.type} from ${payload.from}`)
            
            try {
              if (payload.type === 'offer' && !isDoctor) {
                // Only patient processes offers
                addLog('Processing offer...')
                await pc.setRemoteDescription(new RTCSessionDescription(payload.data))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                
                channel.send({
                  type: 'broadcast',
                  event: 'signal',
                  payload: {
                    type: 'answer',
                    data: {
                      type: answer.type,
                      sdp: answer.sdp
                    },
                    from: 'patient'
                  }
                })
                addLog('📤 Sent answer')
              } else if (payload.type === 'answer' && isDoctor) {
                // Only doctor processes answers
                addLog('Processing answer...')
                await pc.setRemoteDescription(new RTCSessionDescription(payload.data))
              }
            } catch (err) {
              addLog(`❌ Error: ${err.message}`)
            }
          })
          .on('broadcast', { event: 'ice' }, async ({ payload }) => {
            if (payload.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
                addLog(`✅ Added ICE from ${payload.from}`)
              } catch (err) {
                addLog(`⚠️ ICE error: ${err.message}`)
              }
            }
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              addLog('✅ Subscribed to channel')
              setStatus('Waiting for peer...')
              
              // Wait a bit for both to subscribe
              await new Promise(r => setTimeout(r, 1000))
              
              // Doctor initiates
              if (isDoctor) {
                addLog('👨‍⚕️ Creating offer...')
                setStatus('Calling patient...')
                
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                
                channel.send({
                  type: 'broadcast',
                  event: 'signal',
                  payload: {
                    type: 'offer',
                    data: {
                      type: offer.type,
                      sdp: offer.sdp
                    },
                    from: 'doctor'
                  }
                })
                addLog('📤 Sent offer')
              } else {
                addLog('🤒 Patient waiting for call...')
                setStatus('Waiting for doctor...')
              }
            } else {
              addLog(`Channel status: ${status}`)
            }
          })

      } catch (err) {
        addLog(`❌ Setup error: ${err.message}`)
        setStatus('Error: ' + err.message)
        toast.error('Failed to setup call: ' + err.message)
      }
    }

    setupCall()

    return () => {
      addLog('🧹 Cleaning up')
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop())
      }
      if (pcRef.current) {
        pcRef.current.close()
      }
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current)
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

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex-1">
            <h2 className="text-lg font-bold">Video Call - {userRole === 'doctor' ? 'Doctor' : 'Patient'}</h2>
            <p className="text-xs text-blue-100">{status}</p>
            {/* Debug log */}
            <div className="text-xs opacity-75 mt-1">
              {debugLog.slice(-2).map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
          <Button 
            onClick={onLeave}
            variant="destructive"
            size="sm"
            className="bg-red-600 hover:bg-red-700"
          >
            <PhoneOff className="mr-1 h-4 w-4" />
            Leave
          </Button>
        </div>
      </div>

      {/* Videos */}
      <div className="flex-1 grid grid-cols-2 gap-2 p-2 bg-gray-900">
        {/* Local */}
        <Card className="relative bg-gray-800 overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute top-2 left-2 bg-blue-600 px-2 py-1 rounded text-white text-xs font-bold">
            You
          </div>
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </Card>

        {/* Remote */}
        <Card className="relative bg-gray-800 overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className={`absolute top-2 left-2 px-2 py-1 rounded text-white text-xs font-bold ${isConnected ? 'bg-green-600' : 'bg-gray-600'}`}>
            {isConnected ? (userRole === 'doctor' ? 'Patient' : 'Doctor') : 'Waiting...'}
          </div>
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-gray-400">
                <RefreshCw className="h-12 w-12 mx-auto mb-2 opacity-50 animate-spin" />
                <p className="text-sm">Connecting...</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-3 border-t border-gray-700">
        <div className="flex justify-center gap-3">
          <Button
            onClick={toggleVideo}
            variant={isVideoEnabled ? "default" : "destructive"}
            size="lg"
            className="rounded-full w-12 h-12 p-0"
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button
            onClick={toggleAudio}
            variant={isAudioEnabled ? "default" : "destructive"}
            size="lg"
            className="rounded-full w-12 h-12 p-0"
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
