# Safe-Commit Backend (Phase 1 MVP)

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```
   Run this command from the `backend/` directory.

2. **Environment variables**
   Copy `env.example` to `.env` (or export the values manually) and fill in:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`
   - `GITHUB_WEBHOOK_SECRET`
   - `ANTHROPIC_API_KEY`

3. **Start the API**
   ```bash
   npm run dev
   ```
   The server listens on `http://localhost:3000` by default.

## Testing Webhooks Locally
1. Use `smee.io` or `github-webhook-proxy` to forward GitHub events to your machine.
2. Point GitHub App webhooks to the proxy URL.
3. Start the backend (`npm run dev`).
4. Forward events to `http://localhost:3000/webhooks/github`.

## Running Tests
```bash
npm test
```
Vitest covers signature validation and webhook routing.

## Docker Compose Workflow
1. From the repo root, run:
   ```bash
   docker compose up --build
   ```
2. Backend is available on port `3000`, Postgres on `5432`.

## Next Steps (Phase 2)
- Integrate Gemini and consensus engine.
- Persist audit findings to Postgres.
- Emit GitHub Check runs with architectural integrity scores.
