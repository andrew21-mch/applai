import { getSupabase, getShortlistedOpportunities } from '../services/supabase';
import { sendDigest } from '../services/notifier';
import { logger } from '../utils/logger';
import type { Application } from '../types';

export async function sendDailyDigest(): Promise<void> {
  logger.info('Preparing daily digest');

  const opportunities = await getShortlistedOpportunities(60);

  if (opportunities.length === 0) {
    logger.info('No shortlisted opportunities for digest');
    return;
  }

  const client = getSupabase();
  const oppIds = opportunities.map((o) => o.id);

  const { data: applications, error } = await client
    .from('applications')
    .select('*')
    .in('opportunity_id', oppIds);

  if (error) {
    logger.error('Failed to fetch applications for digest', error);
    throw error;
  }

  const appMap = new Map<string, Application>();
  for (const app of (applications ?? []) as Application[]) {
    appMap.set(app.opportunity_id, app);
  }

  await sendDigest(opportunities, appMap);
}
