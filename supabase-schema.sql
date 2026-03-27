-- GEO Audit Leads Table Schema
-- Run this in your Supabase SQL Editor to create the required table

CREATE TABLE IF NOT EXISTS audit_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  service TEXT NOT NULL,
  city TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  report_sent BOOLEAN DEFAULT FALSE,
  in_claude BOOLEAN DEFAULT FALSE,
  in_chatgpt BOOLEAN DEFAULT FALSE,
  competitors TEXT[] DEFAULT '{}',
  geo_score INTEGER DEFAULT 0
);

-- If table already exists, add the service column
ALTER TABLE audit_leads ADD COLUMN IF NOT EXISTS service TEXT DEFAULT '';

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_audit_leads_email ON audit_leads(email);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_audit_leads_created_at ON audit_leads(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE audit_leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow insert from authenticated users and anon key
CREATE POLICY "Allow insert for all" ON audit_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create policy to allow update for all (for updating report_sent status)
CREATE POLICY "Allow update for all" ON audit_leads
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Create policy to allow select for authenticated users only (for admin)
CREATE POLICY "Allow select for authenticated" ON audit_leads
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON audit_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_leads TO authenticated;
