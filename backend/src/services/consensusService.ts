import crypto from 'node:crypto';

import type { AuditFinding, ConsensusResult, ModelFinding, ModelId, Severity } from '../types/audit.js';

const LINE_TOLERANCE = 3;
const SEVERITY_ORDER: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 25,
  CRITICAL: 40,
};

interface ConsensusBucket {
  issueCode: string;
  filePath: string;
  anchorLine: number;
  findings: ModelFinding[];
}

const severityIndex = (severity: Severity): number => SEVERITY_ORDER.indexOf(severity);

const escalateSeverity = (severity: Severity): Severity => {
  const nextIndex = Math.min(severityIndex(severity) + 1, SEVERITY_ORDER.length - 1);
  return SEVERITY_ORDER[nextIndex];
};

const downgradeSeverity = (severity: Severity): Severity => {
  const nextIndex = Math.max(severityIndex(severity) - 1, 0);
  return SEVERITY_ORDER[nextIndex];
};

const computeFingerprint = (filePath: string, issueCode: string, line: number): string => {
  const hash = crypto.createHash('sha1');
  hash.update(`${filePath}:${issueCode}:${line}`);
  return hash.digest('hex').slice(0, 16);
};

const formatConsensusDescription = (bucket: ConsensusBucket, finalConfidence: number): string => {
  const sorted = bucket.findings.slice().sort((a, b) => severityIndex(b.severity) - severityIndex(a.severity));
  const primary = sorted[0];
  const secondary = sorted.slice(1);
  const sources = Array.from(new Set(bucket.findings.map((f) => f.source)));

  const secondaryNarrative = secondary
    .filter((finding) => finding.description && finding.description !== primary.description)
    .map((finding) => `**${finding.source}**: ${finding.description}`);

  const consensusStatement = `Consensus reached by ${sources.join(' + ')} (confidence ${(finalConfidence * 100).toFixed(0)}%).`;

  return [primary.description, ...secondaryNarrative, consensusStatement].filter(Boolean).join('\n\n');
};

const buildBuckets = (findings: ModelFinding[]): ConsensusBucket[] => {
  const buckets: ConsensusBucket[] = [];

  for (const finding of findings) {
    const match = buckets.find(
      (bucket) =>
        bucket.issueCode === finding.issueCode &&
        bucket.filePath === finding.filePath &&
        Math.abs(bucket.anchorLine - finding.startLine) <= LINE_TOLERANCE,
    );

    if (match) {
      match.findings.push(finding);
      // Move anchor line towards the average for better matching of subsequent entries.
      match.anchorLine = Math.round((match.anchorLine + finding.startLine) / 2);
    } else {
      buckets.push({
        issueCode: finding.issueCode,
        filePath: finding.filePath,
        anchorLine: finding.startLine,
        findings: [finding],
      });
    }
  }

  return buckets;
};

export class ConsensusService {
  buildConsensus(modelFindings: ModelFinding[]): ConsensusResult {
    if (!modelFindings.length) {
      return {
        findings: [],
        integrityScore: 100,
        diagnostics: {
          totalModelFindings: 0,
          consensusFindings: 0,
          escalatedFindings: 0,
          downgradedFindings: 0,
          soloFindings: 0,
        },
      };
    }

    const buckets = buildBuckets(modelFindings);

    const findings: AuditFinding[] = buckets.map((bucket) => this.buildFindingFromBucket(bucket));

    const escalatedFindings = findings.filter((finding) => finding.escalated).length;
    const downgradedFindings = findings.filter((finding) => finding.downgraded).length;
    const consensusFindings = findings.filter((finding) => finding.sources.length >= 2).length;
    const soloFindings = findings.length - consensusFindings;

    const totalPenalty = findings.reduce((acc, finding) => {
      const baseWeight = SEVERITY_WEIGHTS[finding.severity];
      const multiplier = finding.sources.length >= 2 ? 1 : 0.6;
      return acc + baseWeight * multiplier;
    }, 0);

    const integrityScore = Math.max(0, Math.round(100 - totalPenalty));

    return {
      findings,
      integrityScore,
      diagnostics: {
        totalModelFindings: modelFindings.length,
        consensusFindings,
        escalatedFindings,
        downgradedFindings,
        soloFindings,
      },
    };
  }

  private buildFindingFromBucket(bucket: ConsensusBucket): AuditFinding {
    const sortedBySeverity = bucket.findings
      .slice()
      .sort((a, b) => severityIndex(b.severity) - severityIndex(a.severity));

    const primary = sortedBySeverity[0];
    const distinctSources = Array.from(new Set<ModelId>(bucket.findings.map((finding) => finding.source)));

    const severities = bucket.findings.map((finding) => finding.severity);
    const allEqual = severities.every((severity) => severity === severities[0]);

    let finalSeverity: Severity;
    let escalated = false;
    let downgraded = false;

    if (distinctSources.length >= 2) {
      if (allEqual) {
        finalSeverity = escalateSeverity(primary.severity);
        escalated = finalSeverity !== primary.severity;
      } else {
        const lowestSeverity = sortedBySeverity[sortedBySeverity.length - 1].severity;
        finalSeverity = downgradeSeverity(lowestSeverity);
        downgraded = finalSeverity !== lowestSeverity;
      }
    } else {
      finalSeverity = downgradeSeverity(primary.severity);
      downgraded = finalSeverity !== primary.severity;
    }

    const confidenceValues = bucket.findings.map((finding) => finding.confidence);
    const baseConfidence = confidenceValues.reduce((acc, value) => acc + value, 0) / confidenceValues.length;
    const confidenceAdjustment = distinctSources.length >= 2 ? 0.15 : -0.1;
    const finalConfidence = Math.min(Math.max(baseConfidence + confidenceAdjustment, 0), 1);

    const fingerprint = computeFingerprint(primary.filePath, bucket.issueCode, bucket.anchorLine);

    return {
      fingerprint,
      title: primary.title,
      issueCode: bucket.issueCode,
      description:
        distinctSources.length >= 2
          ? formatConsensusDescription(bucket, finalConfidence)
          : primary.description,
      severity: finalSeverity,
      confidence: Number(finalConfidence.toFixed(2)),
      filePath: primary.filePath,
      startLine: bucket.anchorLine,
      endLine: primary.endLine,
      sources: distinctSources,
      escalated,
      downgraded,
    };
  }
}

export const consensusService = new ConsensusService();
