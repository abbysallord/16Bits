# 16Bits OmniOps
> **Autonomous Multi-Agent Enterprise SRE Swarm & Incident Orchestrator**

[![npm version](https://img.shields.io/npm/v/omniops.svg)](https://www.npmjs.com/package/omniops)
[![Backend Status](https://img.shields.io/badge/Backend-Live%20on%20Render-success)](https://one6bits.onrender.com/api/health)
[![Theme](https://img.shields.io/badge/Hackathon%20Theme-Agentic%20AI%20%26%20Intelligent%20Systems-blue)]()

- **Live Web Console**: [https://16bits-omniops.vercel.app](https://16bits-omniops.vercel.app)
- **Live Backend API**: [https://one6bits.onrender.com](https://one6bits.onrender.com)
- **Global npm Package**: [`omniops@1.0.2`](https://www.npmjs.com/package/omniops) (`npm i -g omniops` or `npx omniops`)
- **Interactive Documentation**: [https://16bits-omniops.vercel.app/docs](https://16bits-omniops.vercel.app/docs)
- **Demo Video Walkthrough**: TODO - add the real video link before submission
- **Challenge Theme**: Agentic AI & Intelligent Systems

---

## 1. Executive Overview & Problem Statement
Modern enterprise infrastructure suffers from fragmented monitoring tools, opaque failure cascades, and chaotic 2 AM incident war rooms. When critical systems fail (database connection saturation, Redis eviction cascades, third-party webhook rate throttles), engineering teams waste 1 to 4 hours manually grepping logs, arguing over root causes, and guessing remediation steps. At an average enterprise downtime cost of $5,600/minute, every delayed incident costs tens of thousands of dollars.

**16Bits OmniOps** turns raw error logs into a reviewed remediation playbook in seconds. Engineers or automated monitors send unstructured error logs to OmniOps. A 4-agent swarm checks host vitals, matches the incident against the team's local runbooks, checks the plan against safety rules, and proposes fix commands. OmniOps does not run commands itself: high-risk plans wait for a signed-in operator to approve them.

---

## 2. The 4-Agent Consensus Swarm

Instead of a single brittle prompt, **16Bits OmniOps** deploys a specialized 4-agent consensus swarm:

1. **Planner Agent**: Parses messy logs, eliminates noise, and constructs an investigative Directed Acyclic Graph (DAG).
2. **Investigator Agent**: Reads live host telemetry (`os.loadavg`, memory, process uptime), inspects codebase files via the AST call graph, and picks the best-matching local runbook (SOP) using keyword scoring.
3. **Verifier Gate (Safety & SLA)**: Reviews the plan against SLA and safety constraints. The approval gate itself is deterministic code, not the LLM: any HIGH/CRITICAL incident, or any plan containing a destructive command pattern (`DROP TABLE`, `rm -rf`, `FLUSHALL`), is held as `AWAITING_APPROVAL` until a signed-in operator approves it. The Verifier LLM's verdict is advisory.
4. **Synthesizer & Dispatcher Agent**: Writes the executive summary, numbered remediation playbook and stakeholder update, posts to Slack when `SLACK_WEBHOOK_URL` is set, and links the LangSmith trace when `LANGSMITH_API_KEY` is set.

---

## 3. Active Input & Output Guardrails

OmniOps applies guardrails on the way in and on the way out:

- **Input Guardrails**:
  - **Secret & PII Redaction**: Automatically scrubs AWS secret keys (`AKIA...`), Bearer tokens, private SSH keys, and database connection URIs from incoming error logs before LLM processing.
  - **Prompt Injection Defense**: Detects and neutralizes meta-instruction injection attempts (`Ignore previous instructions`, `System Override`, `DAN Mode`) by treating them strictly as passive log data.
- **Output Guardrails**:
  - **Destructive Command Interception**: Scans synthesized remediation commands for dangerous patterns (`rm -rf /`, `DROP DATABASE`, `mkfs`, `dd if=`, `FLUSHALL --force`). Flags destructive commands and forces the plan into the human approval queue.
  - **Zero-Emoji Enforcement**: Strips accidental unicode emoji characters from all machine outputs to preserve clean, professional terminal and enterprise compliance.

---

## 4. Tech Stack & Architecture

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, React Router v7, Nes.css, Tailwind CSS | Interactive retro operations console (`/` and `/docs`) with live SSE streaming |
| **Backend** | Node.js, Express.js, TypeScript/ESM | Production REST and Server-Sent Events (SSE) streaming engine |
| **Authentication** | JWT (JSON Web Tokens), bcryptjs | Operator login. Approvals, runbook uploads and incident creation require a JWT, and the approver's identity is taken from the token into the audit trail |
| **Database** | SQLite (`better-sqlite3`), WAL journal mode | Tables for users, incidents (including who approved them) and per-agent step logs |
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

# 5. Approve a held incident (v1.0.3+). Signs in as the demo operator unless you set
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
   - Optional: `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash` (set `AI_PROVIDER=gemini` to make Gemini primary)
   - `JWT_SECRET` (auto-generated by render.yaml; required)
   - Optional: `CORS_ORIGINS` (comma-separated browser origins allowed to call the API; defaults to `https://16bits-omniops.vercel.app` plus localhost:5173/4173)
   - Optional: `AI_MAX_TOKENS` (max output tokens per agent call; default 2048)
   - Optional: `WEBHOOK_SECRET` (alert webhook then requires the `x-webhook-secret` header)
   - Optional: `SLACK_WEBHOOK_URL` (Slack incoming-webhook URL; after every swarm run OmniOps posts the incident title, priority, status, ID and a resolution preview)
   - Optional: `LANGSMITH_API_KEY` (for distributed tracing)

> **Note on Render SQLite Storage:** Render's free tier uses an ephemeral filesystem that resets when the service spins down. 16Bits OmniOps includes an automatic idempotent boot seeder (`seedDemoData` in `server.ts`) that immediately provisions the demo operator account (`admin@16bits.io` / `admin123`) and a benchmark incident on boot, so the demo works after every restart. Incident history does not survive a restart.

---

## 7. Demo Credentials for Evaluators

- **Email:** `admin@16bits.io`
- **Password:** `admin123`
- **Role:** Lead Operator (Admin)
- **Web console:** click **SIGN IN**, then **USE DEMO ACCOUNT** (or just click Authorize on a held incident and the sign-in opens).
- **API Authorization:** Used with `POST /api/auth/login` to obtain a JWT Bearer token for the protected endpoints below.
- This account is public and for evaluation only. In production, remove the seeded account.

---

## 8. API Reference

🔒 = requires `Authorization: Bearer <JWT>` from `POST /api/auth/login`.

- `GET /api/health` — Backend status, SQLite state, active AI provider (`groq`, `gemini`, or `mock`) and model.
- `POST /api/auth/login` — Authenticates an operator and returns a JWT.
- `POST /api/auth/register` — Creates an operator account (role is always `operator`).
- `GET /api/auth/me` 🔒 — Returns the signed-in operator.
- `GET /api/incidents` — Lists incidents with resolution status.
- `GET /api/incidents/:id` — Incident detail plus the full 4-agent step log.
- `POST /api/incidents` 🔒 — Creates an incident without running the swarm.
- `POST /api/agents/execute` — Runs the swarm and returns the result.
- `POST /api/agents/stream` — Runs the swarm with Server-Sent Events (SSE) streaming.
- `POST /api/agents/approve` 🔒 — Human approval for an `AWAITING_APPROVAL` incident. Records the approver from the JWT and marks the incident `RESOLVED`. It does not execute any commands.
- `GET /api/agents/runbooks` — Lists loaded runbooks (SOPs).
- `POST /api/agents/runbooks` 🔒 — Uploads a Markdown runbook.
- `POST /api/agents/webhook/alert` — Alert ingestion webhook (alias: `POST /api/webhooks/alerts`) for Datadog, PagerDuty, Grafana, or curl. Requires the `x-webhook-secret` header when `WEBHOOK_SECRET` is set.

---

## 9. Known Limitations

- Approval records the decision; OmniOps proposes commands but never runs them against your infrastructure.
- Runbook matching is keyword scoring (title match weighted over body match), with the first runbook as a fallback.
- SQLite on Render's free tier resets on restart; the demo data is re-seeded on boot.
- If every AI provider fails, the swarm returns a generic template answer.

---

## 10. License
MIT License. Open source and built for high-reliability enterprise operations.
