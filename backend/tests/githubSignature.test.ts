import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { verifyGithubSignature } from '../src/middleware/githubSignature.js';

const secret = process.env.GITHUB_WEBHOOK_SECRET ?? 'test-secret';

function createRequest(payload: object, signatureOverride?: string): Partial<Request> {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature =
    signatureOverride ?? `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;

  return {
    body: rawBody,
    get: vi.fn((header: string) => {
      if (header === 'x-hub-signature-256') {
        return signature;
      }
      return undefined;
    }),
    rawBody,
  } as unknown as Request;
}

function createResponse() {
  const res = {
    statusCode: 0,
    jsonBody: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.jsonBody = payload;
      return this;
    },
  } satisfies Partial<Response>;
  return res as Response & {
    statusCode: number;
    jsonBody: unknown;
  };
}

describe('verifyGithubSignature middleware', () => {
  it('allows request with valid signature', () => {
    const req = createRequest({ hello: 'world' });
    const res = createResponse();
    const next = vi.fn();

    verifyGithubSignature(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('rejects request with invalid signature', () => {
    const req = createRequest({ hello: 'world' }, 'sha256=invalid');
    const res = createResponse();
    const next = vi.fn();

    verifyGithubSignature(req, res, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toMatchObject({ error: 'Invalid webhook signature' });
  });

  it('rejects request without raw payload', () => {
    const req = createRequest({ hello: 'world' });
    (req as unknown as { rawBody?: Buffer }).rawBody = undefined;
    const res = createResponse();

    verifyGithubSignature(req, res, vi.fn());

    expect(res.statusCode).toBe(400);
  });
});
