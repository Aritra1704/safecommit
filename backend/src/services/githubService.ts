import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

import { env } from '../config/env.js';
import type { AuditFinding, ConsensusResult, MergeGateDecision, PullRequestTarget } from '../types/audit.js';
import { logger } from '../utils/logger.js';

const CHECK_RUN_NAME = 'Safe-Commit Integrity';
const MAX_FINDINGS_IN_CHECK = 10;
const SEVERITY_SORT_PRIORITY: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

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
    const metadata = [
      `**Issue**: \`${finding.issueCode}\``,
      `**Models**: ${finding.sources.join(' + ')}`,
      `**Confidence**: ${(finding.confidence * 100).toFixed(0)}%`,
      `**Fingerprint**: \`${finding.fingerprint}\``,
    ].join('\n');

    return [`### ⚠️ ${finding.severity} — ${finding.title}`, finding.description, metadata].join('\n\n');
  }

  private renderCheckText(consensus: ConsensusResult): string {
    const summaryLines = [
      '### Diagnostics',
      `- Total model findings: ${consensus.diagnostics.totalModelFindings}`,
      `- Consensus findings: ${consensus.diagnostics.consensusFindings}`,
      `- Solo findings: ${consensus.diagnostics.soloFindings}`,
      `- Escalated findings: ${consensus.diagnostics.escalatedFindings}`,
      `- Downgraded findings: ${consensus.diagnostics.downgradedFindings}`,
      '',
    ];

    if (!consensus.findings.length) {
      summaryLines.push('No actionable findings detected by the consensus engine.');
      return summaryLines.join('\n');
    }

    const sortedFindings = consensus.findings
      .slice()
      .sort((a, b) => (SEVERITY_SORT_PRIORITY[b.severity] ?? 0) - (SEVERITY_SORT_PRIORITY[a.severity] ?? 0));

    const detailLines = sortedFindings.slice(0, MAX_FINDINGS_IN_CHECK).map((finding) => {
      const location = `${finding.filePath}:${finding.startLine}`;
      const models = finding.sources.join(' + ');
      return `- [${finding.severity}] ${finding.title} (${location}) — ${finding.issueCode} — models: ${models} — confidence ${(finding.confidence * 100).toFixed(0)}%`;
    });

    if (sortedFindings.length > MAX_FINDINGS_IN_CHECK) {
      detailLines.push(`- ...and ${sortedFindings.length - MAX_FINDINGS_IN_CHECK} more findings.`);
    }

    return [...summaryLines, '### Top Findings', ...detailLines].join('\n');
  }

  async publishMergeGateResult(
    target: PullRequestTarget,
    decision: MergeGateDecision,
    consensus: ConsensusResult,
  ): Promise<void> {
    try {
      const octokit = await this.getInstallationOctokit(target.installationId);

      await octokit.checks.create({
        owner: target.repo.owner,
        repo: target.repo.name,
        name: CHECK_RUN_NAME,
        head_sha: target.pullRequest.headSha,
        status: 'completed',
        conclusion: decision.blocked ? 'failure' : 'success',
        output: {
          title: `Integrity score ${decision.integrityScore}`,
          summary: decision.summary,
          text: this.renderCheckText(consensus),
        },
      });
    } catch (error) {
      logger.error({ err: error, decision }, 'Failed to publish merge gate check');
    }
  }

  async hasMergeOverride(target: PullRequestTarget, keyword: string): Promise<boolean> {
    const keywordLower = keyword.toLowerCase();

    try {
      const octokit = await this.getInstallationOctokit(target.installationId);

      const [issueComments, reviewComments] = await Promise.all([
        octokit.issues.listComments({
          owner: target.repo.owner,
          repo: target.repo.name,
          issue_number: target.pullRequest.number,
          per_page: 100,
        }),
        octokit.pulls.listReviewComments({
          owner: target.repo.owner,
          repo: target.repo.name,
          pull_number: target.pullRequest.number,
          per_page: 100,
        }),
      ]);

      const allBodies = [
        ...issueComments.data.map((comment) => comment.body ?? ''),
        ...reviewComments.data.map((comment) => comment.body ?? ''),
      ];

      return allBodies.some((body) => body.toLowerCase().includes(keywordLower));
    } catch (error) {
      logger.error({ err: error, keyword }, 'Failed to evaluate merge override comments');
      return false;
    }
  }
}

export const githubService = new GithubService();
