import * as dotenv from 'dotenv';

dotenv.config();

const requiredVars = ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY'];

requiredVars.forEach((key) => {
  if (!process.env[key]) {
    // Do not throw for tests; warn instead.
    console.warn(`[env] ${key} is not set. Some features may not work as expected.`);
  }
});

export const env = {
  port: Number(process.env.PORT) || 3000,
  github: {
    appId: process.env.GITHUB_APP_ID ?? '',
    privateKey: (process.env.GITHUB_APP_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY ?? '',
    model: process.env.GOOGLE_GEMINI_MODEL ?? 'gemini-1.5-pro-latest',
  },
  mergeGate: {
    defaultThreshold: Number(process.env.MERGE_GATE_DEFAULT_THRESHOLD ?? 80),
    thresholdOverrides: process.env.MERGE_GATE_THRESHOLD_OVERRIDES ?? '',
    overrideKeyword: process.env.MERGE_GATE_OVERRIDE_KEYWORD ?? 'safe-commit override',
  },
  databaseUrl: process.env.DATABASE_URL ?? '',
};
