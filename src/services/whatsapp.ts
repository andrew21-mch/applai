import twilio from 'twilio';
import { logger } from '../utils/logger';
import type { Application, Opportunity } from '../types';

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:4001';
const MAX_WHATSAPP_LENGTH = 1500;

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  return twilio(accountSid, authToken);
}

function formatWhatsAppEntry(opp: Opportunity, application?: Application): string {
  const lines = [
    `*${opp.title}*`,
    `${opp.organization ?? 'N/A'} | Score: ${opp.match_score ?? 'N/A'}/100`,
    `${opp.type} | ${opp.location ?? 'Remote'}`,
    opp.url,
    `Review: ${DASHBOARD_URL}/opportunities/${opp.id}`,
  ];

  if (application?.cover_letter) {
    const preview = application.cover_letter.slice(0, 200);
    lines.push(`Cover letter: ${preview}${application.cover_letter.length > 200 ? '...' : ''}`);
  }

  return lines.join('\n');
}

export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM &&
    process.env.WHATSAPP_TO
  );
}

export async function sendWhatsAppMessage(body: string): Promise<void> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.WHATSAPP_TO;

  if (!client || !from || !to) {
    throw new Error(
      'Twilio WhatsApp not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, and WHATSAPP_TO.',
    );
  }

  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const fromNumber = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

  await client.messages.create({
    from: fromNumber,
    to: toNumber,
    body: body.slice(0, MAX_WHATSAPP_LENGTH),
  });

  logger.info('WhatsApp message sent', { to: toNumber });
}

export async function sendWhatsAppDigest(
  opportunities: Opportunity[],
  applications: Map<string, Application>,
): Promise<void> {
  if (!isWhatsAppConfigured()) {
    logger.info('WhatsApp not configured, skipping digest');
    return;
  }

  if (opportunities.length === 0) return;

  const header = `ApplAI Daily Digest: ${opportunities.length} shortlisted opportunities\n\n`;
  const entries = opportunities
    .map((opp) => formatWhatsAppEntry(opp, applications.get(opp.id)))
    .join('\n\n---\n\n');

  const footer = `\n\nOpen dashboard: ${DASHBOARD_URL}`;
  let body = header + entries + footer;

  if (body.length > MAX_WHATSAPP_LENGTH) {
    const shortEntries = opportunities
      .slice(0, 5)
      .map((opp) => `• ${opp.title} (${opp.match_score}/100)\n  ${DASHBOARD_URL}/opportunities/${opp.id}`)
      .join('\n');

    body = `${header}${shortEntries}\n\n+${opportunities.length - 5} more on dashboard${footer}`;
  }

  await sendWhatsAppMessage(body);
}
