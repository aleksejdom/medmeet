-- This will drop and recreate the table properly
-- Run this in Supabase SQL Editor

-- STEP 1: Drop the existing table completely
DROP TABLE IF EXISTS webrtc_signals CASCADE;

-- STEP 2: Create the table with correct structure
CREATE TABLE webrtc_signals (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL,
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- STEP 3: Create indexes
CREATE INDEX idx_signals_appointment ON webrtc_signals(appointment_id);
CREATE INDEX idx_signals_to_role ON webrtc_signals(to_role);

-- STEP 4: Enable RLS
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create policy to allow all access
CREATE POLICY "Enable all access for webrtc_signals" 
ON webrtc_signals 
FOR ALL 
USING (true);
