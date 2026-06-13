import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { PARSE_RESUME_PROMPT, fillTemplate } from '../../prompts';
import { mergeWithDefaults, profileDefaults, profileToTextFrom } from '../config/profile';
import { complete, completeJson } from './ollama';
import { getSupabase } from './supabase';
import { logger } from '../utils/logger';
import { analyzeCareerLevel } from '../agents/profileAnalysisAgent';
import { splitList } from '../utils/jsonParse';
import type { CareerAnalysis, ParsedResumeFields, UserProfile } from '../types/profile';

const RESUMES_BUCKET = 'resumes';

interface ProfileRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  role: string | null;
  skills: string[];
  education: string | null;
  experience: string[];
  languages: string[];
  job_types: string[];
  scholarship_types: string[];
  salary_expectation: string | null;
  raw_resume_text: string | null;
  resume_filename: string | null;
  resume_storage_path: string | null;
  career_analysis: CareerAnalysis | null;
  updated_at: string;
}

interface RawParsedResume {
  name?: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  role?: string | null;
  skills?: string | string[] | null;
  education?: string | null;
  experience?: string | string[] | null;
  languages?: string | string[] | null;
}

function rowToProfile(row: ProfileRow): UserProfile {
  return mergeWithDefaults({
    id: row.id,
    name: row.name,
    email: row.email ?? profileDefaults.email,
    phone: row.phone ?? profileDefaults.phone,
    location: row.location ?? profileDefaults.location,
    role: row.role ?? profileDefaults.role,
    skills: row.skills ?? [],
    education: row.education ?? '',
    experience: row.experience ?? [],
    languages: row.languages ?? profileDefaults.languages,
    jobTypes: row.job_types ?? profileDefaults.jobTypes,
    scholarshipTypes: row.scholarship_types ?? profileDefaults.scholarshipTypes,
    salaryExpectation: row.salary_expectation ?? profileDefaults.salaryExpectation,
    rawResumeText: row.raw_resume_text,
    resumeFilename: row.resume_filename,
    resumeStoragePath: row.resume_storage_path,
    careerAnalysis: row.career_analysis ?? null,
    updatedAt: row.updated_at,
  });
}

function normalizeParsed(raw: RawParsedResume): ParsedResumeFields {
  return {
    name: raw.name?.trim() || profileDefaults.name,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    location: raw.location ?? null,
    role: raw.role ?? null,
    skills: splitList(raw.skills),
    education: raw.education ?? null,
    experience: splitList(raw.experience).flatMap((e) => e.split('|').map((s) => s.trim())).filter(Boolean),
    languages: splitList(raw.languages),
  };
}

function fallbackParseFromText(resumeText: string): ParsedResumeFields {
  const emailMatch = resumeText.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const phoneMatch = resumeText.match(/\+?\d[\d\s()-]{8,}\d/);

  const skillKeywords = resumeText.match(
    /\b(PHP|Laravel|Python|JavaScript|TypeScript|React|Next\.js|Node\.js|Vue|Angular|SQL|MySQL|PostgreSQL|MongoDB|Docker|Kubernetes|AWS|Azure|Git|HTML|CSS|Java|C\+\+|C#|Go|Rust|Swift|Kotlin|Flutter|Django|Flask|Express|Supabase|Firebase|Linux|REST|GraphQL|CI\/CD|DevOps|Agile|Scrum)\b/gi,
  );

  const lines = resumeText.split('\n').map((l) => l.trim()).filter(Boolean);
  const name = lines[0]?.length < 60 ? lines[0] : profileDefaults.name;

  return {
    name,
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[0] ?? null,
    location: profileDefaults.location,
    role: profileDefaults.role,
    skills: [...new Set((skillKeywords ?? []).map((s) => s.trim()))],
    education: null,
    experience: lines.filter((l) => l.length > 20 && l.length < 200).slice(0, 8),
    languages: profileDefaults.languages,
  };
}

export async function getActiveProfile(): Promise<UserProfile> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return mergeWithDefaults({});
    return rowToProfile(data as ProfileRow);
  } catch (err) {
    logger.warn('Failed to load profile from DB, using defaults', err);
    return mergeWithDefaults({});
  }
}

export async function profileToText(): Promise<string> {
  const profile = await getActiveProfile();
  return profileToTextFrom(profile);
}

