import Anthropic from '@anthropic-ai/sdk';

import { env } from '../config/env.js';
import type { ModelAnalysisResult, ModelFinding, Severity } from '../types/audit.js';
import { logger } from '../utils/logger.js';

const DEFAULT_MODEL = 'claude-3-sonnet-20240229';
const MODEL_ID = 'CLAUDE';
const VALID_SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface ClaudeFindingPayload {
  title: string;
  issueCode?: string;
  description: string;
  severity: string;
  confidence?: number;
  filePath: string;
  startLine: number;
  endLine?: number | null;
}

class ClaudeService {
  private client: Anthropic | null;

  constructor() {
    this.client = env.anthropic.apiKey ? new Anthropic({ apiKey: env.anthropic.apiKey }) : null;
  }

  async analyzeDiff(diff: string): Promise<ModelAnalysisResult> {
    if (!this.client) {
      logger.warn('Claude API key missing; returning empty findings.');
      return { findings: [] };
    }

    const systemPrompt = `You are Safe-Commit, an AI code auditor focusing on architectural integrity and technical debt.
Return ONLY valid JSON matching the schema:
{
  "findings": [
    {
      "title": string,
      "issueCode": string,
      "description": string,
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "confidence": number (0.0-1.0),
      "filePath": string,
      "startLine": number,
      "endLine": number | null
    }
  ]
}
Ensure issueCode is a short machine-readable identifier (e.g. SAFE_DEADLOCK, SAFE_SECURITY_XSS).`;

    const userPrompt = `Analyze the following Git diff and flag only true issues with clear justifications. Prefer architectural and security concerns over style nits.

<diff>
${diff}
</diff>`;

    try {
      const response = await this.client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 1024,
        temperature: 0,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const text = response.content
        .map((section) => ('text' in section ? section.text : ''))
        .join('')
        .trim();

      if (!text) {
        return { findings: [] };
      }

      const parsed = JSON.parse(text) as { findings: ClaudeFindingPayload[] };
      const findings: ModelFinding[] = (parsed.findings ?? []).map((finding) => this.normalizeFinding(finding));

      return {
        findings,
        usage: {
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          totalTokens: response.usage?.input_tokens && response.usage?.output_tokens
            ? response.usage.input_tokens + response.usage.output_tokens
            : undefined,
        },
      };
    } catch (error) {
      logger.error({ err: error }, 'Claude analysis failed');
      return { findings: [] };
    }
  }

  private normalizeFinding(payload: ClaudeFindingPayload): ModelFinding {
    const severity = VALID_SEVERITIES.includes(payload.severity as Severity)
      ? (payload.severity as Severity)
      : 'MEDIUM';

    const confidence = typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
      ? Math.min(Math.max(payload.confidence, 0), 1)
      : 0.5;

    return {
      title: payload.title?.trim() || 'Unspecified issue',
      issueCode: payload.issueCode?.trim().toUpperCase() || 'SAFE_GENERIC',
      description: payload.description?.trim() || 'A potential issue was detected.',
      severity,
      confidence,
      filePath: payload.filePath,
      startLine: payload.startLine,
      endLine: payload.endLine ?? undefined,
      source: MODEL_ID,
    };
  }
}

export const claudeService = new ClaudeService();
