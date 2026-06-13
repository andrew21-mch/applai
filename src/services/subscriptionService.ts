import { getSupabase } from './supabase';
import { logger } from '../utils/logger';

export interface JobSubscription {
  id: string;
  email: string;
  name: string | null;
  minScore: number;
  jobTypes: ('job' | 'scholarship')[];
  careerLevels: string[];
  notifyEmail: boolean;
  isActive: boolean;
  createdAt: string;
}

interface SubscriptionRow {
  id: string;
  email: string;
  name: string | null;
  min_score: number;
  job_types: string[];
  career_levels: string[];
  notify_email: boolean;
  is_active: boolean;
  created_at: string;
}

function rowToSubscription(row: SubscriptionRow): JobSubscription {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    minScore: row.min_score,
    jobTypes: (row.job_types ?? ['job']) as JobSubscription['jobTypes'],
    careerLevels: row.career_levels ?? [],
    notifyEmail: row.notify_email,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function subscribeToJobs(input: {
  email: string;
  name?: string;
  minScore?: number;
  jobTypes?: ('job' | 'scholarship')[];
  careerLevels?: string[];
}): Promise<JobSubscription> {
  const client = getSupabase();
  const email = input.email.trim().toLowerCase();

  const row = {
    email,
    name: input.name?.trim() || null,
    min_score: input.minScore ?? parseInt(process.env.DIGEST_MIN_SCORE ?? '60', 10),
    job_types: input.jobTypes ?? ['job'],
    career_levels: input.careerLevels ?? [],
    notify_email: true,
    is_active: true,
  };

  const { data, error } = await client
    .from('job_subscriptions')
    .upsert(row, { onConflict: 'email' })
    .select()
    .single();

  if (error) throw error;
  logger.info('Job subscription saved', { email });
  return rowToSubscription(data as SubscriptionRow);
}

export async function unsubscribeFromJobs(email: string): Promise<void> {
  const client = getSupabase();
  const { error } = await client
    .from('job_subscriptions')
    .update({ is_active: false })
    .eq('email', email.trim().toLowerCase());

  if (error) throw error;
  logger.info('Job subscription deactivated', { email });
}

export async function getSubscription(email: string): Promise<JobSubscription | null> {
  const client = getSupabase();
  const { data, error } = await client
    .from('job_subscriptions')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToSubscription(data as SubscriptionRow);
}

export async function listActiveSubscriptions(): Promise<JobSubscription[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from('job_subscriptions')
    .select('*')
    .eq('is_active', true)
    .eq('notify_email', true);

  if (error) {
    if (error.code === 'PGRST205') {
      logger.warn('job_subscriptions table missing — run supabase/subscriptions.sql');
      return [];
    }
    throw error;
  }

  return ((data ?? []) as SubscriptionRow[]).map(rowToSubscription);
}
