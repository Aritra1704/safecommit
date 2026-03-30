import Anthropic from '@anthropic-ai/sdk';

import { env } from '../config/env.js';
import type { AuditFinding } from '../types/audit.js';
import { logger } from '../utils/logger.js';

const DEFAULT_MODEL = 'claude-3-sonnet-20240229';

class ClaudeService {
  private client: Anthropic | null;

  constructor() {
    this.client = env.anthropic.apiKey ? new Anthropic({ apiKey: env.anthropic.apiKey }) : null;
  }

  async analyzeDiff(diff: string): Promise<AuditFinding[]> {
    if (!this.client) {
      logger.warn('Claude API key missing; returning empty findings.');
      return [];
    }

    const systemPrompt = `You are Safe-Commit, an AI code auditor focusing on architectural integrity and technical debt.
Return ONLY valid JSON matching the schema:
{
  "findings": [
    {
      "title": string,
      "description": string,
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "filePath": string,
      "startLine": number,
      "endLine": number | null
    }
  ]
}`;

    const userPrompt = `Analyze the following Git diff and flag true issues:

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
        return [];
      }

      const parsed = JSON.parse(text) as { findings: AuditFinding[] };
      return parsed.findings ?? [];
    } catch (error) {
      logger.error({ err: error }, 'Claude analysis failed');
      return [];
    }
  }
}

export const claudeService = new ClaudeService();
