import type { Opportunity } from '../types';
import type { UserProfile } from '../types/profile';

function normalize(text: string): string {
  return text.toLowerCase();
}

function skillTokens(skill: string): string[] {
  return skill
    .toLowerCase()
    .split(/[\s/&+,().-]+/)
    .filter((w) => w.length >= 4);
}

function countSkillMatches(text: string, skills: string[]): number {
  let matched = 0;
  for (const skill of skills) {
    const lower = skill.toLowerCase();
    if (text.includes(lower)) {
      matched++;
      continue;
    }
    if (skillTokens(skill).some((token) => text.includes(token))) {
      matched++;
    }
  }
  return matched;
}

function countRoleMatches(text: string, profile: UserProfile): number {
  let hits = 0;
  const roleParts = profile.role.split(/[/|,]/).map((s) => s.trim()).filter(Boolean);
  for (const part of roleParts) {
    if (part.length >= 4 && text.includes(part.toLowerCase())) hits++;
  }
  for (const exp of profile.experience) {
    const title = exp.split(/\s+at\s+/i)[0]?.toLowerCase() ?? '';
    const words = title.split(/[\s/,-]+/).filter((w) => w.length >= 5);
    if (words.some((w) => text.includes(w))) hits++;
  }
  return hits;
}

/** Deterministic score from resume vs opportunity text overlap */
export function computeRuleBasedScore(profile: UserProfile, opp: Opportunity): number {
  const text = normalize(
    `${opp.title} ${opp.organization ?? ''} ${opp.description ?? ''} ${opp.location ?? ''}`,
  );

  let score = 0;

  const skills = profile.skills.filter((s) => s.trim().length > 2);
  if (skills.length > 0) {
    const matched = countSkillMatches(text, skills);
    score += Math.round(55 * (matched / Math.min(skills.length, 12)));
  }

  const roleHits = countRoleMatches(text, profile);
  score += Math.min(25, roleHits * 12);

  if (/remote|work from home|wfh|anywhere/i.test(text)) score += 10;
  if (profile.location && /cameroon|africa|international/i.test(text)) score += 5;

  if (opp.type === 'scholarship' && profile.education) {
    const edu = profile.education.toLowerCase();
    if (edu.includes('master') && /master|postgraduate|graduate/i.test(text)) score += 15;
    if (edu.includes('computer') && /computer|tech|stem|engineering/i.test(text)) score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

interface LlmScoreResult {
  score?: number;
  match_score?: number;
  reasoning?: string;
}

export function extractLlmScore(result: LlmScoreResult): number | null {
  const raw = result.score ?? result.match_score;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function blendScores(ruleScore: number, llmScore: number | null): number {
  if (llmScore === null) return ruleScore;
  if (llmScore === 0 && ruleScore >= 20) return ruleScore;
  return Math.round(0.45 * ruleScore + 0.55 * llmScore);
}
