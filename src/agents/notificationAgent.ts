import { getSupabase, getShortlistedOpportunities } from '../services/supabase';
import {
  getNotificationChannels,
  isEmailConfigured,
  sendDigest,
  sendNotification,
} from '../services/notifier';
import { isWhatsAppConfigured } from '../services/whatsapp';
import {
  filterUnsentOpportunities,
  getOwnerDigestRecipient,
  getWhatsAppDigestRecipient,
  recordDigestDelivery,
} from '../services/notificationDelivery';
import { listActiveSubscriptions } from '../services/subscriptionService';
import { logger } from '../utils/logger';
import type { Application, Opportunity } from '../types';

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

async function sendDigestToRecipient(
  recipient: string,
  opportunities: Opportunity[],
  appMap: Map<string, Application>,
  options?: { greeting?: string; ownerChannels?: boolean },
): Promise<number> {
  const unsent = await filterUnsentOpportunities(recipient, opportunities);
  if (unsent.length === 0) {
    logger.info('No new jobs for recipient (all already sent)', { recipient });
    return 0;
  }

  const ids = unsent.map((o) => o.id);

  if (options?.ownerChannels) {
    await sendDigest(unsent, appMap, { greeting: options.greeting });
    const ownerEmail = getOwnerDigestRecipient();
    if (ownerEmail) await recordDigestDelivery(ownerEmail, ids);
    const whatsapp = getWhatsAppDigestRecipient();
    if (whatsapp && isWhatsAppConfigured()) await recordDigestDelivery(whatsapp, ids);
  } else {
    await sendDigest(unsent, appMap, { to: recipient, greeting: options?.greeting });
    await recordDigestDelivery(recipient, ids);
  }

  return unsent.length;
}

export async function sendDailyDigest(minScoreOverride?: number): Promise<number> {
  const defaultMin = digestMinScore(minScoreOverride);
  const subscriptions = await listActiveSubscriptions();
  const minScore = subscriptions.length
    ? Math.min(defaultMin, ...subscriptions.map((s) => s.minScore))
    : defaultMin;

  logger.info('Preparing daily digest', { minScore, subscribers: subscriptions.length });

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

  let totalSent = 0;

  const ownerEmail = getOwnerDigestRecipient();
  const ownerOpps = opportunities.filter((o) => (o.match_score ?? 0) >= defaultMin);

  if (ownerOpps.length > 0 && isEmailConfigured() && ownerEmail) {
    try {
      const count = await sendDigestToRecipient(ownerEmail, ownerOpps, appMap, {
        ownerChannels: true,
      });
      totalSent += count;
    } catch (err) {
      logger.error('Owner digest failed', err);
    }
  } else if (ownerOpps.length > 0 && isWhatsAppConfigured() && !isEmailConfigured()) {
    const whatsapp = getWhatsAppDigestRecipient();
    if (whatsapp) {
      try {
        const count = await sendDigestToRecipient(whatsapp, ownerOpps, appMap, {
          ownerChannels: true,
        });
        totalSent += count;
      } catch (err) {
        logger.error('WhatsApp digest failed', err);
      }
    }
  }

  for (const sub of subscriptions) {
    const subOpps = filterForSubscriber(opportunities, sub);
    if (subOpps.length === 0) continue;
    if (!isEmailConfigured()) continue;

    try {
      const count = await sendDigestToRecipient(sub.email, subOpps, appMap, {
        greeting: `Hi${sub.name ? ` ${sub.name}` : ''}! Here are new job matches (score ≥ ${sub.minScore}).`,
      });
      if (count > 0) {
        logger.info('Subscriber digest sent', { email: sub.email, count });
        totalSent += count;
      }
    } catch (err) {
      logger.error('Subscriber digest failed', { email: sub.email, err });
    }
  }

  return totalSent;
}

function filterForSubscriber(
  opportunities: Opportunity[],
  sub: { minScore: number; jobTypes: string[]; careerLevels: string[] },
): Opportunity[] {
  return opportunities.filter((o) => {
    if ((o.match_score ?? 0) < sub.minScore) return false;
    if (sub.jobTypes.length && !sub.jobTypes.includes(o.type)) return false;
    return true;
  });
}

/** Instant alert after search when NOTIFY_ON_MATCH=true */
export async function notifyOnNewMatches(newIds: string[]): Promise<void> {
  if (process.env.NOTIFY_ON_MATCH !== 'true' || newIds.length === 0) return;
  if (!isEmailConfigured()) return;

  const minScore = parseInt(process.env.NOTIFY_MIN_SCORE ?? '70', 10);
  const client = getSupabase();

  const { data, error } = await client
    .from('opportunities')
    .select('*')
    .in('id', newIds)
    .gte('match_score', minScore);

  if (error || !data?.length) return;

  const opportunities = data as Opportunity[];
  const ownerEmail = getOwnerDigestRecipient();
  if (!ownerEmail) return;

  const unsent = await filterUnsentOpportunities(ownerEmail, opportunities);
  if (unsent.length === 0) return;

  const lines = unsent.map(
    (o) => `• ${o.title} (${o.match_score}/100) — ${process.env.DASHBOARD_URL ?? 'http://localhost:4001'}/opportunities/${o.id}`,
  );

  await sendNotification(
    `${unsent.length} new match${unsent.length === 1 ? '' : 'es'}`,
    `New opportunities from your latest search:\n\n${lines.join('\n')}`,
  );

  await recordDigestDelivery(ownerEmail, unsent.map((o) => o.id));
  logger.info('Instant match notification sent', { count: unsent.length });
}
