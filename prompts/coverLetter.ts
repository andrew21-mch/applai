export const COVER_LETTER_PROMPT = `You are a professional career writer crafting a tailored cover letter for a job application.

## Candidate Profile
{{PROFILE}}

## Job Opportunity
Title: {{TITLE}}
Organization: {{ORGANIZATION}}
Location: {{LOCATION}}
Description:
{{DESCRIPTION}}

## Instructions
Write a professional but warm cover letter with exactly 3 paragraphs:
1. Opening: Express genuine interest in the role and organization
2. Body: Highlight the candidate's most relevant skills and experience from their profile that match this job
3. Closing: Express enthusiasm and availability for next steps

Requirements:
- Under 350 words
- Formal but personable tone
- Reference specific skills from the candidate profile that are relevant to this job
- Do not use placeholder brackets like [Your Name] — use the candidate's actual name from the profile
- Return ONLY the cover letter text, no subject line or extra formatting`;
