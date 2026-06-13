import { getSupabase } from './supabase';
import { logger } from '../utils/logger';
import type { Opportunity } from '../types';

function normalizeRecipient(recipient: string): string {
  return recipient.trim().toLowerCase();
}

export async function filterUnsentOpportunities(
  recipient: string,
  opportunities: Opportunity[],
): Promise<Opportunity[]> {
  if (opportunities.length === 0) return [];

  const key = normalizeRecipient(recipient);
  const oppIds = opportunities.map((o) => o.id);

  try {
    const client = getSupabase();
    const { data, error } = await client
      .from('notification_deliveries')
      .select('opportunity_id')
      .eq('recipient', key)
      .in('opportunity_id', oppIds);

    if (error) {
      if (error.code === 'PGRST205') {
        logger.warn('notification_deliveries table missing — run supabase/notification_deliveries.sql');
        return opportunities;
      }
      throw error;
    }

    const sent = new Set((data ?? []).map((row) => row.opportunity_id as string));
    const unsent = opportunities.filter((o) => !sent.has(o.id));

    if (sent.size > 0) {
      logger.info('Skipping already-notified jobs', {
        recipient: key,
        skipped: sent.size,
        remaining: unsent.length,
      });
    }

    return unsent;
  } catch (err) {
    logger.error('Failed to check notification deliveries', err);
    return opportunities;
  }
}

export async function recordDigestDelivery(
  recipient: string,
  opportunityIds: string[],
): Promise<void> {
  if (opportunityIds.length === 0) return;

  const key = normalizeRecipient(recipient);
  const rows = opportunityIds.map((opportunity_id) => ({
    opportunity_id,
    recipient: key,
  }));

  try {
    const client = getSupabase();
    const { error } = await client
      .from('notification_deliveries')
      .upsert(rows, { onConflict: 'opportunity_id,recipient', ignoreDuplicates: true });

    if (error) {
      if (error.code === 'PGRST205') {
        logger.warn('notification_deliveries table missing — delivery not recorded');
        return;
      }
      throw error;
    }

    logger.info('Recorded digest delivery', { recipient: key, count: opportunityIds.length });
  } catch (err) {
    logger.error('Failed to record notification delivery', err);
  }
}

export function getOwnerDigestRecipient(): string | null {
  return process.env.NOTIFICATION_EMAIL?.trim() || null;
}

export function getWhatsAppDigestRecipient(): string | null {
  const to = process.env.WHATSAPP_TO?.trim();
  if (!to) return null;
  return to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
}
