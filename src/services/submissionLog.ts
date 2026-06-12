import { getSupabase } from './supabase';
import { logger } from '../utils/logger';
import type { SubmissionResult } from '../agents/submissionAgent';

export interface SubmissionLogEntry {
  id: string;
  opportunity_id: string;
  application_id: string | null;
  action: 'preview' | 'submit';
  success: boolean;
  message: string | null;
  filled_fields: string[];
  missed_fields: string[];
  screenshot_url: string | null;
  created_at: string;
  opportunities?: {
    title: string;
    organization: string | null;
    url: string;
    status: string;
  };
}

export async function logSubmissionEvent(
  opportunityId: string,
  applicationId: string | null,
  action: 'preview' | 'submit',
  result: SubmissionResult,
): Promise<void> {
  try {
    const client = getSupabase();
    const { error } = await client.from('submission_logs').insert({
      opportunity_id: opportunityId,
      application_id: applicationId,
      action,
      success: result.success,
      message: result.message,
      filled_fields: result.filledFields ?? [],
      missed_fields: result.missedFields ?? [],
      screenshot_url: result.screenshotUrl ?? null,
    });
    if (error) throw error;
  } catch (err) {
    logger.warn('Failed to log submission event', { opportunityId, action, err });
  }
}

function isMissingTableError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'PGRST205'
  );
}

export async function listSubmissionLogs(limit = 50): Promise<SubmissionLogEntry[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from('submission_logs')
    .select('*, opportunities(title, organization, url, status)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) {
      logger.warn(
        'submission_logs table missing — run supabase/submission_logs.sql in Supabase SQL Editor',
      );
      return [];
    }
    throw error;
  }
  return (data ?? []) as SubmissionLogEntry[];
}
