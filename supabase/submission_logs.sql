-- Application audit log (run after schema.sql)

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
