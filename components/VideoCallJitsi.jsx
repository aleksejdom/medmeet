'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Video } from 'lucide-react'

export default function VideoCallJitsi({ roomId, userId, userName, onLeave }) {
  const jitsiContainerRef = useRef(null)
  const jitsiApiRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Load Jitsi Meet External API script
    const loadJitsiScript = () => {
      if (window.JitsiMeetExternalAPI) {
        initializeJitsi()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://meet.jit.si/external_api.js'
      script.async = true
      script.onload = () => initializeJitsi()
      script.onerror = () => {
        setError('Failed to load video call service')
        setIsLoading(false)
      }
      document.body.appendChild(script)
    }

    const initializeJitsi = () => {
      if (!jitsiContainerRef.current) return

      try {
        // Create Jitsi Meet instance
        const domain = 'meet.jit.si'
        const options = {
          roomName: `MedMeet_${roomId}`,
          width: '100%',
          height: '100%',
          parentNode: jitsiContainerRef.current,
          userInfo: {
            displayName: userName
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            enableWelcomePage: false,
            defaultLanguage: 'en',
            enableClosePage: false
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone',
              'camera',
              'closedcaptions',
              'desktop',
              'fullscreen',
              'fodeviceselection',
              'hangup',
              'chat',
              'settings',
              'videoquality',
              'filmstrip',
              'tileview',
              'videobackgroundblur',
              'mute-everyone'
            ],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            BRAND_WATERMARK_LINK: '',
            DEFAULT_BACKGROUND: '#1a1a1a',
            DISABLE_VIDEO_BACKGROUND: false,
            SHOW_PROMOTIONAL_CLOSE_PAGE: false,
            MOBILE_APP_PROMO: false
          }
        }

        const api = new window.JitsiMeetExternalAPI(domain, options)
        jitsiApiRef.current = api

        // Event listeners
        api.addEventListener('videoConferenceJoined', () => {
          console.log('User joined the conference')
          setIsLoading(false)
        })

        api.addEventListener('videoConferenceLeft', () => {
          console.log('User left the conference')
          cleanup()
          onLeave()
        })

        api.addEventListener('readyToClose', () => {
          cleanup()
          onLeave()
        })

      } catch (error) {
        console.error('Error initializing Jitsi:', error)
        setError('Failed to initialize video call')
        setIsLoading(false)
      }
    }

    loadJitsiScript()

    return () => {
      cleanup()
    }
  }, [roomId, userName, onLeave])

  const cleanup = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose()
      jitsiApiRef.current = null
    }
  }

  const handleLeave = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('hangup')
    }
    cleanup()
    onLeave()
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Video className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={onLeave} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading video call...</p>
            <p className="text-gray-400 text-sm mt-2">Please allow camera and microphone access</p>
          </div>
        </div>
      )}
      
      {/* Jitsi Meet container */}
      <div 
        ref={jitsiContainerRef} 
        className="w-full h-full"
        style={{ display: isLoading ? 'none' : 'block' }}
      />
      
      {/* Custom leave button overlay */}
      <div className="absolute top-4 right-4 z-20">
        <Button 
          onClick={handleLeave}
          variant="destructive"
          size="sm"
          className="shadow-lg"
        >
          Leave Call
        </Button>
      </div>
    </div>
  )
}
