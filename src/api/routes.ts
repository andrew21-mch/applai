import { Router, Request, Response } from 'express';
import { requireApiSecret } from './authMiddleware';
import profileRoutes from './profileRoutes';
import { runSearchPipeline } from '../agents/searchAgent';
import { runFilterAgent } from '../agents/filterAgent';
import { runSubmissionAgent } from '../agents/submissionAgent';
import { sendDailyDigest, sendTestNotification } from '../agents/notificationAgent';
import {
  getPipelineStatus,
  isPipelineRunning,
  subscribePipeline,
} from '../services/pipelineStatus';
import { writeDraftForOpportunity } from '../services/applicationWriter';
import {
  clearOpportunities,
  getOpportunityById,
  listOpportunities,
  updateOpportunityStatus,
} from '../services/supabase';
import { listSubmissionLogs } from '../services/submissionLog';
import { getNotificationChannels } from '../services/notifier';
import { scanOpportunityForm } from '../services/formScanService';
import {
  getSubscription,
  subscribeToJobs,
  unsubscribeFromJobs,
} from '../services/subscriptionService';
import { logger } from '../utils/logger';
import type { OpportunityStatus } from '../types';

const router = Router();

router.use(requireApiSecret);
router.use('/profile', profileRoutes);

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

router.get('/history', async (_req: Request, res: Response) => {
  try {
    const logs = await listSubmissionLogs();
    res.json({
      data: logs,
      count: logs.length,
      hint: logs.length === 0
        ? 'Run supabase/submission_logs.sql in Supabase if the table is missing'
        : undefined,
    });
  } catch (err) {
    logger.error('GET /history failed', err);
    res.status(500).json({ error: 'Failed to fetch submission history' });
  }
});

router.get('/opportunities', async (req: Request, res: Response) => {
  try {
    const filters: {
      status?: OpportunityStatus;
      type?: string;
      minScore?: number;
    } = {};

    if (req.query.status) filters.status = req.query.status as OpportunityStatus;
    if (req.query.type) filters.type = req.query.type as string;
    if (req.query.minScore) filters.minScore = parseInt(req.query.minScore as string, 10);

    const opportunities = await listOpportunities(filters);
    res.json({ data: opportunities, count: opportunities.length });
  } catch (err) {
    logger.error('GET /opportunities failed', err);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

router.post('/opportunities/rescore', async (_req: Request, res: Response) => {
  try {
    const shortlisted = await runFilterAgent();
    res.json({ message: `Rescored opportunities. ${shortlisted} shortlisted (≥60).`, shortlisted });
  } catch (err) {
    logger.error('POST /opportunities/rescore failed', err);
    res.status(500).json({ error: 'Failed to rescore opportunities' });
  }
});

router.post('/opportunities/clear', async (req: Request, res: Response) => {
  try {
    const keepApplied = req.body?.keepApplied !== false;
    const deleted = await clearOpportunities(keepApplied);
    res.json({
      message: keepApplied
        ? `Cleared ${deleted} opportunities (kept applied).`
        : `Cleared all ${deleted} opportunities.`,
      deleted,
    });
  } catch (err) {
    logger.error('POST /opportunities/clear failed', err);
    res.status(500).json({ error: 'Failed to clear opportunities' });
  }
});

router.get('/opportunities/:id', async (req: Request, res: Response) => {
  try {
    const opportunity = await getOpportunityById(paramId(req));
    res.json({ data: opportunity });
  } catch (err) {
    logger.error('GET /opportunities/:id failed', { id: req.params.id, err });
    res.status(404).json({ error: 'Opportunity not found' });
  }
});

router.post('/opportunities/:id/approve', async (req: Request, res: Response) => {
  try {
    const id = paramId(req);
    const apply = req.body?.apply === true;
    const opportunity = await updateOpportunityStatus(id, 'reviewed');

    await writeDraftForOpportunity(id);
    const submission = await runSubmissionAgent(id, { confirmSubmit: apply });

    const message = apply
      ? submission.message
      : `${submission.message} Review the preview, then click Confirm & Submit.`;

    res.json({
      data: opportunity,
      submission,
      message,
      dryRun: !apply,
    });
  } catch (err) {
    logger.error('POST /opportunities/:id/approve failed', { id: req.params.id, err });
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to approve',
    });
  }
});

router.post('/opportunities/:id/reject', async (req: Request, res: Response) => {
  try {
    const opportunity = await updateOpportunityStatus(paramId(req), 'rejected');
    res.json({ data: opportunity, message: 'Opportunity rejected.' });
  } catch (err) {
    logger.error('POST /opportunities/:id/reject failed', { id: req.params.id, err });
    res.status(500).json({ error: 'Failed to reject opportunity' });
  }
});

router.post('/submit/:id', async (req: Request, res: Response) => {
  try {
    const confirmSubmit = req.body?.confirmSubmit === true;
    const result = await runSubmissionAgent(paramId(req), { confirmSubmit });
    const status = result.success ? 200 : result.awaitingConfirmation ? 202 : 400;
    res.status(status).json(result);
  } catch (err) {
    logger.error('POST /submit/:id failed', { id: req.params.id, err });
    res.status(500).json({ error: 'Submission failed' });
  }
});

router.get('/pipeline/status', (_req: Request, res: Response) => {
  res.json({ data: getPipelineStatus() });
});

router.get('/pipeline/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'status', data: getPipelineStatus() })}\n\n`);

  const unsubscribe = subscribePipeline((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});

router.post('/opportunities/:id/scan-form', async (req: Request, res: Response) => {
  try {
    const result = await scanOpportunityForm(paramId(req));
    res.json({ data: result });
  } catch (err) {
    logger.error('POST /opportunities/:id/scan-form failed', { id: req.params.id, err });
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Form scan failed',
    });
  }
});

