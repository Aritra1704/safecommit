import crypto from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/auditService.js', () => ({
  auditService: {
    enqueuePullRequestAudit: vi.fn().mockResolvedValue(undefined),
  },
}));

const secret = process.env.GITHUB_WEBHOOK_SECRET ?? 'test-secret';

function signPayload(payload: object): { body: Buffer; signature: string } {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  return { body, signature };
}

async function getAuditServiceMock() {
  const module = await import('../src/services/auditService.js');
  return module.auditService as unknown as {
    enqueuePullRequestAudit: vi.Mock;
  };
}

describe('GitHub webhook route', () => {
  beforeEach(async () => {
    const auditService = await getAuditServiceMock();
    auditService.enqueuePullRequestAudit.mockClear();
  });

  it('responds to ping events', async () => {
    const { app } = await import('../src/app.js');

    const payload = { zen: 'Approachable is better than simple.', hook_id: 123 };
    const { body, signature } = signPayload(payload);

    const response = await request(app)
      .post('/webhooks/github')
      .set('X-GitHub-Event', 'ping')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Delivery', 'test-delivery')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ msg: 'pong' });
  });

  it('queues audit for pull_request events', async () => {
    const { app } = await import('../src/app.js');
    const auditService = await getAuditServiceMock();

    const payload = {
      action: 'opened',
      installation: { id: 98765 },
      repository: {
        name: 'safecommit',
        owner: { login: 'safe-commit' },
      },
      pull_request: {
        number: 42,
        head: { sha: 'abc123' },
      },
    };

    const { body, signature } = signPayload(payload);

    const response = await request(app)
      .post('/webhooks/github')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', signature)
      .set('X-GitHub-Delivery', 'delivery-2')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(response.status).toBe(202);
    expect(auditService.enqueuePullRequestAudit).toHaveBeenCalledWith({
      installationId: 98765,
      repo: { owner: 'safe-commit', name: 'safecommit' },
      pullRequest: { number: 42, headSha: 'abc123' },
    });
  });
});
