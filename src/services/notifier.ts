import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { sendWhatsAppDigest, isWhatsAppConfigured } from './whatsapp';
import type { Application, Opportunity } from '../types';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:4001';
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.NOTIFICATION_EMAIL);
}

export function getNotificationChannels(): { email: boolean; whatsapp: boolean } {
  return {
    email: isEmailConfigured(),
    whatsapp: isWhatsAppConfigured(),
  };
}

export async function verifyEmailTransport(): Promise<{ ok: boolean; message: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, message: 'Email not configured' };
  }

  try {
    const transporter = getTransporter();
    if (!transporter) {
      return { ok: false, message: 'Email transporter unavailable' };
    }
    await transporter.verify();
    return {
      ok: true,
      message: `Gmail reachable (${process.env.NOTIFICATION_EMAIL})`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Gmail verification failed',
    };
  }
}

function formatOpportunityEntry(
  opp: Opportunity,
  application?: Application,
): string {
  const lines = [
    `---`,
    `Title: ${opp.title}`,
    `Organization: ${opp.organization ?? 'N/A'}`,
    `Type: ${opp.type}`,
    `Match Score: ${opp.match_score ?? 'N/A'}/100`,
    `Location: ${opp.location ?? 'N/A'}`,
    `URL: ${opp.url}`,
    `Dashboard: ${DASHBOARD_URL}/opportunities/${opp.id}`,
    `Approve: ${BASE_URL}/api/opportunities/${opp.id}/approve`,
    `Reject: ${BASE_URL}/api/opportunities/${opp.id}/reject`,
  ];

  if (application?.cover_letter) {
    lines.push('', 'Draft Cover Letter:', application.cover_letter);
  }

  if (application?.essay) {
    lines.push('', 'Draft Personal Statement:', application.essay);
  }

  return lines.join('\n');
}

export async function sendDigest(
  opportunities: Opportunity[],
  applications: Map<string, Application>,
): Promise<void> {
  if (opportunities.length === 0) {
    logger.info('No shortlisted opportunities to send in digest');
    return;
  }

  const tasks: Promise<void>[] = [];

  if (isEmailConfigured()) {
    tasks.push(sendEmailDigest(opportunities, applications));
  } else {
    logger.info('Email not configured, skipping email digest');
  }

  if (isWhatsAppConfigured()) {
    tasks.push(sendWhatsAppDigest(opportunities, applications));
  }

  if (tasks.length === 0) {
    throw new Error(
      'No notification channel configured. Set email (EMAIL_USER, EMAIL_PASS, NOTIFICATION_EMAIL) or WhatsApp (Twilio) credentials.',
    );
  }

  await Promise.all(tasks);
}

async function sendEmailDigest(
  opportunities: Opportunity[],
  applications: Map<string, Application>,
): Promise<void> {
  const to = process.env.NOTIFICATION_EMAIL!;

  try {
    const transporter = getTransporter();
    if (!transporter) return;

    const body = [
      `Good morning! Here are ${opportunities.length} shortlisted opportunities for your review.`,
      '',
      ...opportunities.map((opp) =>
        formatOpportunityEntry(opp, applications.get(opp.id)),
      ),
      '',
      `Review in the dashboard: ${DASHBOARD_URL}`,
      'Or approve/reject via the API links above.',
    ].join('\n');

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `[ApplAI] Daily Digest: ${opportunities.length} new opportunities`,
      text: body,
    });

    logger.info('Digest email sent', { count: opportunities.length, to });
  } catch (err) {
    logger.error('Failed to send digest email', err);
    throw err;
  }
}

export async function sendNotification(
  subject: string,
  body: string,
): Promise<void> {
  if (isEmailConfigured()) {
    const to = process.env.NOTIFICATION_EMAIL!;

    try {
      const transporter = getTransporter();
      if (transporter) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to,
          subject: `[ApplAI] ${subject}`,
          text: body,
        });
        logger.info('Notification email sent', { subject });
      }
    } catch (err) {
      logger.error('Failed to send notification email', { subject, err });
      throw err;
    }
  }

  if (isWhatsAppConfigured()) {
    const { sendWhatsAppMessage } = await import('./whatsapp');
    await sendWhatsAppMessage(`[ApplAI] ${subject}\n\n${body}`);
  }
}
