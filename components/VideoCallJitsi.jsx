'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Video } from 'lucide-react'

export default function VideoCallJitsi({ roomId, userId, userName, onLeave }) {
  const jitsiContainerRef = useRef(null)
  const jitsiApiRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadingMessage, setLoadingMessage] = useState('Loading video call...')

  useEffect(() => {
    console.log('VideoCallJitsi mounted', { roomId, userId, userName })
    
    // Load Jitsi Meet External API script
    const loadJitsiScript = () => {
      console.log('Loading Jitsi script...')
      setLoadingMessage('Loading video service...')
      
      if (window.JitsiMeetExternalAPI) {
        console.log('Jitsi API already loaded')
        initializeJitsi()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://meet.jit.si/external_api.js'
      script.async = true
      script.onload = () => {
        console.log('Jitsi script loaded successfully')
        initializeJitsi()
      }
      script.onerror = (err) => {
        console.error('Failed to load Jitsi script:', err)
        setError('Failed to load video call service. Please check your internet connection.')
        setIsLoading(false)
      }
      document.body.appendChild(script)
    }

    const initializeJitsi = () => {
      console.log('Initializing Jitsi...')
      setLoadingMessage('Initializing video call...')
      
      if (!jitsiContainerRef.current) {
        console.error('Container ref not available')
        setError('Video container not ready')
        setIsLoading(false)
        return
      }

      try {
        const domain = 'meet.jit.si'
        const roomName = `MedMeet_${roomId}`
        
        console.log('Creating Jitsi meeting:', { domain, roomName, userName })
        
        const options = {
          roomName: roomName,
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
        
        console.log('Jitsi API created, waiting for events...')

        // Event listeners
        api.addEventListener('videoConferenceJoined', (event) => {
          console.log('✅ User joined the conference:', event)
          setIsLoading(false)
          setLoadingMessage('')
        })

        api.addEventListener('videoConferenceLeft', (event) => {
          console.log('User left the conference:', event)
          cleanup()
          onLeave()
        })

        api.addEventListener('readyToClose', () => {
          console.log('Ready to close')
          cleanup()
          onLeave()
        })
        
        api.addEventListener('errorOccurred', (event) => {
          console.error('Jitsi error occurred:', event)
          setError(`Video call error: ${event.error || 'Unknown error'}`)
          setIsLoading(false)
        })
        
        // Timeout fallback - if nothing happens in 15 seconds, show the interface anyway
        setTimeout(() => {
          if (isLoading) {
            console.log('Timeout reached, showing interface')
            setIsLoading(false)
          }
        }, 15000)

      } catch (error) {
        console.error('Error initializing Jitsi:', error)
        setError(`Failed to initialize video call: ${error.message}`)
        setIsLoading(false)
      }
    }

    loadJitsiScript()

    return () => {
      console.log('VideoCallJitsi unmounting, cleaning up')
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
