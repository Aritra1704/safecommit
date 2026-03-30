import { vi } from 'vitest';

vi.stubEnv('GITHUB_WEBHOOK_SECRET', 'test-secret');
vi.stubEnv('GITHUB_APP_ID', '123456');
vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'test-private-key');
vi.stubEnv('ANTHROPIC_API_KEY', 'test-claude-key');
