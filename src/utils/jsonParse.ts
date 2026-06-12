export function parseJsonFromText<T>(text: string): T {
  let cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('No JSON object found');

  let jsonStr = cleaned.slice(start);
  const end = jsonStr.lastIndexOf('}');
  if (end !== -1) jsonStr = jsonStr.slice(0, end + 1);

  jsonStr = fixCommonJsonIssues(jsonStr);

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    jsonStr = repairTruncatedJson(jsonStr);
    jsonStr = fixCommonJsonIssues(jsonStr);
    return JSON.parse(jsonStr) as T;
  }
}

function fixCommonJsonIssues(jsonStr: string): string {
  return jsonStr
    .replace(/,\s*]/g, ']')
    .replace(/,\s*}/g, '}')
    .replace(/\[\s*,/g, '[')
    .replace(/"\s*\n\s*"/g, '", "');
}

function repairTruncatedJson(jsonStr: string): string {
  let s = jsonStr.trim();

  // Close unclosed arrays before closing object
  const openBrackets = (s.match(/\[/g) ?? []).length;
  const closeBrackets = (s.match(/\]/g) ?? []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    if (((s.match(/(?<!\\)"/g) ?? []).length) % 2 !== 0) s += '"';
    s += ']';
  }

  const quotes = (s.match(/(?<!\\)"/g) ?? []).length;
  if (quotes % 2 !== 0) s += '"';

  s = s.replace(/,\s*$/, '');

  const open = (s.match(/\{/g) ?? []).length;
  const close = (s.match(/\}/g) ?? []).length;
  for (let i = 0; i < open - close; i++) s += '}';

  return s;
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
