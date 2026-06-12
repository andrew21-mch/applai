import cron from 'node-cron';
import { logger } from '../utils/logger';
import { runSearchPipeline } from '../agents/searchAgent';
import { sendDailyDigest } from '../agents/notificationAgent';

const DEFAULT_CRON_SEARCH = '0 6 * * *';
const DEFAULT_CRON_DIGEST = '0 8 * * *';

function getCronOptions(): { timezone: string } | undefined {
  const tz = process.env.CRON_TZ;
  return tz ? { timezone: tz } : undefined;
}

function resolveCronExpression(
  envKey: string,
  fallback: string,
  label: string,
): string {
  const expr = process.env[envKey]?.trim() || fallback;
  if (!cron.validate(expr)) {
    logger.warn(`Invalid ${label} cron "${expr}", using default "${fallback}"`);
    return fallback;
  }
  return expr;
}

export function startScheduler(): void {
  const searchCron = resolveCronExpression('CRON_SEARCH', DEFAULT_CRON_SEARCH, 'CRON_SEARCH');
  const digestCron = resolveCronExpression('CRON_DIGEST', DEFAULT_CRON_DIGEST, 'CRON_DIGEST');
  const cronOptions = getCronOptions();

  cron.schedule(
    searchCron,
    async () => {
      logger.info('Cron: starting daily search pipeline');
      try {
        await runSearchPipeline();
      } catch (err) {
        logger.error('Cron: search pipeline failed', err);
      }
    },
    cronOptions,
  );

  cron.schedule(
    digestCron,
    async () => {
      logger.info('Cron: sending daily digest');
      try {
        const count = await sendDailyDigest();
        logger.info('Cron: daily digest finished', { count });
      } catch (err) {
        logger.error('Cron: daily digest failed', err);
      }
    },
    cronOptions,
  );

  logger.info('Scheduler started', {
    search: searchCron,
    digest: digestCron,
    timezone: cronOptions?.timezone ?? 'server local',
    digestMinScore: process.env.DIGEST_MIN_SCORE ?? '60',
  });
}
