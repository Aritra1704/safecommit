import express from 'express';
import type { Request, Response } from 'express';

import { verifyGithubSignature } from '../middleware/githubSignature.js';
import { auditService } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

const router = express.Router({ mergeParams: true });

router.use(
  express.raw({
    type: '*/*',
  }),
  (req, _res, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = req.body as Buffer;
    next();
  },
);

router.post('/', verifyGithubSignature, async (req: Request, res: Response) => {
  try {
    const eventName = req.get('x-github-event');
    const deliveryId = req.get('x-github-delivery');

    if (!eventName) {
      logger.warn('Received GitHub webhook without event header');
      return res.status(400).json({ error: 'Missing event header' });
    }

    const payload = JSON.parse((req as unknown as { rawBody: Buffer }).rawBody.toString('utf8'));
    logger.info({ eventName, deliveryId }, 'Incoming GitHub webhook');

    if (eventName === 'ping') {
      return res.status(200).json({ msg: 'pong' });
    }

    if (eventName === 'pull_request') {
      const action = payload.action as string;
      const pullRequest = payload.pull_request;
      const repository = payload.repository;
      const installation = payload.installation;

      if (!pullRequest || !repository || !installation) {
        logger.warn({ payload }, 'Missing pull request payload fields');
        return res.status(400).json({ error: 'Incomplete pull request payload' });
      }

      if (!['opened', 'synchronize', 'ready_for_review'].includes(action)) {
        logger.info({ action }, 'Ignoring pull request action');
        return res.status(200).json({ ignored: true });
      }

      await auditService.enqueuePullRequestAudit({
        installationId: installation.id,
        repo: {
          owner: repository.owner.login,
          name: repository.name,
        },
        pullRequest: {
          number: pullRequest.number,
          headSha: pullRequest.head.sha,
        },
      });

      return res.status(202).json({ accepted: true });
    }

    logger.info({ eventName }, 'Event type not handled');
    return res.status(200).json({ ignored: true });
  } catch (error) {
    logger.error({ err: error }, 'Failed to process GitHub webhook');
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export { router as githubWebhookRouter };
