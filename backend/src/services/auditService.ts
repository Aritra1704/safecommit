import type { PullRequestTarget } from '../types/audit.js';
import { claudeService } from './claudeService.js';
import { githubService } from './githubService.js';
import { logger } from '../utils/logger.js';

class AuditService {
  async enqueuePullRequestAudit(target: PullRequestTarget): Promise<void> {
    logger.info({ target }, 'Queueing pull request audit');
    await this.processPullRequest(target);
  }

  private async processPullRequest(target: PullRequestTarget): Promise<void> {
    try {
      const { diff, title } = await githubService.fetchPullRequestDiff(target);

      if (!diff.trim()) {
        logger.warn({ target }, 'Empty diff received for pull request');
        return;
      }

      logger.info({ title, target }, 'Running Claude analysis');
      const findings = await claudeService.analyzeDiff(diff);

      logger.info({ count: findings.length }, 'Claude returned findings');
      await githubService.postReviewComments(target, findings);
    } catch (error) {
      logger.error({ err: error, target }, 'Failed to audit pull request');
    }
  }
}

export const auditService = new AuditService();
