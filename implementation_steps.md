# Safe-Commit — Implementation Playbook

## 0. Pre-Flight Checklist (Week 0)
- [ ] **Foundational decisions**
  - Confirm go-to-market positioning, pricing tiers, and launch geography.
  - Decide on deployment target (Railway, Fly.io, render.com) for early demos.
- [ ] **Team & access**
  - Assign Product, Backend, Frontend, DevOps owners.
  - Provision shared accounts: GitHub org, Anthropic, Google AI Studio, Razorpay sandbox, Railway (or chosen PaaS).
- [ ] **Repository bootstrapping**
  - Initialize monorepo `safe-commit` with `frontend/`, `backend/`, `.github/workflows/` skeleton.
  - Add CI guardrails: lint + tests placeholders for both apps.
- [ ] **Security & compliance**
  - Draft security policy, privacy notice, and incident response checklist.
  - Set up secrets management (1Password/Bitwarden) and document handling policy.

---

## 1. Phase 1 — MVP Foundations (Weeks 1–3)
### 1.1 GitHub App Pipeline
- [ ] Register GitHub App (private at first) and capture `APP_ID`, `PRIVATE_KEY`, `WEBHOOK_SECRET`.
- [x] Implement `/webhooks/github` route with signature verification and retry logic.
- [ ] Persist installation metadata (repo, owner, permissions) in PostgreSQL.

### 1.2 PR Diff Acquisition
- [x] Use GitHub REST API to fetch PR metadata, file list, and patch diffs.
- [ ] Normalize diff payload into internal schema (file path, hunks, code context).
- [ ] Store raw diffs in `audits` table for traceability.

### 1.3 Claude-Only Analysis Loop
- [x] Build `claude.service.ts` wrapper with retry + rate limit handling.
- [x] Design prompt template covering logic gaps, smells, severities.
- [x] Implement `audit.service.ts` orchestrator to:
  - [x] Queue diff chunks.
  - [x] Call Claude, parse structured JSON response.
  - [ ] Write findings (file, line, severity, rationale) to DB.
- [x] Post findings back to PR using GitHub Review Comments API.

### 1.4 Developer Experience
- [x] Create `env.example` and local `docker-compose.yml` (Postgres + backend + worker).
- [x] Add README instructions for running backend (`npm run dev`), seeding DB, and sending sample webhook payload.
- [x] Ship initial smoke test that runs a fake webhook event end-to-end.

**Exit Criteria:** Claude-only audit posts at least one structured comment on a sample PR inside a test repo.

---

## 2. Phase 2 — Consensus Engine (Weeks 4–5)
### 2.1 Gemini Integration
- [ ] Implement `gemini.service.ts` with streaming support and error taxonomy.
- [ ] Mirror Claude prompt, adjusting for Gemini token limits and output schema.
- [ ] Extend orchestrator to run Claude + Gemini in parallel (Promise.all, timeout guard).

### 2.2 Consensus & Severity Logic
- [ ] Define canonical `Finding` shape (hashable key fields) for deduplication.
- [ ] Implement `consensus.service.ts` to intersect findings:
  - Match on file + line +/- tolerance, issue code, severity band.
  - Escalate severity if both agree; downgrade if mismatch.
- [ ] Add configurable merge gate thresholds per repo.

### 2.3 PR Merge Guardrail
- [ ] Emit status check (GitHub Checks API) with Integrity Score and pass/fail state.
- [ ] Allow override comment keyword (e.g., "safe-commit override") to bypass block.
- [ ] Log audit durations and cost metrics for monitoring.

**Exit Criteria:** Dual-model consensus runs automatically, publishes findings + score, and blocks merges under threshold in a staging repo.

---

## 3. Phase 3 — Dashboard & Auth (Weeks 6–7)
### 3.1 Backend Auth & Accounts
- [ ] Implement user registration/login with JWT + refresh tokens.
- [ ] Support linking GitHub installations to user accounts (OAuth device flow or GitHub App authorization URL).
- [ ] Harden middleware: rate limiting, input validation (Zod/celebrate), audit logging.

