# 16Bits OmniOps
> **Autonomous Multi-Agent Enterprise SRE Swarm & Incident Orchestrator**

[![npm version](https://img.shields.io/npm/v/omniops.svg)](https://www.npmjs.com/package/omniops)
[![Backend Status](https://img.shields.io/badge/Backend-Live%20on%20Render-success)](https://one6bits.onrender.com/api/health)
[![Theme](https://img.shields.io/badge/Hackathon%20Theme-Agentic%20AI%20%26%20Intelligent%20Systems-blue)]()

- **Live Web Console**: [https://16bits-omniops.vercel.app](https://16bits-omniops.vercel.app)
- **Live Backend API**: [https://one6bits.onrender.com](https://one6bits.onrender.com)
- **Global npm Package**: [`omniops@1.0.4`](https://www.npmjs.com/package/omniops) (`npm i -g omniops` or `npx omniops`)
- **Interactive Documentation**: [https://16bits-omniops.vercel.app/docs](https://16bits-omniops.vercel.app/docs)
- **Demo Video Walkthrough**: TODO - add the real video link before submission
- **Challenge Theme**: Agentic AI & Intelligent Systems

---

## 1. Executive Overview & Problem Statement
Modern enterprise infrastructure suffers from fragmented monitoring tools, opaque failure cascades, and chaotic 2 AM incident war rooms. When critical systems fail (database connection saturation, Redis eviction cascades, third-party webhook rate throttles), engineering teams waste 1 to 4 hours manually grepping logs, arguing over root causes, and guessing remediation steps. At an average enterprise downtime cost of $5,600/minute, every delayed incident costs tens of thousands of dollars.

**16Bits OmniOps** turns raw error logs into a reviewed remediation playbook in seconds. Engineers or automated monitors send unstructured error logs to OmniOps. A 4-agent swarm checks host vitals, matches the incident against the team's runbook library, checks the plan against safety rules, and proposes fix commands. OmniOps does not run commands itself: high-risk plans wait for a signed-in operator to approve them.

---

## 2. The 4-Agent Consensus Swarm

Instead of a single brittle prompt, **16Bits OmniOps** deploys a specialized 4-agent consensus swarm:

1. **Planner Agent**: Parses messy logs, eliminates noise, and constructs an investigative Directed Acyclic Graph (DAG).
2. **Investigator Agent**: Reads live host telemetry (`os.loadavg`, memory, process uptime), inspects codebase files via the AST call graph, and searches the runbook (SOP) library: BM25 keyword ranking with an ops synonym map, Gemini embeddings when `GEMINI_API_KEY` is set, and an LLM pick of the best of the top 3 (or "none applies").
3. **Verifier Gate (Safety & SLA)**: Reviews the plan against SLA and safety constraints. The approval gate itself is deterministic code, not the LLM: any HIGH/CRITICAL incident, or any plan containing a destructive command pattern (`DROP TABLE`, `rm -rf`, `FLUSHALL`), is held as `AWAITING_APPROVAL` until a signed-in operator approves it. On top of that, the Verifier returns a structured JSON verdict (`verdict`, `risk`, `requiresApproval`, `slaAtRisk`, `destructiveActions`, `reasons`, `summary`) that is validated with zod. The verdict can only add a hold, never remove one, and if a model's reply is not valid JSON matching the schema, the gate fails closed and holds the incident for a human.
4. **Synthesizer & Dispatcher Agent**: Writes the executive summary, numbered remediation playbook and stakeholder update, posts to the team's own Slack channel (connected in Settings), and links the LangSmith trace when `LANGSMITH_API_KEY` is set.

---

## 3. Active Input & Output Guardrails

OmniOps applies guardrails on the way in and on the way out:

- **Input Guardrails**:
  - **Secret & PII Redaction**: Automatically scrubs AWS secret keys (`AKIA...`), Bearer tokens, private SSH keys, and database connection URIs from incoming error logs before LLM processing.
  - **Prompt Injection Defense**: Detects and neutralizes meta-instruction injection attempts (`Ignore previous instructions`, `System Override`, `DAN Mode`) by treating them strictly as passive log data.
- **Output Guardrails**:
  - **Destructive Command Interception**: Scans synthesized remediation commands for dangerous patterns (`rm -rf /`, `DROP DATABASE`, `mkfs`, `dd if=`, `FLUSHALL --force`). Flags destructive commands and forces the plan into the human approval queue.
  - **Zero-Emoji Enforcement**: Strips accidental unicode emoji characters from all machine outputs to preserve clean, professional terminal and enterprise compliance.
- **AI Security**:
  - **Backend-only LLM calls**: every Groq/Gemini call is made by the backend (`backend/src/services/aiService.ts`). The browser and the CLI never see a provider key.
  - **Secrets protection**: provider keys, `JWT_SECRET` and `WEBHOOK_SECRET` live only in server env vars. Team Groq keys and Slack webhooks are write-only in the API (masked on read). Secrets in incoming logs are redacted before any LLM call.
  - **JSON mode for decisions**: the calls that drive decisions (the Verifier verdict and the runbook pick) use Groq Structured Outputs: strict `json_schema` (constrained decoding) on models that support it (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`), JSON Object Mode on the rest, and `responseMimeType: application/json` on Gemini. Every reply is re-validated with zod before use. Invalid output never loosens the gate: the Verifier fails closed and the runbook pick falls back to the search ranking. Schemas: `backend/src/schemas/aiSchemas.ts`.

---

## 4. Tech Stack & Architecture

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, React Router v7, Nes.css, Tailwind CSS | Interactive retro operations console (`/` and `/docs`) with live SSE streaming |
| **Backend** | Node.js, Express.js, TypeScript/ESM | Production REST and Server-Sent Events (SSE) streaming engine |
| **Authentication** | JWT (JSON Web Tokens), bcryptjs | Operator login. Approvals, runbook uploads and incident creation require a JWT, and the approver's identity is taken from the token into the audit trail |
| **Database** | Postgres (`pg`, e.g. Neon) when `DATABASE_URL` is set; SQLite (`better-sqlite3`, WAL) otherwise | Tables for users, incidents (including who approved them) and per-agent step logs |
| **Artificial Intelligence** | Groq (primary) + Google Gemini (optional fallback) | Groq model set by `GROQ_MODEL` (default `openai/gpt-oss-120b`); if Groq rejects it, falls back to `openai/gpt-oss-20b`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, then Gemini (`gemini-2.5-flash`) if a key is set. `/api/health` shows the model actually in use |
| **Observability** | LangSmith (`RunTree`) | Distributed tracing and child-span telemetry of every agent thought and tool call |
| **CLI Tool** | Node.js global binary (`omniops`) | Terminal client with piping support; `omniops approve` signs in as an operator |

---

## 5. Quickstart Guide

### Option A: Terminal CLI Usage (`omniops`)
```bash
# 1. Install CLI globally
npm install -g omniops

# 2. Pipe syslog errors directly into swarm
tail -n 30 /var/log/syslog | omniops CRITICAL

# 3. Triage an explicit production error
omniops triage "PostgreSQL FATAL: remaining connection slots are reserved" HIGH

# 4. Check system health and loaded runbooks
omniops doctor

# 5. Approve a held incident (v1.0.3+; team features need v1.0.4). Signs in as the demo operator unless you set
#    OMNIOPS_TOKEN, or OMNIOPS_EMAIL / OMNIOPS_PASSWORD
omniops approve <incidentId>
```

### Option B: Local Full-Stack Setup

#### Backend (Port 8000)
```bash
cd backend
npm install
cp .env.example .env
# Required: JWT_SECRET (long random string; the server will not start without it)
# AI: GROQ_API_KEY with AI_PROVIDER=groq, GROQ_MODEL=openai/gpt-oss-120b (default)
#     or GEMINI_API_KEY with AI_PROVIDER=gemini (gemini-2.5-flash). The other key, if set, is the fallback.
# No key = MOCK MODE (banner shown in the UI)
npm run dev
```

#### Frontend (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

#### End-to-end tests
With the backend running on port 8000:
```bash
cd backend
npm run test:e2e   # 14 checks: health, auth, guardrails, execute, SSE stream, webhook, approval gate (incl. 401 without a token), audit trail
```

---

## 6. Production Cloud Deployment

### Frontend Deployment on Vercel
1. Connect this repository to **Vercel**.
2. Set the Root Directory to `frontend`.
3. Set the Environment Variable: `VITE_API_URL=https://one6bits.onrender.com`.
4. Deploy. The included `frontend/vercel.json` automatically handles SPA routing for React Router (`/` and `/docs`).

### Backend Deployment on Render
1. Create a new **Web Service** on **Render** (or use Blueprint with the included `render.yaml`).
2. Set Root Directory to `backend`.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Configure Environment Variables:
   - `GROQ_API_KEY`, `AI_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-120b` (`GROQ_MODEL` overrides the legacy `DEFAULT_MODEL`)
   - Optional: `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash` (set `AI_PROVIDER=gemini` to make Gemini primary). The same key turns on embedding-based runbook search (`gemini-embedding-001`, free tier); Groq stays the main LLM
   - Optional: `RUNBOOK_RERANK=off` (skip the LLM runbook pick), `RUNBOOK_EMBEDDINGS=off` (skip embeddings even with a Gemini key)
   - `DATABASE_URL` (recommended): Postgres connection string, e.g. from Neon. Tables and the demo account are created on first boot, and data survives restarts. Without it the backend uses SQLite on Render's ephemeral disk
   - `JWT_SECRET` (auto-generated by render.yaml; required)
   - Optional: `CORS_ORIGINS` (comma-separated browser origins allowed to call the API; defaults to `https://16bits-omniops.vercel.app` plus localhost:5173/4173)
   - Optional: `AI_MAX_TOKENS` (max output tokens per agent call; default 2048)
   - Recommended for production: `WEBHOOK_SECRET` (alert webhook then requires it via `x-webhook-secret`, `Authorization: Bearer`, or `?token=`; see the Docs page for Alertmanager, PagerDuty and Datadog setup)
   - Optional: `SLACK_WEBHOOK_URL` (Slack incoming-webhook URL for the **public demo team** only; every other team connects its own Slack in **Settings**). Every triaged incident is posted with priority, status, matched runbook, a summary and a **Review & approve** button that opens `/incidents/<id>` on the web console; approvals are posted too
   - Optional: `PUBLIC_API_URL` (base URL shown in team alert URLs; defaults to the request host, e.g. `https://one6bits.onrender.com`)
   - Optional: `SWARM_CONCURRENCY` (agent runs sent to the LLM at once, default 2; extra runs wait in a queue of up to `SWARM_MAX_QUEUE`, default 50) and `GROQ_MAX_RETRIES` (retries on Groq 429/5xx honoring `retry-after`, default 2)
   - Optional: `APP_URL` (web console URL used in Slack links; default `https://16bits-omniops.vercel.app`)
   - Optional: `LANGSMITH_API_KEY` (for distributed tracing)
   - Optional: `DEMO_ACCOUNT=off` disables the public demo login (`admin@16bits.io`): nothing is seeded, sign-in with that email is refused, and the web console hides the demo button. Default `on` so judges can sign in
   - Rate limiting is on by default (in-memory, per client IP): 10 failed sign-ins per email per 15 min, 20 sign-ups per hour, 60 agent runs (`/execute`, `/stream`) per 10 min, 120 alert webhooks per minute, 30 approvals per minute. Over the limit returns 429 with `Retry-After`. Tune with `RATE_LIMIT_LOGIN`, `RATE_LIMIT_REGISTER`, `RATE_LIMIT_EXECUTE`, `RATE_LIMIT_WEBHOOK`, `RATE_LIMIT_APPROVE`, or turn off with `RATE_LIMIT=off`

> **Storage:** With `DATABASE_URL` set, incidents, approvals and users are stored in Postgres and survive restarts. Without it, the backend falls back to SQLite, and Render's free tier wipes that file on every restart. Either way, an idempotent boot seeder (`seedDemoData` in `server.ts`) creates the demo operator account (`admin@16bits.io` / `admin123`) and a benchmark incident if the users table is empty.

---

## 7. Teams (Multi-Tenancy)

Every account belongs to one team. A team's incidents, uploaded runbooks, alert URLs and Slack posts are private to it; built-in runbooks are shared.

- **Create a team:** CREATE ACCOUNT with a team name (or leave it empty). You become the team **admin**.
- **Invite teammates:** Settings → INVITE TEAMMATES shows an invite code. Teammates paste it when creating an account (or in Settings → JOIN ANOTHER TEAM) and join as **operators**.
- **Connect your own Slack:** Settings → SLACK. Paste a Slack incoming-webhook URL from your workspace (api.slack.com/apps → Incoming Webhooks) and click SEND TEST MESSAGE. Only `https://hooks.slack.com/services/...` URLs are accepted.
- **Private alert URLs:** Settings → ALERT URLS lists your team's Alertmanager, PagerDuty, Datadog and generic URLs (`/api/webhooks/t/<secret-key>/<source>`). The key in the URL is the secret; ROTATE ALERT URLS issues a new one.
- **Your own AI quota:** Settings → AI QUOTA takes an optional Groq API key so your team's runs use your own free quota instead of the shared server key.
- **Public demo team:** the demo account, signed-out visitors, the legacy `/api/webhooks/<source>` URLs and the CLI without credentials all use the shared read-only demo team. With `DEMO_ACCOUNT=off` signed-out visitors see nothing.
- **CLI:** set `OMNIOPS_TOKEN` (or `OMNIOPS_EMAIL` + `OMNIOPS_PASSWORD`) and `omniops` runs land in your team.
- **Forgot password (no email needed):** a team admin clicks RESET CODE next to the member in Settings → MEMBERS and passes the one-time code on privately. The member uses SIGN IN → Forgot password? to set a new password. Codes are stored hashed, work once and expire after 30 minutes (`RESET_CODE_TTL_MINUTES`). If a team's only admin is locked out, the server owner runs `cd backend && DATABASE_URL=... npm run reset-code -- <email>`. Signed-in users can change their password in Settings → CHANGE PASSWORD. The public demo account cannot be reset or changed.
- Existing accounts created before teams existed were each moved into their own team; use an invite code to join a teammate's.

---

## 8. Demo Credentials for Evaluators

- **Email:** `admin@16bits.io`
- **Password:** `admin123`
- **Role:** Lead Operator (Admin)
- **Web console:** click **SIGN IN**, then **USE DEMO ACCOUNT** (or just click Authorize on a held incident and the sign-in opens).
- **API Authorization:** Used with `POST /api/auth/login` to obtain a JWT Bearer token for the protected endpoints below.
- This account is public and for evaluation only. In production, remove the seeded account.

---

## 9. API Reference

🔒 = requires `Authorization: Bearer <JWT>` from `POST /api/auth/login`.

- `GET /api/health` — Backend status, SQLite state, active AI provider (`groq`, `gemini`, or `mock`) and model.
- `POST /api/auth/login` — Authenticates an operator and returns a JWT.
- `POST /api/auth/reset-password` — `{email, code, newPassword}`: redeems a one-time reset code and returns a JWT. Wrong, used or expired codes all return 400.
- 🔒 `POST /api/auth/change-password` — `{currentPassword, newPassword}`.
- 🔒 `POST /api/org/members/:userId/reset-code` — Team admin only: issues a one-time reset code for a member of the same team.
- `POST /api/auth/register` — Creates an account. With `teamName` (or nothing) it creates a new team and you are its admin; with `inviteCode` you join that team as an operator.
- `GET /api/auth/me` 🔒 — Returns the signed-in operator and team.
- `GET /api/org` 🔒 — Team settings: name, members, invite code, alert URLs, Slack status.
- `PATCH /api/org` 🔒 admin — Update `name`, `slackWebhookUrl`, `groqApiKey` (empty string removes).
- `POST /api/org/slack/test` 🔒 admin — Sends a test message to the team's Slack.
- `POST /api/org/rotate-alert-key`, `POST /api/org/rotate-invite` 🔒 admin — Issue new alert URLs / invite code.
- `POST /api/org/join` 🔒 — Join another team with `{inviteCode}`; returns a new token.
- `POST /api/webhooks/t/<key>/{alertmanager,pagerduty,datadog,alert}` — Team alert intake (key from Settings).
- Incident, run and runbook endpoints below are scoped to the caller's team (no token = public demo team).
- `GET /api/incidents` — Lists incidents with resolution status.
- `GET /api/incidents/:id` — Incident detail plus the full 4-agent step log.
- `POST /api/incidents` 🔒 — Creates an incident without running the swarm.
- `POST /api/agents/execute` — Runs the swarm and returns the result.
- `POST /api/agents/stream` — Runs the swarm with Server-Sent Events (SSE) streaming.
- `POST /api/agents/approve` 🔒 — Human approval for an `AWAITING_APPROVAL` incident. Records the approver from the JWT and marks the incident `RESOLVED`. It does not execute any commands.
- `GET /api/agents/runbooks` — Lists the runbook library (SOPs) stored in the database.
- `GET /api/agents/runbooks/search?q=...` — Ranked runbook search with scores, the chosen runbook and the reason (`&rerank=false` skips the LLM pick).
- `POST /api/agents/runbooks` 🔒 — Uploads a Markdown runbook (stored in the database, 100 KB max).
- `DELETE /api/agents/runbooks/:filename` 🔒 — Deletes a team-uploaded runbook (built-in ones are protected).
- `POST /api/agents/webhook/alert` — Alert ingestion. Accepts Prometheus Alertmanager, PagerDuty V3 webhook and Datadog webhook payloads as-is (auto-detected; per-tool aliases `/api/webhooks/alertmanager`, `/api/webhooks/pagerduty`, `/api/webhooks/datadog`), or generic JSON `{title, description, priority}`. Resolved alerts are acknowledged without a run, and repeats of an alert with an open incident are deduplicated. Tool payloads return 202 immediately and triage runs in the background; generic JSON waits for the result (add `?async=1` to skip). When `WEBHOOK_SECRET` is set, send it as `x-webhook-secret`, `Authorization: Bearer`, or `?token=`.

---

## 10. Known Limitations

- Approval records the decision; OmniOps proposes commands but never runs them against your infrastructure.
- Teams have two roles (admin, operator). Team Slack webhooks and Groq keys are stored in the database as plain text; use a database you trust (e.g. Neon with restricted access).
- Rate limits and the run queue live in memory on one instance.
- Without a Gemini key, runbook search is keyword-based (BM25 + synonyms) plus the LLM pick; embeddings add true semantic matching.
- Without `DATABASE_URL`, SQLite on Render's free tier resets on restart, including uploaded runbooks.
- If every AI provider fails, the swarm returns a generic template answer.

---

## 11. License
MIT License. Open source and built for high-reliability enterprise operations.
