export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuditFinding {
  title: string;
  description: string;
  severity: Severity;
  filePath: string;
  startLine: number;
  endLine?: number;
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
