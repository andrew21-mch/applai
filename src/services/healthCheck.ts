import { existsSync } from 'fs';
import { chromium } from 'playwright';
import { envStatus } from '../config/env';
import { getNotificationChannels, verifyEmailTransport } from './notifier';
import { getOllamaStatus } from './ollama';
import { getSupabase } from './supabase';
import { isWhatsAppConfigured } from './whatsapp';

export interface ServiceCheck {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  env: Record<string, boolean>;
  services: {
    ollama: ServiceCheck;
    supabase: ServiceCheck;
    tavily: ServiceCheck;
    playwright: ServiceCheck;
    notifications: ServiceCheck;
  };
  scheduler?: {
    search: string;
    digest: string;
    timezone: string;
    digestMinScore: string;
  };
}

async function checkSupabase(): Promise<ServiceCheck> {
  try {
    const client = getSupabase();
    const { error } = await client.from('opportunities').select('id').limit(1);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'Connected' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Supabase unreachable',
    };
  }
}

async function checkTavily(deep = false): Promise<ServiceCheck> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    return { ok: false, message: 'TAVILY_API_KEY not set' };
  }
  if (!deep) {
    return { ok: true, message: 'API key configured' };
  }
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'health check', max_results: 1 }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true, message: 'API key valid' };
    return { ok: false, message: `Tavily returned ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Tavily unreachable',
    };
  }
}

async function checkPlaywright(deep = false): Promise<ServiceCheck> {
  try {
    const execPath = chromium.executablePath();
    if (!existsSync(execPath)) {
      return {
        ok: false,
        message: 'Chromium not installed',
        details: { hint: 'Run: npx playwright install chromium' },
      };
    }

    if (!deep) {
      return { ok: true, message: 'Chromium installed', details: { path: execPath } };
    }

    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto('about:blank');
      return { ok: true, message: 'Chromium launches successfully' };
    } finally {
      await browser?.close().catch(() => undefined);
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Playwright failed',
      details: { hint: 'Run: npx playwright install chromium' },
    };
  }
}

async function checkNotifications(deep = false): Promise<ServiceCheck> {
  const channels = getNotificationChannels();
  const details: Record<string, unknown> = {
    email: channels.email,
    whatsapp: channels.whatsapp,
    digestMinScore: process.env.DIGEST_MIN_SCORE ?? '60',
  };

  if (!channels.email && !channels.whatsapp) {
    return {
      ok: true,
      message: 'Optional — not configured',
      details,
    };
  }

  const parts: string[] = [];
  if (channels.email) parts.push('Email');
  if (channels.whatsapp) parts.push('WhatsApp');

  if (!deep) {
    return {
      ok: true,
      message: `${parts.join(' + ')} configured`,
      details,
    };
  }

  if (channels.email) {
    const emailCheck = await verifyEmailTransport();
    details.emailVerified = emailCheck.ok;
    if (!emailCheck.ok) {
      return { ok: false, message: emailCheck.message, details };
    }
  }

  if (channels.whatsapp && !isWhatsAppConfigured()) {
    return { ok: false, message: 'WhatsApp credentials incomplete', details };
  }

  return {
    ok: true,
    message: deep && channels.email
      ? 'Email verified; channels ready'
      : `${parts.join(' + ')} configured`,
    details,
  };
}

export async function getHealthReport(options?: { deep?: boolean }): Promise<HealthReport> {
  const env = envStatus();
  const ollamaStatus = await getOllamaStatus();

  const ollama: ServiceCheck = ollamaStatus.connected
    ? {
        ok: true,
        message: `Connected — model: ${ollamaStatus.model ?? 'none'}`,
        details: { model: ollamaStatus.model, available: ollamaStatus.available },
      }
    : {
        ok: false,
        message: 'Ollama not reachable',
        details: { hint: 'Run: ollama serve' },
      };

  const [supabase, tavily, playwright, notifications] = await Promise.all([
    env.SUPABASE_URL ? checkSupabase() : Promise.resolve({ ok: false, message: 'SUPABASE_URL not set' }),
    checkTavily(options?.deep),
    checkPlaywright(options?.deep),
    checkNotifications(options?.deep),
  ]);

  const checks = [ollama, supabase, tavily, playwright, notifications];
  const okCount = checks.filter((c) => c.ok).length;

  let status: HealthReport['status'] = 'healthy';
  if (okCount === 0) status = 'unhealthy';
  else if (okCount < checks.length) status = 'degraded';

  return {
    status,
    timestamp: new Date().toISOString(),
    env,
    services: { ollama, supabase, tavily, playwright, notifications },
    scheduler: {
      search: process.env.CRON_SEARCH ?? '0 6 * * *',
      digest: process.env.CRON_DIGEST ?? '0 8 * * *',
      timezone: process.env.CRON_TZ ?? 'server local',
      digestMinScore: process.env.DIGEST_MIN_SCORE ?? '60',
    },
  };
}

export function envFileExists(): boolean {
  return existsSync('.env');
}
