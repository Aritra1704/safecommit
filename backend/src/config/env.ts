import * as dotenv from 'dotenv';

dotenv.config();

const requiredVars = ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET', 'ANTHROPIC_API_KEY'];

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
  databaseUrl: process.env.DATABASE_URL ?? '',
};
