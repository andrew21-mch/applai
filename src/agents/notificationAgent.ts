import { getSupabase, getShortlistedOpportunities } from '../services/supabase';
import {
  getNotificationChannels,
  sendDigest,
  sendNotification,
} from '../services/notifier';
import { logger } from '../utils/logger';
import type { Application } from '../types';

function digestMinScore(override?: number): number {
  if (override !== undefined) return override;
  return parseInt(process.env.DIGEST_MIN_SCORE ?? '60', 10);
}

export async function sendTestNotification(): Promise<void> {
  const channels = getNotificationChannels();
  if (!channels.email && !channels.whatsapp) {
    throw new Error(
      'No notification channel configured. Set email (EMAIL_USER, EMAIL_PASS, NOTIFICATION_EMAIL) or WhatsApp (Twilio) credentials.',
    );
  }

  await sendNotification(
    'Test notification',
    'ApplAI notifications are working. You will receive a daily digest at the scheduled time if shortlisted opportunities exist.',
  );
}

export async function sendDailyDigest(minScoreOverride?: number): Promise<number> {
  const minScore = digestMinScore(minScoreOverride);
  logger.info('Preparing daily digest', { minScore });

  const opportunities = await getShortlistedOpportunities(minScore);

  if (opportunities.length === 0) {
    logger.info('No shortlisted opportunities for digest', { minScore });
    return 0;
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
  return opportunities.length;
}
