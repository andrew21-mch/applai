-- Run this in Supabase SQL Editor if inserts fail with:
-- "new row violates row-level security policy for table opportunities"

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "opportunities_all" ON opportunities;
DROP POLICY IF EXISTS "applications_all" ON applications;

-- Allow backend (anon key) full access
CREATE POLICY "opportunities_all" ON opportunities
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "applications_all" ON applications
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Storage bucket policy (run after creating 'screenshots' bucket in Dashboard)
-- CREATE POLICY "screenshots_all" ON storage.objects
--   FOR ALL TO anon, authenticated
--   USING (bucket_id = 'screenshots') WITH CHECK (bucket_id = 'screenshots');
