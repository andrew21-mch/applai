-- Run this in your Supabase SQL editor to create the required tables.

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  organization TEXT,
  type TEXT NOT NULL CHECK (type IN ('job', 'scholarship')),
  url TEXT NOT NULL UNIQUE,
  deadline TIMESTAMPTZ,
  location TEXT,
  description TEXT,
  match_score INTEGER,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'applied', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  cover_letter TEXT,
  essay TEXT,
  cv_version TEXT,
  submitted_at TIMESTAMPTZ,
  response TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_match_score ON opportunities(match_score);
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(type);
CREATE INDEX IF NOT EXISTS idx_applications_opportunity_id ON applications(opportunity_id);

-- Row Level Security (required for Supabase inserts to work)
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opportunities_all" ON opportunities
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "applications_all" ON applications
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Application audit log (preview + submit events)
CREATE TABLE IF NOT EXISTS submission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('preview', 'submit')),
  success BOOLEAN NOT NULL DEFAULT false,
  message TEXT,
  filled_fields JSONB DEFAULT '[]',
  missed_fields JSONB DEFAULT '[]',
  screenshot_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_logs_opportunity ON submission_logs(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_submission_logs_created ON submission_logs(created_at DESC);

ALTER TABLE submission_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submission_logs_all" ON submission_logs;
CREATE POLICY "submission_logs_all" ON submission_logs
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

-- Storage bucket for submission screenshots (create in Supabase Dashboard → Storage)
-- Bucket name: screenshots (public read enabled for review)
