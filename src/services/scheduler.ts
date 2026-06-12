import cron from 'node-cron';
import { logger } from '../utils/logger';
import { runSearchPipeline } from '../agents/searchAgent';
import { sendDailyDigest } from '../agents/notificationAgent';

export function startScheduler(): void {
  // Daily search at 6:00 AM
  cron.schedule('0 6 * * *', async () => {
    logger.info('Cron: starting daily search pipeline');
    try {
      await runSearchPipeline();
    } catch (err) {
      logger.error('Cron: search pipeline failed', err);
    }
  });

  // Daily digest at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    logger.info('Cron: sending daily digest');
    try {
      await sendDailyDigest();
    } catch (err) {
      logger.error('Cron: daily digest failed', err);
    }
  });

  logger.info('Scheduler started (search at 6:00 AM, digest at 8:00 AM)');
}
