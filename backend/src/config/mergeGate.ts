import { env } from './env.js';

interface ThresholdOverride {
  key: string;
  threshold: number;
}

const sanitizeThreshold = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const parseOverrides = (raw: string, fallback: number): ThresholdOverride[] => {
  if (!raw.trim()) {
    return [];
  }

  try {
    const asJson = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(asJson)
      .map(([key, value]) => ({ key: key.toLowerCase(), threshold: sanitizeThreshold(value, fallback) }))
      .filter((entry) => entry.key.includes('/'));
  } catch (error) {
    // Not JSON – try comma separated e.g. "org/repo:82,another/repo:76"
    return raw
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const [key, value] = segment.split(':');
        return { key: key.trim().toLowerCase(), threshold: sanitizeThreshold(value, fallback) };
      })
      .filter((entry) => entry.key.includes('/'));
  }
};

const DEFAULT_THRESHOLD = sanitizeThreshold(env.mergeGate.defaultThreshold, 80);
const overrideEntries = parseOverrides(env.mergeGate.thresholdOverrides, DEFAULT_THRESHOLD);
const thresholds = new Map<string, number>(overrideEntries.map((entry) => [entry.key, entry.threshold]));

export const mergeGateConfig = {
  getThreshold(owner: string, repo: string): number {
    const key = `${owner}/${repo}`.toLowerCase();
    return thresholds.get(key) ?? DEFAULT_THRESHOLD;
  },
  get overrideKeyword(): string {
    return env.mergeGate.overrideKeyword;
  },
};
