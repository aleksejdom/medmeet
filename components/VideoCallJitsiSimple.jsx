'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink, Video } from 'lucide-react'

export default function VideoCallJitsiSimple({ roomId, userName, onLeave }) {
  // Jitsi Meet free rooms - works everywhere!
  const jitsiRoomUrl = `https://meet.jit.si/MedMeet_${roomId}`
  
  const openInNewTab = () => {
    window.open(jitsiRoomUrl, '_blank')
  }

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-blue-900 to-purple-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50 backdrop-blur-sm p-4 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button 
            onClick={onLeave}
            variant="secondary"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="text-white text-sm">
            <span className="font-semibold">{userName}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex items-center justify-center h-full p-8">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 text-center space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mx-auto flex items-center justify-center">
            <Video className="w-10 h-10 text-white" />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Join Video Call
            </h2>
            <p className="text-gray-600">
              Click below to start your video consultation
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-2">
            <h3 className="font-semibold text-blue-900 mb-2">📋 Simple Steps:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Click <strong>"Open Video Call"</strong> button below</li>
              <li>A new tab opens with Jitsi Meet</li>
              <li>Allow camera and microphone</li>
              <li>Wait for other participant to join</li>
              <li>Both will see each other automatically!</li>
            </ol>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <Button
              onClick={openInNewTab}
              size="lg"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg py-6"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Open Video Call
            </Button>

            <p className="text-xs text-gray-500">
              Opens Jitsi Meet in a new tab. If blocked, allow pop-ups.
            </p>
          </div>

          {/* Room info */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">
              Room: <span className="font-mono font-semibold">MedMeet_{roomId}</span>
            </p>
            <p className="text-xs text-gray-500">
              Both participants will join this room automatically
            </p>
          </div>

          {/* Alternative - Direct link */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-700 mb-2 font-semibold">
              📱 Alternative: Copy & Share Link
            </p>
            <div className="bg-gray-100 rounded p-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={jitsiRoomUrl}
                className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                onClick={(e) => e.target.select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(jitsiRoomUrl)
                  alert('✓ Link copied to clipboard!')
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Share via WhatsApp, SMS, or Email - Both open same link
            </p>
          </div>

          {/* Features */}
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-600 mb-3 font-semibold">✨ Included Features:</p>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> HD Video & Audio
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Screen Sharing
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> No Time Limits
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> No Downloads
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Works Everywhere
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> 100% Free
              </div>
            </div>
          </div>

          {/* Pro tip */}
          <div className="pt-4 border-t bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>💡 Pro Tip:</strong> If the button doesn't work, copy the link above and paste it in a new browser tab.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 backdrop-blur-sm p-4">
        <p className="text-center text-white text-xs">
          Powered by Jitsi Meet • Trusted by millions worldwide
        </p>
      </div>
    </div>
  )
}
