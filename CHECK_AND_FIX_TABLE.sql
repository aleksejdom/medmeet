-- OPTION 1: If you want to keep any existing data (run this first to see structure)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'webrtc_signals';

-- OPTION 2: Complete reset (DESTROYS ANY EXISTING DATA)
-- Uncomment the lines below and run if you want a fresh start:

/*
DROP TABLE IF EXISTS webrtc_signals CASCADE;

CREATE TABLE webrtc_signals (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL,
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_signals_appointment ON webrtc_signals(appointment_id);
CREATE INDEX idx_signals_to_role ON webrtc_signals(to_role);

ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access" ON webrtc_signals FOR ALL USING (true);
*/
