import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const WEBHOOK_HEADER = 'x-hub-signature-256';

function timingSafeEqual(a: string, b: string): boolean {
  const signatureA = Buffer.from(a);
  const signatureB = Buffer.from(b);

  if (signatureA.length !== signatureB.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureA, signatureB);
}

export function verifyGithubSignature(req: Request, res: Response, next: NextFunction) {
  const provided = req.get(WEBHOOK_HEADER);

  if (!provided) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  if (!env.github.webhookSecret) {
    logger.error('GitHub webhook secret is not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const hmac = crypto.createHmac('sha256', env.github.webhookSecret);
  const payload = (req as unknown as { rawBody?: Buffer }).rawBody;

  if (!payload) {
    return res.status(400).json({ error: 'Missing raw payload for signature verification' });
  }

  const digest = `sha256=${hmac.update(payload).digest('hex')}`;

  if (!timingSafeEqual(digest, provided)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  return next();
}
