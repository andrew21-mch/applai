import { readFile } from 'fs/promises';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import type { Application, ExtractedOpportunity, Opportunity, OpportunityStatus } from '../types';

const SCREENSHOTS_BUCKET = 'screenshots';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    // Prefer service role key for backend (bypasses RLS). Fall back to anon key.
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set');
    }

    supabase = createClient(url, key);
    logger.info('Supabase client initialized', {
      keyType: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon',
    });
  }
  return supabase;
}

export async function getExistingUrls(): Promise<Set<string>> {
  try {
    const client = getSupabase();
    const { data, error } = await client.from('opportunities').select('url');

    if (error) throw error;

    return new Set((data ?? []).map((row) => row.url as string));
  } catch (err) {
    logger.error('Failed to fetch existing URLs', err);
    throw err;
  }
}

export async function insertOpportunity(
  opportunity: ExtractedOpportunity,
): Promise<Opportunity | null> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('opportunities')
      .insert({
        title: opportunity.title,
        organization: opportunity.organization,
        type: opportunity.type,
        url: opportunity.url,
        deadline: opportunity.deadline,
        location: opportunity.location,
        description: opportunity.description,
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        logger.debug('Duplicate opportunity skipped', { url: opportunity.url });
        return null;
      }
      throw error;
    }

    return data as Opportunity;
  } catch (err) {
    logger.error('Failed to insert opportunity', { opportunity, err });
    return null;
  }
}

export async function getOpportunitiesByStatus(
  status: OpportunityStatus,
): Promise<Opportunity[]> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('opportunities')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Opportunity[];
  } catch (err) {
    logger.error('Failed to fetch opportunities by status', { status, err });
    throw err;
  }
}

export async function getOpportunitiesWithoutScore(): Promise<Opportunity[]> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('opportunities')
      .select('*')
      .or('match_score.is.null,match_score.eq.0')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Opportunity[];
  } catch (err) {
    logger.error('Failed to fetch unscored opportunities', err);
    throw err;
  }
}

export async function updateMatchScore(id: string, score: number): Promise<void> {
  try {
    const client = getSupabase();
    const { error } = await client
      .from('opportunities')
      .update({ match_score: score })
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to update match score', { id, score, err });
    throw err;
  }
}

export async function getShortlistedOpportunities(
  minScore = 60,
): Promise<Opportunity[]> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('opportunities')
      .select('*')
      .gte('match_score', minScore)
      .in('status', ['new', 'reviewed'])
      .order('match_score', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Opportunity[];
  } catch (err) {
    logger.error('Failed to fetch shortlisted opportunities', err);
    throw err;
  }
}

export async function getShortlistedWithoutApplication(): Promise<Opportunity[]> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('opportunities')
      .select('*, applications(id)')
      .gte('match_score', 60)
      .in('status', ['new', 'reviewed']);

    if (error) throw error;

    return ((data ?? []) as (Opportunity & { applications: { id: string }[] })[])
      .filter((opp) => !opp.applications || opp.applications.length === 0)
      .map(({ applications: _, ...opp }) => opp);
  } catch (err) {
    logger.error('Failed to fetch opportunities without applications', err);
    throw err;
  }
}

export async function insertApplication(
  opportunityId: string,
  coverLetter: string,
  essay: string | null,
): Promise<Application> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('applications')
      .insert({
        opportunity_id: opportunityId,
        cover_letter: coverLetter,
        essay,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Application;
  } catch (err) {
    logger.error('Failed to insert application', { opportunityId, err });
    throw err;
  }
}

export async function clearOpportunities(keepApplied = true): Promise<number> {
  try {
    const client = getSupabase();
    let query = client.from('opportunities').delete().gte('created_at', '1970-01-01');
    if (keepApplied) query = query.neq('status', 'applied');
    const { data, error } = await query.select('id');
    if (error) throw error;
    return data?.length ?? 0;
  } catch (err) {
    logger.error('Failed to clear opportunities', err);
    throw err;
  }
}

export async function listOpportunities(filters?: {
  status?: OpportunityStatus;
  type?: string;
  minScore?: number;
}): Promise<Opportunity[]> {
  try {
    const client = getSupabase();
    let query = client.from('opportunities').select('*').order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.minScore !== undefined) query = query.gte('match_score', filters.minScore);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Opportunity[];
  } catch (err) {
    logger.error('Failed to list opportunities', { filters, err });
    throw err;
  }
}

export async function getOpportunityById(
  id: string,
): Promise<Opportunity & { applications: Application[] }> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('opportunities')
      .select('*, applications(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Opportunity & { applications: Application[] };
  } catch (err) {
    logger.error('Failed to get opportunity by id', { id, err });
    throw err;
  }
}

export async function updateOpportunityStatus(
  id: string,
  status: OpportunityStatus,
): Promise<Opportunity> {
  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('opportunities')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Opportunity;
  } catch (err) {
    logger.error('Failed to update opportunity status', { id, status, err });
    throw err;
  }
}

export async function uploadScreenshot(
  localPath: string,
  filename: string,
): Promise<string> {
  const client = getSupabase();
  const fileBuffer = await readFile(localPath);

  const { error } = await client.storage
    .from(SCREENSHOTS_BUCKET)
    .upload(filename, fileBuffer, { contentType: 'image/png', upsert: true });

  if (error) throw error;

  const { data } = client.storage.from(SCREENSHOTS_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function markApplicationSubmitted(
  applicationId: string,
  updates: { notes?: string; screenshotUrl?: string },
): Promise<void> {
  try {
    const client = getSupabase();
    const { error } = await client
      .from('applications')
      .update({
        submitted_at: new Date().toISOString(),
        notes: updates.notes ?? null,
        response: updates.screenshotUrl ?? null,
      })
      .eq('id', applicationId);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to mark application submitted', { applicationId, err });
    throw err;
  }
}
