export const EXTRACT_OPPORTUNITY_PROMPT = `You are a data extraction assistant. Given search result content about a job or scholarship, extract structured information.

## Search Result Content
{{CONTENT}}

## Expected Type
{{TYPE}}

## Task
Extract the following fields from the content. If a field is not found, use reasonable defaults or null.

Respond with ONLY a JSON object (no markdown, no extra text):
{
  "title": "<job or scholarship title>",
  "organization": "<company or institution name>",
  "url": "<application or listing URL>",
  "deadline": "<ISO date string or null if unknown>",
  "location": "<location or 'Remote' if applicable>",
  "description": "<brief 2-3 sentence summary of the opportunity>"
}`;
