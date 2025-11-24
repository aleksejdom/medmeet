-- Run this SQL in your Supabase dashboard (SQL Editor)
-- This creates the table needed for WebRTC signaling

CREATE TABLE IF NOT EXISTS webrtc_signals (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL,
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_signals_appointment ON webrtc_signals(appointment_id);
CREATE INDEX IF NOT EXISTS idx_signals_to_role ON webrtc_signals(to_role);
CREATE INDEX IF NOT EXISTS idx_signals_created ON webrtc_signals(created_at);

-- Enable row level security
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since we're handling auth in our API)
CREATE POLICY "Enable all access for webrtc_signals" ON webrtc_signals
FOR ALL USING (true);
