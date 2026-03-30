import { performance } from 'node:perf_hooks';

import type {
  ConsensusResult,
  MergeGateDecision,
  ModelAnalysisResult,
  ModelFinding,
  PullRequestTarget,
} from '../types/audit.js';
import { claudeService } from './claudeService.js';
import { geminiService } from './geminiService.js';
import { consensusService } from './consensusService.js';
import { githubService } from './githubService.js';
import { logger } from '../utils/logger.js';
import { mergeGateConfig } from '../config/mergeGate.js';

const CLAUDE_TIMEOUT_MS = 45_000;
const GEMINI_TIMEOUT_MS = 45_000;

class AuditService {
  async enqueuePullRequestAudit(target: PullRequestTarget): Promise<void> {
    logger.info({ target }, 'Queueing pull request audit');
    await this.processPullRequest(target);
  }

  private async processPullRequest(target: PullRequestTarget): Promise<void> {
    try {
      const fetchStartedAt = performance.now();
      const { diff, title } = await githubService.fetchPullRequestDiff(target);
      const fetchDuration = Math.round(performance.now() - fetchStartedAt);

      if (!diff.trim()) {
        logger.warn({ target }, 'Empty diff received for pull request');
        return;
      }

      logger.info({ title, target, fetchDurationMs: fetchDuration }, 'Running multi-model analysis');

      const claudeRun = await this.runModelAnalysis('CLAUDE', () => claudeService.analyzeDiff(diff), CLAUDE_TIMEOUT_MS);
      const geminiRun = await this.runModelAnalysis('GEMINI', () => geminiService.analyzeDiff(diff), GEMINI_TIMEOUT_MS);

      const modelFindings: ModelFinding[] = [...claudeRun.result.findings, ...geminiRun.result.findings];
      const consensus = consensusService.buildConsensus(modelFindings);

      logger.info({
        findings: consensus.findings.length,
        integrityScore: consensus.integrityScore,
        diagnostics: consensus.diagnostics,
      }, 'Consensus aggregation complete');

      if (consensus.findings.length) {
        await githubService.postReviewComments(target, consensus.findings);
      }

      const threshold = mergeGateConfig.getThreshold(target.repo.owner, target.repo.name);
      const overrideKeyword = mergeGateConfig.overrideKeyword;
      const overrideApplied = await githubService.hasMergeOverride(target, overrideKeyword);

      const decision = this.buildMergeGateDecision(consensus, threshold, overrideApplied, overrideKeyword);

      await githubService.publishMergeGateResult(target, decision, consensus);

      logger.info({ decision }, 'Merge gate decision published');
    } catch (error) {
      logger.error({ err: error, target }, 'Failed to audit pull request');
    }
  }

  private async runModelAnalysis(
    modelId: 'CLAUDE' | 'GEMINI',
    factory: () => Promise<ModelAnalysisResult>,
    timeoutMs: number,
  ): Promise<{ result: ModelAnalysisResult; durationMs: number; timedOut: boolean }> {
    const startedAt = performance.now();
    let timeoutHandle: NodeJS.Timeout | undefined;
    let timedOut = false;

    const timeoutPromise = new Promise<ModelAnalysisResult>((resolve) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        resolve({ findings: [] });
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([factory(), timeoutPromise]);
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const durationMs = Math.round(performance.now() - startedAt);

      logger.info({
        model: modelId,
        durationMs,
        timedOut,
        usage: result.usage,
        findings: result.findings.length,
      }, 'Model analysis completed');

      return { result, durationMs, timedOut };
    } catch (error) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const durationMs = Math.round(performance.now() - startedAt);

      logger.error({ err: error, model: modelId, durationMs }, 'Model analysis crashed');
      return { result: { findings: [] }, durationMs, timedOut: false };
    }
  }

  private buildMergeGateDecision(
    consensus: ConsensusResult,
    threshold: number,
    overrideApplied: boolean,
    overrideKeyword: string,
  ): MergeGateDecision {
    const blocked = consensus.integrityScore < threshold && !overrideApplied;

    const summaryLines = [
      `Integrity score: ${consensus.integrityScore} (threshold ${threshold}).`,
      `Findings: ${consensus.findings.length} total (${consensus.diagnostics.consensusFindings} consensus, ${consensus.diagnostics.soloFindings} solo).`,
    ];

    if (blocked) {
      summaryLines.push('Merges are blocked until findings are resolved or override is applied.');
      summaryLines.push(`Add a PR comment containing "${overrideKeyword}" to bypass.`);
    } else if (overrideApplied) {
      summaryLines.push('Override detected — merge gate bypassed.');
    } else {
      summaryLines.push('Gate conditions satisfied — merge may proceed.');
    }

    return {
      integrityScore: consensus.integrityScore,
      threshold,
      blocked,
      overrideApplied,
      summary: summaryLines.join('\n'),
    };
  }
}

export const auditService = new AuditService();
