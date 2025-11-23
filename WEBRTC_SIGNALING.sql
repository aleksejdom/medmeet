-- WebRTC Signaling Table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS webrtc_signals (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate')),
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read" ON webrtc_signals FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON webrtc_signals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON webrtc_signals FOR DELETE USING (true);

-- Create indexes
CREATE INDEX idx_webrtc_room ON webrtc_signals(room_id);
CREATE INDEX idx_webrtc_user ON webrtc_signals(user_id);
CREATE INDEX idx_webrtc_created ON webrtc_signals(created_at DESC);

-- Table to track active participants in rooms
CREATE TABLE IF NOT EXISTS room_participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read" ON room_participants FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON room_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON room_participants FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON room_participants FOR DELETE USING (true);

-- Create indexes
CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_user ON room_participants(user_id);
