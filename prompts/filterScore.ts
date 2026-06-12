export const FILTER_SCORE_PROMPT = `You are an expert career advisor evaluating how well a job or scholarship opportunity matches a candidate's profile.

## Candidate Profile
{{PROFILE}}

## Opportunity
Title: {{TITLE}}
Organization: {{ORGANIZATION}}
Type: {{TYPE}}
Location: {{LOCATION}}
Deadline: {{DEADLINE}}
Description:
{{DESCRIPTION}}

## Task
Score this opportunity from 0 to 100 based on how well it matches the candidate's skills, experience, location preferences, and career goals.
- 90-100: Excellent match, highly recommended
- 70-89: Strong match, worth applying
- 60-69: Moderate match, consider applying
- Below 60: Poor match

Respond with ONLY a JSON object in this exact format (no markdown, no extra text):
{"score": <number>, "reasoning": "<brief 1-2 sentence explanation>"}`;
