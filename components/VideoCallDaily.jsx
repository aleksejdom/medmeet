'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export default function VideoCallDaily({ roomId, userName, onLeave }) {
  // Daily.co free rooms - no API key needed!
  const dailyRoomUrl = `https://medmeet.daily.co/${roomId}`
  
  const openInNewTab = () => {
    window.open(dailyRoomUrl, '_blank')
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
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>

          {/* Title */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Join Video Call
            </h2>
            <p className="text-gray-600">
              Start your video consultation now
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-2">
            <h3 className="font-semibold text-blue-900 mb-2">How to join:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Click the button below to open the video call</li>
              <li>Allow camera and microphone when prompted</li>
              <li>The other participant will join the same room</li>
              <li>Both of you will see each other instantly!</li>
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
              Open Video Call in New Tab
            </Button>

            <p className="text-xs text-gray-500">
              Opens in a new tab. Make sure pop-ups are enabled.
            </p>
          </div>

          {/* Room info */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">
              Room ID: <span className="font-mono font-semibold">{roomId}</span>
            </p>
            <p className="text-xs text-gray-500">
              Both participants must use the same Room ID to join the call
            </p>
          </div>

          {/* Alternative - Direct link */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-700 mb-2 font-semibold">
              Alternative: Share this link
            </p>
            <div className="bg-gray-100 rounded p-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={dailyRoomUrl}
                className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                onClick={(e) => e.target.select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(dailyRoomUrl)
                  alert('Link copied!')
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Both users can open this link directly to join
            </p>
          </div>

          {/* Features */}
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-600 mb-2 font-semibold">What you get:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>✓ HD Video & Audio</div>
              <div>✓ Screen Sharing</div>
              <div>✓ No Time Limits</div>
              <div>✓ No Downloads</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 backdrop-blur-sm p-4">
        <p className="text-center text-white text-xs">
          Powered by Daily.co • Free & Secure Video Calls
        </p>
      </div>
    </div>
  )
}
