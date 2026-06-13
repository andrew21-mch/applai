export const FORM_FIELD_SUGGESTIONS_PROMPT = `Suggest answers for job application form fields based on the candidate profile.

## Candidate profile
{{PROFILE}}

## Career level
{{CAREER_LEVEL}}

## Cover letter draft (if relevant for long-text fields)
{{COVER_LETTER}}

## Form fields to fill (JSON array)
{{FIELDS_JSON}}

For each field, suggest the best answer. Use profile data first; use AI only for open-ended questions (e.g. "Why do you want this role?", "Years of experience with X").

Return ONLY valid JSON array (no markdown):
[
  {
    "fieldKey": "<same key from input>",
    "suggestedAnswer": "<answer text>",
    "confidence": "high|medium|low",
    "source": "profile|draft|ai",
    "reason": "<brief why>"
  }
]

Rules:
- high confidence: direct match (name, email, phone, linkedin from profile)
- medium: inferred from experience (years of experience, salary range)
- low: AI-generated for custom questions — keep honest and based on resume
- For file/upload fields: suggest "Upload resume from profile" not a fake path
- For select/radio: pick from provided options only
- Empty string if cannot answer`;
