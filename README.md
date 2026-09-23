# 16Bits OmniOps ⚡
> **Autonomous Multi-Agent Enterprise Workflow & Incident Orchestrator**

An autonomous, multi-agent operational intelligence platform built for the **Agentic AI & Intelligent Systems** challenge.

---

## 1. Problem Statement
Modern enterprises lose thousands of hours and suffer costly SLA breaches due to fragmented tools, disconnected databases, and manual human triage. When critical incidents or cross-department workflows occur, human operators must manually pull logs from different monitoring platforms, verify compliance with complex contractual SLAs, and coordinate action items across multiple teams.

## 2. Solution: The 4-Agent Autonomous Consensus Swarm
Instead of a single brittle prompt, **16Bits OmniOps** deploys a specialized 4-agent swarm:
1. **Planner Agent**: Decomposes messy operational requests into an execution DAG and investigation requirements.
2. **Investigator Agent**: Gathers telemetry data, customer tier profiles, and SLA targets via tool calling.
3. **Verification Agent (Guardrail Gate)**: Inspects the investigation findings against enterprise security and SLA constraints before actions are executed (preventing hallucinations and unauthorized operations).
4. **Synthesizer & Dispatcher Agent**: Produces the final executive incident summary, numbered remediation playbook, automated stakeholder communication drafts, and post-mortem preventive measures.

---

## 3. Tech Stack Compliance

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Lucide Icons, Server-Sent Events (SSE) |
| **Backend** | Node.js, Express.js, TypeScript/ESM |
| **Authentication & Security** | JWT (JSON Web Tokens), bcryptjs password hashing, Zod runtime validation |
| **Database** | SQLite (`better-sqlite3`), WAL journal mode, relational audit tables |
| **Artificial Intelligence** | Google Gemini API (`@google/generative-ai`) + Groq LPU high-speed inference |
| **Presentation Deck** | Slidev developer pitch deck (`presentation/slides.md`) |

---

## 4. Quickstart Guide

### Backend Setup (Express.js + SQLite)
```bash
cd backend
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add GEMINI_API_KEY or GROQ_API_KEY in .env

# 3. Start development server (Port 8000)
npm run dev
```
Backend will be live at `http://localhost:8000`.

### Frontend Setup (Vite + React)
```bash
cd frontend
# 1. Install dependencies
npm install

# 2. Start development server (Port 5173)
npm run dev
```
Frontend will be live at `http://localhost:5173`.

### Pitch Deck Setup (Slidev)
```bash
cd presentation
npm install
npm run dev
```
Slides will be live at `http://localhost:3030`.

---

## 5. API Endpoints

- `GET /api/health` — System status, SQLite connectivity, and AI provider health.
- `POST /api/auth/register` — Register a new operator (Zod validated, bcrypt hashed).
- `POST /api/auth/login` — Login and receive signed JWT token.
- `GET /api/incidents` — List all enterprise incidents and resolution statuses.
- `GET /api/incidents/:id` — Get specific incident with full 4-agent audit trail.
- `POST /api/agents/execute` — Synchronous 4-agent swarm run.
- `POST /api/agents/stream` — Real-time Server-Sent Events (SSE) streaming swarm execution.
