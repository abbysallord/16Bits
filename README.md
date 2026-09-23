# 16Bits OmniOps
> **Autonomous Multi-Agent Enterprise SRE Swarm & Incident Orchestrator**

An autonomous, multi-agent operational intelligence platform built for the **Agentic AI & Intelligent Systems** challenge.

---

## 1. Executive Overview & Problem Statement
Modern enterprise infrastructure suffers from fragmented monitoring tools, opaque failure cascades, and chaotic 2 AM incident war rooms. When critical systems fail (database connection saturation, Redis eviction cascades, third-party webhook rate throttles), engineering teams waste 1 to 4 hours manually grepping logs, arguing over root causes, and guessing remediation steps. At an average enterprise downtime cost of $5,600/minute, every delayed incident costs tens of thousands of dollars.

**16Bits OmniOps** turns 3-hour production outages into 15-second deterministic playbooks. Engineers or automated monitors throw raw, unstructured error logs at OmniOps. A 4-agent consensus swarm investigates system vitals, references verified local runbooks, verifies compliance boundaries, and provides safe, executable fix commands.

---

## 2. The 4-Agent Consensus Swarm

Instead of a single brittle prompt, **16Bits OmniOps** deploys a specialized 4-agent consensus swarm:

1. **Planner Agent**: Parses messy logs, eliminates noise, and constructs an investigative Directed Acyclic Graph (DAG).
2. **Investigator Agent**: Queries live host telemetry (`os.loadavg`, memory, process uptime) and matches vetted local Standard Operating Procedures (SOPs).
3. **Verifier Gate (Safety & SLA)**: Enforces contractual SLA deadlines, audits proposed commands for destructive operations (`DROP TABLE`, `rm -rf`, `FLUSHALL`), and halts high-risk actions behind a mandatory cryptographic Human-in-the-Loop signature.
4. **Synthesizer & Dispatcher Agent**: Compiles the executive summary, numbered remediation playbook, client-ready stakeholder notifications, and public LangSmith execution traces.

---

## 3. Active Input & Output Guardrails

OmniOps incorporates enterprise-grade safety guardrails at both input ingestion and output emission:

- **Input Guardrails**:
  - **Secret & PII Redaction**: Automatically scrubs AWS secret keys (`AKIA...`), Bearer tokens, private SSH keys, and database connection URIs from incoming error logs before LLM processing.
  - **Prompt Injection Defense**: Detects and neutralizes meta-instruction injection attempts (`Ignore previous instructions`, `System Override`, `DAN Mode`) by treating them strictly as passive log data.
- **Output Guardrails**:
  - **Destructive Command Interception**: Scans synthesized remediation commands for dangerous patterns (`rm -rf /`, `DROP DATABASE`, `mkfs`, `dd if=`, `FLUSHALL --force`). Flags destructive commands and quarantines execution behind Level-3 Human Operator authorization.
  - **Zero-Emoji Enforcement**: Strips accidental unicode emoji characters from all machine outputs to preserve clean, professional terminal and enterprise compliance.

---

## 4. Tech Stack & Architecture

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, React Router v7, Nes.css, Tailwind CSS | Modular multi-page application (`/`, `/console`, `/incident/:id`, `/login`, `/docs`) |
| **Backend** | Node.js, Express.js, TypeScript/ESM | Production REST and Server-Sent Events (SSE) streaming engine |
| **Authentication** | JWT (JSON Web Tokens), bcryptjs | Dynamic secret resolution and cryptographic operator sign-off |
| **Database** | SQLite (`better-sqlite3`), WAL journal mode | Relational audit tables for incidents, agent logs, and operator approvals |
| **Artificial Intelligence** | Google Gemini 2.5 Flash + Groq LPU | Primary path: `gemini-2.5-flash`; fallback: Groq LPU sub-second inference |
| **Observability** | LangSmith (`RunTree`) | 100% transparent distributed tracing of every agent thought and tool call |
| **CLI Tool** | Node.js global binary (`omniops`) | Interactive terminal tool with ANSI markdown tables and piping support |

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

---

## 6. Production Cloud Deployment

### Frontend Deployment on Vercel
1. Connect this repository to **Vercel**.
2. Set the Root Directory to `frontend`.
3. Set the Environment Variable: `VITE_API_URL=https://your-backend-service.onrender.com`.
4. Deploy. The included `frontend/vercel.json` automatically handles SPA routing for React Router (`/`, `/console`, `/incident/:id`, `/login`, `/docs`).

### Backend Deployment on Render
1. Create a new **Web Service** on **Render** (or use Blueprint with the included `render.yaml`).
2. Set Root Directory to `backend`.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Configure Environment Variables:
   - `GROQ_API_KEY`, `AI_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-120b`
   - Optional: `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash` (set `AI_PROVIDER=gemini` to make Gemini primary)
   - `JWT_SECRET` (auto-generated by render.yaml; required)
   - Optional: `WEBHOOK_SECRET` (alert webhook then requires the `x-webhook-secret` header)
   - `LANGSMITH_API_KEY` (optional, for observability)

> **Note on Render SQLite Storage:** Render's free tier uses an ephemeral filesystem that resets when the service spins down. 16Bits OmniOps includes an automatic idempotent boot seeder (`seedDemoData` in `server.ts`) that immediately provisions the admin operator account (`admin@16bits.io` / `admin123`) and benchmark incidents on boot, ensuring 100% testability across restarts.

---

## 7. Demo Credentials for Evaluators

- **Email:** `admin@16bits.io`
- **Password:** `admin123`
- **Role:** Lead Operator (Admin)
- **1-Click Login:** Available directly on the `/login` page via the pre-filled authentication card.

---

## 8. API Reference

- `GET /api/health` — Returns backend status, SQLite state, active AI provider (`gemini`, `groq`, or `mock`), and model version.
- `POST /api/auth/login` — Authenticates operator and returns JWT bearer token.
- `GET /api/incidents` — Lists all audited incidents with resolution status.
- `GET /api/incidents/:id` — Returns deep-dive incident telemetry and complete 4-agent log trajectory.
- `POST /api/agents/stream` — Real-time Server-Sent Events (SSE) streaming execution.
- `POST /api/agents/approve` — Human-in-the-Loop approval route; captures operator signature and marks incident `RESOLVED`.
- `POST /api/agents/webhook/alert` — Ingestion webhook for Datadog, PagerDuty, Grafana, or curl scripts.

---

## 9. License
MIT License. Open source and built for high-reliability enterprise operations.
