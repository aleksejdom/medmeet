-- Run this SQL in your Supabase dashboard (SQL Editor)
-- STEP 1: Drop table if exists and recreate
DROP TABLE IF EXISTS webrtc_signals CASCADE;

-- STEP 2: Create the table
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
CREATE INDEX idx_signals_created ON webrtc_signals(created_at);

-- STEP 4: Enable RLS and create policy
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for webrtc_signals" ON webrtc_signals
FOR ALL USING (true);