/** Download active resume from Supabase Storage to a local temp file for Playwright upload */
export async function downloadActiveResumeFile(): Promise<{ path: string; filename: string } | null> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('user_profiles')
      .select('resume_storage_path, resume_filename')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.resume_storage_path) return null;

    const { data: blob, error: dlError } = await client.storage
      .from(RESUMES_BUCKET)
      .download(data.resume_storage_path);

    if (dlError || !blob) {
      logger.warn('Resume download failed', dlError);
      return null;
    }

    const tmpDir = path.join(process.cwd(), '.tmp');
    await mkdir(tmpDir, { recursive: true });
    const filename = (data.resume_filename as string) || 'resume.pdf';
    const localPath = path.join(tmpDir, `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    await writeFile(localPath, Buffer.from(await blob.arrayBuffer()));

    return { path: localPath, filename };
  } catch (err) {
    logger.warn('Failed to prepare resume file for upload', err);
    return null;
  }
}

export async function parseResumeWithOllama(resumeText: string): Promise<ParsedResumeFields> {
  const trimmed = resumeText.slice(0, 6000);
  const prompt = fillTemplate(PARSE_RESUME_PROMPT, { RESUME_TEXT: trimmed });

  try {
    const raw = await completeJson<RawParsedResume>(prompt, 768);
    return normalizeParsed(raw);
  } catch (err) {
    logger.warn('Ollama JSON parse failed, retrying with plain text', err);
    try {
      const text = await complete(
        `${prompt}\n\nReturn ONLY the JSON object, nothing else.`,
        768,
      );
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const raw = JSON.parse(jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')) as RawParsedResume;
        return normalizeParsed(raw);
      }
    } catch {
      // fall through
    }
    logger.warn('Using regex fallback for resume parsing');
    return fallbackParseFromText(resumeText);
  }
}

export async function saveProfileFromResume(
  resumeText: string,
  filename: string,
  fileBuffer: Buffer,
): Promise<UserProfile> {
  const parsed = await parseResumeWithOllama(resumeText);
  const client = getSupabase();

  const storagePath = `resumes/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: uploadError } = await client.storage
    .from(RESUMES_BUCKET)
    .upload(storagePath, fileBuffer, { upsert: true });

  if (uploadError) {
    logger.warn('Resume storage upload failed', uploadError);
  }

  await client.from('user_profiles').update({ is_active: false }).eq('is_active', true);

  const profileData = {
    name: parsed.name || profileDefaults.name,
    email: parsed.email ?? profileDefaults.email,
    phone: parsed.phone ?? profileDefaults.phone,
    location: parsed.location ?? profileDefaults.location,
    role: parsed.role ?? profileDefaults.role,
    skills: parsed.skills ?? [],
    education: parsed.education ?? '',
    experience: parsed.experience ?? [],
    languages: parsed.languages?.length ? parsed.languages : profileDefaults.languages,
    job_types: profileDefaults.jobTypes,
    scholarship_types: profileDefaults.scholarshipTypes,
    salary_expectation: profileDefaults.salaryExpectation,
    raw_resume_text: resumeText.slice(0, 50000),
    resume_filename: filename,
    resume_storage_path: uploadError ? null : storagePath,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('user_profiles')
    .insert(profileData)
    .select()
    .single();

  if (error) throw error;

  let profile = rowToProfile(data as ProfileRow);

  try {
    const careerAnalysis = await analyzeCareerLevel(profile);
    const { data: updated, error: updateError } = await client
      .from('user_profiles')
      .update({ career_analysis: careerAnalysis, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .select()
      .single();

    if (!updateError && updated) {
      profile = rowToProfile(updated as ProfileRow);
    }
  } catch (err) {
    logger.warn('Career analysis after resume upload failed', err);
  }

  logger.info('Profile updated from resume', {
    name: profile.name,
    skillCount: profile.skills.length,
    careerLevel: profile.careerAnalysis?.careerLevel,
  });

  return profile;
}

export async function reanalyzeActiveProfile(): Promise<UserProfile> {
  const profile = await getActiveProfile();
  if (!profile.rawResumeText?.trim()) {
    throw new Error('Upload a resume before running career analysis.');
  }

  const careerAnalysis = await analyzeCareerLevel(profile);
  const client = getSupabase();

  if (!profile.id) {
    return { ...profile, careerAnalysis };
  }

  const { data, error } = await client
    .from('user_profiles')
    .update({ career_analysis: careerAnalysis, updated_at: new Date().toISOString() })
    .eq('id', profile.id)
    .select()
    .single();

  if (error) throw error;
  return rowToProfile(data as ProfileRow);
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.txt' || mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }

  if (ext === '.pdf' || mimetype === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (ext === '.docx' || mimetype.includes('wordprocessingml')) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${ext || mimetype}. Use PDF, DOCX, or TXT.`);
}
