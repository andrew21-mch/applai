export const CAREER_ANALYSIS_PROMPT = `Analyze this candidate's resume and determine their career level and job-fit profile.

## Resume
{{RESUME_TEXT}}

## Parsed summary
Role: {{ROLE}}
Skills: {{SKILLS}}
Experience entries: {{EXPERIENCE}}
Education: {{EDUCATION}}

Return ONLY valid JSON (no markdown):
{
  "careerLevel": "intern|junior|mid|senior|lead|principal|executive",
  "yearsExperience": <number or null>,
  "seniorityLabel": "<e.g. Mid-level Full-Stack Developer>",
  "primaryDomain": "<e.g. Web Development, DevOps, Data Science>",
  "targetRoles": "<comma-separated job titles they should apply for, max 6>",
  "appropriateJobLevels": "<comma-separated levels: intern,junior,mid,senior,lead>",
  "strengths": "<comma-separated top 5 strengths>",
  "levelReasoning": "<1-2 sentences explaining the level assessment>"
}

Rules:
- careerLevel must be one of: intern, junior, mid, senior, lead, principal, executive
- appropriateJobLevels: roles they should realistically apply for (e.g. junior should NOT include senior-only roles)
- yearsExperience: estimate total professional years from experience section
- targetRoles: specific titles matching their level (not aspirational stretch roles)
- No line breaks inside string values`;