router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const email = req.body?.email?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid email is required.' });
      return;
    }

    const subscription = await subscribeToJobs({
      email,
      name: req.body?.name,
      minScore: req.body?.minScore !== undefined ? parseInt(String(req.body.minScore), 10) : undefined,
      jobTypes: req.body?.jobTypes,
      careerLevels: req.body?.careerLevels,
    });

    res.json({
      message: `Subscribed ${email} to job notifications (min score ${subscription.minScore}).`,
      data: subscription,
    });
  } catch (err) {
    logger.error('POST /subscribe failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Subscribe failed' });
  }
});

router.delete('/subscribe', async (req: Request, res: Response) => {
  try {
    const email = (req.body?.email ?? req.query.email)?.toString().trim();
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }
    await unsubscribeFromJobs(email);
    res.json({ message: `Unsubscribed ${email}.` });
  } catch (err) {
    logger.error('DELETE /subscribe failed', err);
    res.status(500).json({ error: 'Unsubscribe failed' });
  }
});

router.get('/subscribe', async (req: Request, res: Response) => {
  try {
    const email = req.query.email?.toString().trim();
    if (!email) {
      res.status(400).json({ error: 'Query param email is required.' });
      return;
    }
    const subscription = await getSubscription(email);
    if (!subscription) {
      res.status(404).json({ error: 'No subscription found for this email.' });
      return;
    }
    res.json({ data: subscription });
  } catch (err) {
    logger.error('GET /subscribe failed', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

router.post('/send-digest', async (req: Request, res: Response) => {
  try {
    const channels = getNotificationChannels();
    if (!channels.email && !channels.whatsapp) {
      res.status(400).json({
        error:
          'No notification channel configured. Set EMAIL_USER, EMAIL_PASS, NOTIFICATION_EMAIL or Twilio WhatsApp credentials.',
      });
      return;
    }

    if (req.body?.test === true) {
      await sendTestNotification();
      res.json({ message: 'Test notification sent.', test: true });
      return;
    }

    const minScore =
      req.body?.minScore !== undefined
        ? parseInt(String(req.body.minScore), 10)
        : undefined;

    const count = await sendDailyDigest(minScore);
    if (count === 0) {
      const threshold = minScore ?? parseInt(process.env.DIGEST_MIN_SCORE ?? '60', 10);
      res.json({
        message: `No shortlisted opportunities (score ≥ ${threshold}, status new/reviewed).`,
        count: 0,
      });
      return;
    }

    res.json({
      message: `Digest sent for ${count} opportunit${count === 1 ? 'y' : 'ies'}.`,
      count,
    });
  } catch (err) {
    logger.error('POST /send-digest failed', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to send digest',
    });
  }
});

router.post('/run-search', async (_req: Request, res: Response) => {
  try {
    if (isPipelineRunning()) {
      res.status(409).json({
        error: 'Pipeline already running',
        data: getPipelineStatus(),
      });
      return;
    }

    res.json({
      message: 'Search pipeline started. Watch progress at GET /api/pipeline/status',
      data: getPipelineStatus(),
    });

    runSearchPipeline().catch((err) => {
      logger.error('Background search pipeline failed', err);
    });
  } catch (err) {
    logger.error('POST /run-search failed', err);
    res.status(500).json({ error: 'Failed to start search pipeline' });
  }
});

export default router;
