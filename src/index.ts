import './config/env';
import cors from 'cors';
import express from 'express';
import routes from './api/routes';
import { envStatus, getEnvPath, loadEnv } from './config/env';
import { startScheduler } from './services/scheduler';
import { runSearchPipeline } from './agents/searchAgent';
import { getHealthReport } from './services/healthCheck';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:4001';

async function main(): Promise<void> {
  loadEnv();
  const envPath = getEnvPath();
  const status = envStatus();

  logger.info('Environment loaded', {
    path: envPath ?? 'default',
    configured: status,
  });

  if (!status.TAVILY_API_KEY) {
    logger.warn('TAVILY_API_KEY missing — search will fail until you add it and restart the server');
  }

  const app = express();

  app.use(
    cors({
      origin: [DASHBOARD_URL, 'http://localhost:4001'],
      methods: ['GET', 'POST', 'OPTIONS'],
    }),
  );
  app.use(express.json());
  app.use('/api', routes);

  app.get('/health', async (req, res) => {
    const deep = req.query.deep === 'true';
    const report = await getHealthReport({ deep });
    const code = report.status === 'unhealthy' ? 503 : 200;
    res.status(code).json(report);
  });

  const report = await getHealthReport();
  if (!report.services.ollama.ok) {
    logger.warn('Ollama is not reachable. Start it with: ollama serve');
  } else {
    logger.info('Ollama connected', report.services.ollama.details);
  }

  app.listen(PORT, () => {
    logger.info(`ApplAI API running on http://localhost:${PORT}`);
  });

  startScheduler();

  if (process.argv.includes('--run-search')) {
    logger.info('Manual search triggered via CLI flag');
    await runSearchPipeline();
    process.exit(0);
  }
}

main().catch((err) => {
  logger.error('Fatal error during startup', err);
  process.exit(1);
});
