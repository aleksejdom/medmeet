-- Video Appointments Database Schema
-- Run this in your Supabase SQL Editor

-- Drop existing tables if recreating
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS time_slots;
DROP TABLE IF EXISTS doctor_profiles;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'patient')),
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doctor profiles table
CREATE TABLE doctor_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  specialization TEXT,
  bio TEXT,
  experience INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Time slots table
CREATE TABLE time_slots (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_available BOOLEAN DEFAULT true,
  duration INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Appointments table
CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  time_slot_id TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  video_room_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since we're handling auth separately)
CREATE POLICY "Allow public read" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON users FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON doctor_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON doctor_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON doctor_profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON doctor_profiles FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON time_slots FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON time_slots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON time_slots FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON time_slots FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON appointments FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON appointments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON appointments FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON notifications FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON notifications FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON notifications FOR DELETE USING (true);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_doctor_profiles_user ON doctor_profiles(user_id);
CREATE INDEX idx_time_slots_doctor ON time_slots(doctor_id);
CREATE INDEX idx_time_slots_date ON time_slots(date);
CREATE INDEX idx_time_slots_available ON time_slots(is_available);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
