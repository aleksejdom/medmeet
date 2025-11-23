'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function VideoCallSimple({ roomId, userName, onLeave }) {
  const jitsiUrl = `https://meet.jit.si/MedMeet_${roomId}#userInfo.displayName="${encodeURIComponent(userName)}"&config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false`

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-50">
        <Button 
          onClick={onLeave}
          variant="secondary"
          size="sm"
          className="shadow-lg"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Leave Call
        </Button>
      </div>

      {/* Instructions overlay */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
        <p className="text-sm font-medium">
          Allow camera/microphone when prompted. Share this room with the other participant.
        </p>
      </div>
      
      {/* Jitsi iframe */}
      <iframe
        src={jitsiUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full h-full border-0"
        title="Video Call"
      />

      {/* Room info at bottom */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
        <p className="text-xs">
          Room: MedMeet_{roomId}
        </p>
      </div>
    </div>
  )
}
