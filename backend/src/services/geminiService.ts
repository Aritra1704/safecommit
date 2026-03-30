import { GoogleGenerativeAI } from '@google/generative-ai';

import { env } from '../config/env.js';
import type { ModelAnalysisResult, ModelFinding, Severity } from '../types/audit.js';
import { logger } from '../utils/logger.js';

const MODEL_ID = 'GEMINI';
const VALID_SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface GeminiFindingPayload {
  title: string;
  issueCode?: string;
  description: string;
  severity: string;
  confidence?: number;
  filePath: string;
  startLine: number;
  endLine?: number | null;
}

type GeminiErrorKind = 'AUTH' | 'RATE_LIMIT' | 'SERVER' | 'CLIENT' | 'UNKNOWN';

const classifyError = (error: unknown): GeminiErrorKind => {
  if (!error || typeof error !== 'object') {
    return 'UNKNOWN';
  }

  const status = (error as { status?: number; code?: number | string }).status;
  const code = (error as { code?: number | string }).code;
  const message = (error as { message?: string }).message ?? '';

  if (status === 401 || code === 401 || message.toLowerCase().includes('unauthorized')) {
    return 'AUTH';
  }

  if (status === 429 || code === 429 || message.toLowerCase().includes('quota')) {
    return 'RATE_LIMIT';
  }

  if (status && status >= 500) {
    return 'SERVER';
  }

  if (status && status >= 400) {
    return 'CLIENT';
  }

  return 'UNKNOWN';
};

class GeminiService {
  private client: GoogleGenerativeAI | null;

  constructor() {
    this.client = env.google.apiKey ? new GoogleGenerativeAI(env.google.apiKey) : null;
  }

  async analyzeDiff(diff: string): Promise<ModelAnalysisResult> {
    if (!this.client) {
      logger.warn('Google API key missing; skipping Gemini analysis.');
      return { findings: [] };
    }

    const model = this.client.getGenerativeModel({
      model: env.google.model,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `You are Safe-Commit, an AI code auditor focusing on architectural integrity and technical debt.
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
Prioritize real defects over style nits and keep issueCode concise (e.g. SAFE_INPUT_VALIDATION).`;

    const diffPrompt = `Analyze the following Git diff and surface only actionable, high-signal findings.

<diff>
${diff}
</diff>`;

    try {
      const streamResult = await model.generateContentStream({
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
          { role: 'user', parts: [{ text: diffPrompt }] },
        ],
      });

      let responseText = '';
      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          responseText += chunkText;
        }
      }

      responseText = responseText.trim();

      if (!responseText) {
        return { findings: [] };
      }

      const parsed = JSON.parse(responseText) as { findings: GeminiFindingPayload[] };
      const findings: ModelFinding[] = (parsed.findings ?? []).map((finding) => this.normalizeFinding(finding));

      const finalResponse = await streamResult.response;

      return {
        findings,
        usage: {
          inputTokens: finalResponse.usageMetadata?.promptTokenCount,
          outputTokens: finalResponse.usageMetadata?.candidatesTokenCount,
          totalTokens: finalResponse.usageMetadata?.totalTokenCount,
        },
      };
    } catch (error) {
      const kind = classifyError(error);
      logger.error({ err: error, errKind: kind }, 'Gemini analysis failed');
      return { findings: [] };
    }
  }

  private normalizeFinding(payload: GeminiFindingPayload): ModelFinding {
    const severity = VALID_SEVERITIES.includes(payload.severity as Severity)
      ? (payload.severity as Severity)
      : 'MEDIUM';

    const confidence = typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
      ? Math.min(Math.max(payload.confidence, 0), 1)
      : 0.55;

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

export const geminiService = new GeminiService();
