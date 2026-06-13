import { CAREER_ANALYSIS_PROMPT, fillTemplate } from '../../prompts';
import { completeJson } from '../services/ollama';
import { profileToTextFrom } from '../config/profile';
import { splitList } from '../utils/jsonParse';
import { logger } from '../utils/logger';
import type { CareerAnalysis, CareerLevel, UserProfile } from '../types/profile';

const VALID_LEVELS: CareerLevel[] = [
  'intern',
  'junior',
  'mid',
  'senior',
  'lead',
  'principal',
  'executive',
];

interface RawCareerAnalysis {
  careerLevel?: string;
  yearsExperience?: number | string | null;
  seniorityLabel?: string;
  primaryDomain?: string;
  targetRoles?: string | string[];
  appropriateJobLevels?: string | string[];
  strengths?: string | string[];
  levelReasoning?: string;
}

function inferLevelFromExperience(experienceCount: number): CareerLevel {
  if (experienceCount <= 0) return 'junior';
  if (experienceCount <= 2) return 'junior';
  if (experienceCount <= 4) return 'mid';
  if (experienceCount <= 7) return 'senior';
  return 'lead';
}

function fallbackAnalysis(profile: UserProfile): CareerAnalysis {
  const level = inferLevelFromExperience(profile.experience.length);
  const roles = profile.careerAnalysis?.targetRoles?.length
    ? profile.careerAnalysis.targetRoles
    : [profile.role, ...profile.jobTypes].filter(Boolean).slice(0, 4);

  return {
    careerLevel: level,
    yearsExperience: profile.experience.length > 0 ? profile.experience.length + 1 : null,
    seniorityLabel: `${level.charAt(0).toUpperCase() + level.slice(1)} ${profile.role}`,
    primaryDomain: profile.role || 'General',
    targetRoles: roles,
    appropriateJobLevels: VALID_LEVELS.slice(
      VALID_LEVELS.indexOf(level === 'lead' ? 'mid' : level),
      VALID_LEVELS.indexOf(level) + 2,
    ),
    strengths: profile.skills.slice(0, 5),
    levelReasoning: 'Estimated from experience entry count (Ollama analysis unavailable).',
    analyzedAt: new Date().toISOString(),
  };
}

function normalizeLevel(raw: string | undefined): CareerLevel {
  const lower = (raw ?? 'mid').toLowerCase().trim();
  if (VALID_LEVELS.includes(lower as CareerLevel)) return lower as CareerLevel;
  if (/intern|graduate|entry|trainee/i.test(lower)) return 'intern';
  if (/junior|associate|entry/i.test(lower)) return 'junior';
  if (/senior|sr\.?/i.test(lower)) return 'senior';
  if (/lead|staff|principal|architect/i.test(lower)) return 'lead';
  if (/director|vp|head|executive|cto|ceo/i.test(lower)) return 'executive';
  return 'mid';
}

export function normalizeCareerAnalysis(raw: RawCareerAnalysis, profile: UserProfile): CareerAnalysis {
  const careerLevel = normalizeLevel(raw.careerLevel);
  let years: number | null = null;
  if (typeof raw.yearsExperience === 'number') years = raw.yearsExperience;
  else if (typeof raw.yearsExperience === 'string') {
    const n = parseInt(raw.yearsExperience, 10);
    if (Number.isFinite(n)) years = n;
  }

  const targetRoles = splitList(raw.targetRoles).filter(Boolean);
  const appropriateJobLevels = splitList(raw.appropriateJobLevels)
    .map((l) => normalizeLevel(l))
    .filter((l, i, arr) => arr.indexOf(l) === i);

  return {
    careerLevel,
    yearsExperience: years,
    seniorityLabel: raw.seniorityLabel?.trim() || `${careerLevel} ${profile.role}`,
    primaryDomain: raw.primaryDomain?.trim() || profile.role,
    targetRoles: targetRoles.length ? targetRoles : [profile.role],
    appropriateJobLevels: appropriateJobLevels.length ? appropriateJobLevels : [careerLevel],
    strengths: splitList(raw.strengths).slice(0, 8),
    levelReasoning: raw.levelReasoning?.trim() || 'AI career analysis.',
    analyzedAt: new Date().toISOString(),
  };
}

export async function analyzeCareerLevel(profile: UserProfile): Promise<CareerAnalysis> {
  const resumeText = profile.rawResumeText?.slice(0, 6000) ?? '';
  if (!resumeText.trim()) {
    return fallbackAnalysis(profile);
  }

  const prompt = fillTemplate(CAREER_ANALYSIS_PROMPT, {
    RESUME_TEXT: resumeText,
    ROLE: profile.role,
    SKILLS: profile.skills.join(', ') || 'none',
    EXPERIENCE: profile.experience.join(' | ') || 'none',
    EDUCATION: profile.education || 'none',
  });

  try {
    const raw = await completeJson<RawCareerAnalysis>(prompt, 768);
    const analysis = normalizeCareerAnalysis(raw, profile);
    logger.info('Career analysis complete', {
      level: analysis.careerLevel,
      years: analysis.yearsExperience,
      targetRoles: analysis.targetRoles,
    });
    return analysis;
  } catch (err) {
    logger.warn('Career analysis failed, using fallback', err);
    return fallbackAnalysis(profile);
  }
}

export function careerLevelToSearchPrefix(level: CareerLevel): string {
  switch (level) {
    case 'intern':
      return 'intern graduate entry level';
    case 'junior':
      return 'junior associate entry level';
    case 'mid':
      return '';
    case 'senior':
      return 'senior';
    case 'lead':
      return 'senior lead staff';
    case 'principal':
      return 'principal staff';
    case 'executive':
      return 'director head of';
    default:
      return '';
  }
}

export function isSeniorityMismatch(
  jobTitle: string,
  analysis: CareerAnalysis | null | undefined,
): boolean {
  if (!analysis) return false;
  const title = jobTitle.toLowerCase();
  const level = analysis.careerLevel;

  const seniorOnly = /\b(senior|sr\.?|lead|staff|principal|director|head of|vp|chief)\b/i.test(title);
  const juniorOnly = /\b(intern|internship|graduate|entry[- ]?level|trainee)\b/i.test(title);

  if (seniorOnly && ['intern', 'junior'].includes(level)) return true;
  if (juniorOnly && ['senior', 'lead', 'principal', 'executive'].includes(level)) return true;
  return false;
}

export function profileCareerSummary(profile: UserProfile): string {
  const a = profile.careerAnalysis;
  if (!a) return profileToTextFrom(profile);
  return `${profileToTextFrom(profile)}

Career level: ${a.careerLevel} (${a.seniorityLabel})
Years experience: ${a.yearsExperience ?? 'unknown'}
Primary domain: ${a.primaryDomain}
Target roles: ${a.targetRoles.join(', ')}
Appropriate job levels: ${a.appropriateJobLevels.join(', ')}
Strengths: ${a.strengths.join(', ')}
Level assessment: ${a.levelReasoning}`;
}
