import express from 'express';
import type { Request, Response } from 'express';

import { githubWebhookRouter } from './routes/githubWebhook.js';
import { logger } from './utils/logger.js';

const app = express();

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/webhooks/github', githubWebhookRouter);

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});

export { app };
