import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

import { env } from '../config/env.js';
import type { AuditFinding, PullRequestTarget } from '../types/audit.js';
import { logger } from '../utils/logger.js';

class GithubService {
  private appAuth = createAppAuth({
    appId: env.github.appId,
    privateKey: env.github.privateKey,
  });

  private async getInstallationOctokit(installationId: number): Promise<Octokit> {
    const auth = await this.appAuth({ type: 'installation', installationId });
    return new Octokit({ auth: auth.token });
  }

  async fetchPullRequestDiff(target: PullRequestTarget): Promise<{ diff: string; title: string }> {
    const octokit = await this.getInstallationOctokit(target.installationId);

    const diffResponse = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner: target.repo.owner,
      repo: target.repo.name,
      pull_number: target.pullRequest.number,
      headers: {
        accept: 'application/vnd.github.v3.diff',
      },
    });

    const metadataResponse = await octokit.pulls.get({
      owner: target.repo.owner,
      repo: target.repo.name,
      pull_number: target.pullRequest.number,
    });

    const diff = typeof diffResponse.data === 'string' ? (diffResponse.data as string) : '';

    return {
      diff,
      title: metadataResponse.data.title,
    };
  }

  async postReviewComments(target: PullRequestTarget, findings: AuditFinding[]): Promise<void> {
    if (!findings.length) {
      return;
    }

    const octokit = await this.getInstallationOctokit(target.installationId);

    for (const finding of findings) {
      try {
        await octokit.pulls.createReviewComment({
          owner: target.repo.owner,
          repo: target.repo.name,
          pull_number: target.pullRequest.number,
          body: this.renderFindingComment(finding),
          commit_id: target.pullRequest.headSha,
          path: finding.filePath,
          side: 'RIGHT',
          line: finding.startLine,
        });
      } catch (error) {
        logger.error({ err: error, finding }, 'Failed to post review comment');
      }
    }
  }

  private renderFindingComment(finding: AuditFinding): string {
    return [`### ⚠️ ${finding.severity} — ${finding.title}`, finding.description].join('\n\n');
  }
}

export const githubService = new GithubService();
