export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ModelId = 'CLAUDE' | 'GEMINI';

export interface ModelUsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export interface ModelFinding {
  title: string;
  issueCode: string;
  description: string;
  severity: Severity;
  confidence: number;
  filePath: string;
  startLine: number;
  endLine?: number;
  source: ModelId;
}

export interface AuditFinding {
  fingerprint: string;
  title: string;
  issueCode: string;
  description: string;
  severity: Severity;
  confidence: number;
  filePath: string;
  startLine: number;
  endLine?: number;
  sources: ModelId[];
  escalated?: boolean;
  downgraded?: boolean;
}

export interface ConsensusDiagnostics {
  totalModelFindings: number;
  consensusFindings: number;
  escalatedFindings: number;
  downgradedFindings: number;
  soloFindings: number;
}

export interface ConsensusResult {
  findings: AuditFinding[];
  integrityScore: number;
  diagnostics: ConsensusDiagnostics;
}

export interface MergeGateDecision {
  integrityScore: number;
  threshold: number;
  blocked: boolean;
  overrideApplied: boolean;
  summary: string;
}

export interface ModelAnalysisResult {
  findings: ModelFinding[];
  usage?: ModelUsageMetrics;
}

export interface PullRequestTarget {
  installationId: number;
  repo: {
    owner: string;
    name: string;
  };
  pullRequest: {
    number: number;
    headSha: string;
  };
}
