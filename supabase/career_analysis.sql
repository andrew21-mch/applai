-- Career analysis fields on user_profiles (run in Supabase SQL Editor)

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS career_analysis JSONB;

-- Example shape:
-- {
--   "careerLevel": "mid",
--   "yearsExperience": 4,
--   "seniorityLabel": "Mid-level Software Engineer",
--   "primaryDomain": "Web Development",
--   "targetRoles": ["Full-Stack Developer", "Backend Engineer"],
--   "appropriateJobLevels": ["mid", "senior"],
--   "strengths": ["React", "Node.js", "PostgreSQL"],
--   "levelReasoning": "...",
--   "analyzedAt": "2026-06-12T..."
-- }
