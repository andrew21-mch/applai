-- Profile + resume storage (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  role TEXT,
  skills JSONB NOT NULL DEFAULT '[]',
  education TEXT,
  experience JSONB NOT NULL DEFAULT '[]',
  languages JSONB NOT NULL DEFAULT '[]',
  job_types JSONB NOT NULL DEFAULT '[]',
  scholarship_types JSONB NOT NULL DEFAULT '[]',
  salary_expectation TEXT,
  raw_resume_text TEXT,
  resume_filename TEXT,
  resume_storage_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_all" ON user_profiles;
CREATE POLICY "user_profiles_all" ON user_profiles
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

-- Create 'resumes' bucket in Dashboard → Storage (private or public)
-- Then run storage policies if needed for service_role uploads
