export const PARSE_RESUME_PROMPT = `Extract resume info. Return ONLY valid JSON. Use comma-separated strings for lists (NOT arrays).

Resume:
{{RESUME_TEXT}}

Return exactly this shape:
{"name":"Full Name","email":"email or null","phone":"phone or null","location":"city, country","role":"job title","skills":"skill1, skill2, skill3","education":"degree and school","experience":"role 1 at company 1 | role 2 at company 2","languages":"English, French"}

Rules:
- skills: max 40 items, comma-separated, no quotes inside values
- experience: max 8 entries separated by |
- Use null for missing email/phone
- No line breaks inside string values
- No trailing commas`;