### 3.2 Frontend Dashboard MVP
- [ ] Scaffold Vite + React app with Tailwind and React Router.
- [ ] Build pages: Login, Repositories, Audit History, Pricing/Billing.
- [ ] Integrate charts (Recharts/Chart.js) for integrity score trends.
- [ ] Connect to backend via typed API client (Axios/React Query).

### 3.3 Payments & Plans
- [ ] Create Razorpay plan products for Free/Studio tiers.
- [ ] Implement checkout flow and webhook to update subscription status.
- [ ] Enforce plan limits (repo count, audit quotas) in backend middleware.

**Exit Criteria:** Authenticated users can view linked repos, audit history, score charts, and activate Studio plan via Razorpay sandbox.

---

## 4. Phase 4 — Automated Documentation Suite (Week 8)
### 4.1 README & CHANGELOG Sync
- [ ] Build `readme.service.ts` to query merged PR context (title, body, diff summary).
- [ ] Generate structured summaries (breaking change, features, bug fixes) via Claude.
- [ ] Commit changes to repo via GitHub Contents API (new branch + PR or direct push based on settings).

### 4.2 Refactor Suggestion Comments
- [ ] Extend audit output to include `refactorSuggestions` payload.
- [ ] Post inline before/after snippets using Suggestion format in PR comments.
- [ ] Log acceptance metrics (was suggestion applied?) via GitHub event hook.

**Exit Criteria:** On merge, README/CHANGELOG updates are proposed automatically; refactor suggestions appear on qualifying findings.

---

## 5. Phase 5 — AMC (Weeks 9–12)
### 5.1 RAG Pipeline
- [ ] Implement document ingestion service: accept zipped client libs, chunk + embed with pgvector.
- [ ] Build retrieval layer integrated with Claude (prompt augments with retrieved context).
- [ ] Add ACL so only client-specific audits leverage private embeddings.

### 5.2 Security Pack Automation
- [ ] Define security checklist templates (OWASP, CVE feeds via NVD API).
- [ ] Schedule quarterly deep scans; deliver PDF/Notion-style reports.
- [ ] Integrate Slack webhook notifications for AMC clients.

### 5.3 AMC Onboarding Workflow
- [ ] Create admin panel for AMC subscription approvals and document upload tracking.
- [ ] Add SLA monitoring dashboard (response times, audit completion rates).
- [ ] Draft manual onboarding playbook shared with Customer Success.

**Exit Criteria:** Paying AMC client can upload assets, receive tailored RAG-backed audits, and security reports delivered on schedule.

---

## 6. Cross-Cutting Concerns
- **Observability:** Add OpenTelemetry traces, structured logging, and Grafana dashboards by end of Phase 2.
- **Cost Monitoring:** Track per-audit token usage, API spend, and enforce caps.
- **Testing Strategy:**
  - Unit tests for services.
  - Integration tests using recorded webhook payloads.
  - Contract tests for AI responses via stubbed fixtures.
- **Release Process:** Weekly staging deployments; monthly tagged releases with changelog automation.
- **Feedback Loop:** In-app "Was this helpful?" widget feeding back into prioritization backlog.

---

## 7. Launch & Growth Milestones
- [ ] Private beta with 5–10 GitHub repos (Week 10).
- [ ] Publish marketing site + waitlist (Week 11).
- [ ] Public launch on Product Hunt / Indie Hackers (Week 12).
- [ ] Post-launch roadmap: GitLab support, Stripe integration, IDE plugin extensions.

---

## 8. Documentation Assets to Maintain
- Architecture diagrams (update after each major phase).
- API reference (backend endpoints, webhook payloads).
- Prompt library with versioning and evaluation notes.
- Playbooks: incident response, on-call rotations, customer onboarding.
