-- Job notification subscriptions (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS job_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  min_score INTEGER NOT NULL DEFAULT 60,
  job_types JSONB NOT NULL DEFAULT '["job"]',
  career_levels JSONB NOT NULL DEFAULT '[]',
  notify_email BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_subscriptions_active ON job_subscriptions(is_active) WHERE is_active = true;

ALTER TABLE job_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_subscriptions_all" ON job_subscriptions;
CREATE POLICY "job_subscriptions_all" ON job_subscriptions
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);
