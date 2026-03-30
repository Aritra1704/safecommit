 # Safe-Commit — AI Code Auditor
## Project Overview
A GitHub/GitLab-integrated AI agent that audits code for **Architectural Integrity** and
**Technical Debt** on every PR — using a dual-AI consensus model (Claude + Gemini).
**Target Market:** Solo SaaS builders, small-to-medium dev shops, outsourced agencies.
---
## Business Model
| Tier | Price | Details |
|---|---|---|
| Free | $0/mo | 1 repo, 50 audits/month |
| Studio | $19/mo | 3 repos, unlimited audits, all features |
| AMC - RAG Tuning | $500/yr | Private model fine-tuned on client's internal libraries |
| AMC - Security Pack | $1,200/yr | Quarterly deep-scans, CVE reports, Slack access |
---
## Core Features
### 1. Logic-Gap Detection (Consensus Model)
- Claude and Gemini independently analyse each PR diff
- Only issues **both models flag** are surfaced — eliminates noise
- Severity levels: LOW / MEDIUM / HIGH / CRITICAL
- Blocks merge on HIGH+ by default (configurable)
### 2. Automated README Sync
- Triggered on every merged PR
- Updates CHANGELOG.md, README, and API docs automatically
- Uses diff context to generate accurate, scoped summaries
### 3. Refactor Suggestions
- Detects code smells: deeply nested logic, god objects, brittle type assertions
- Suggests idiomatic 2026 patterns for the detected stack
- Delivered as inline PR comments with before/after examples
### 4. Architectural Integrity Score
- 0–100 score per audit
- Configurable merge gate threshold (e.g. block if < 70)
- Dashboard view for score trends over time
---
## Tech Stack
### Frontend
- React + Vite
- TailwindCSS
- Dashboard: score trends, audit history, repo settings
### Backend
- Node.js + Express
- PostgreSQL (audit logs, repo configs, user accounts)
- JWT auth
- Docker Compose + Nginx
### AI Layer
- Anthropic API (Claude) — logic analysis
- Google Gemini API — cross-check / consensus
- RAG pipeline (for AMC clients): LangChain + pgvector
### Integrations
- GitHub App (OAuth + Webhooks)
- GitLab Webhook
- Razorpay (payments, Indian market)
---
## Project Structure
```
safe-commit/
├── frontend/              # React + Vite dashboard
│   ├── src/
│   │   ├── pages/         # Dashboard, Repos, Audit Detail, Pricing
│   │   ├── components/    # AuditScore, DiffViewer, IssueCard
│   │   └── api/           # API client
│   └── vite.config.ts
│
├── backend/               # Node.js + Express API
│   ├── src/
│   │   ├── routes/        # /audit, /repos, /webhooks, /auth
│   │   ├── services/
│   │   │   ├── audit.service.ts      # Orchestrates dual-AI analysis
│   │   │   ├── claude.service.ts     # Anthropic API calls
│   │   │   ├── gemini.service.ts     # Gemini API calls
│   │   │   ├── consensus.service.ts  # Merges + deduplicates findings
│   │   │   ├── readme.service.ts     # Auto doc sync
│   │   │   └── github.service.ts    # GitHub App integration
│   │   ├── models/        # DB models (Audit, Repo, User, Finding)
│   │   └── middleware/    # Auth, rate limiting
│   └── index.ts
│
├── docker-compose.yml
├── nginx.conf
└── .env.example
```
---
## Build Phases
### Phase 1 — MVP (Weeks 1–3)
- [ ] GitHub App setup (OAuth, webhook listener)
- [ ] PR diff fetcher
- [ ] Claude API integration for logic analysis
- [ ] Basic finding output as PR comment
- [ ] Single-model (Claude only) audit flow working end-to-end
### Phase 2 — Consensus Engine (Weeks 4–5)
- [ ] Gemini API integration
- [ ] Consensus service (compare + deduplicate findings from both models)
- [ ] Severity scoring logic
- [ ] Merge gate (block PR if score < threshold)
### Phase 3 — Dashboard + Auth (Weeks 6–7)
- [ ] JWT auth (signup/login)
- [ ] Repo management UI
- [ ] Audit history + integrity score trend charts
- [ ] Razorpay payment integration ($19/mo plan)
### Phase 4 — Automated Docs (Week 8)
- [ ] README sync service (triggered on merge)
- [ ] CHANGELOG auto-update
- [ ] Refactor suggestion inline comments
### Phase 5 — AMC Features (Weeks 9–12)
- [ ] RAG pipeline with LangChain + pgvector
- [ ] Client library ingestion for private model tuning
- [ ] Security scan templates (OWASP Top 10, CVE checks)
- [ ] AMC onboarding flow
---
## Environment Variables
```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
# Google Gemini
GEMINI_API_KEY=...
# GitHub App
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
# Database
DATABASE_URL=postgresql://...
# Auth
JWT_SECRET=
# Payments
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```
---
## Audit Flow (How It Works)
```
GitHub PR opened/updated
│
▼
Webhook → backend /webhooks/github
│
▼
Fetch PR diff via GitHub API
│
├──────────────────────────┐
▼                          ▼
Claude analysis              Gemini analysis
(logic gaps, smells)         (cross-check)
│                          │
└──────────┬───────────────┘
▼
Consensus Service
(deduplicate, score)
│
┌──────────┴───────────┐
▼                      ▼
PR Comments            Integrity Score
(inline findings)      (pass/fail check)
│
▼
README Sync (on merge)
```
---
## Key Decisions & Notes
- **Consensus model** is the core differentiator — market it hard
- **Free tier** exists only to reduce signup friction, not for revenue
- **AMC onboarding** should be done manually for first 10–15 clients
- **Razorpay** for Indian market payments; add Stripe later for global
- Start with GitHub only — add GitLab in Phase 3+
- Keep audit latency under 90 seconds (run in parallel with CI)
---
## Resources
- Anthropic API docs: https://docs.anthropic.com
- Gemini API docs: https://ai.google.dev/docs
- GitHub Apps docs: https://docs.github.com/en/apps
