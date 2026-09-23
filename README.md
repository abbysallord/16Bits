# 16Bits OmniOps

> **Demo video:** https://drive.google.com/file/d/1YrrpZVhPUlbGxSZ52DJiqdWVT8qsTRUs/view?usp=sharing · **Pitch deck:** https://docs.google.com/presentation/d/1hp44SY3RhTOZj7TZnNCSDCoC4isZw0DT/edit?usp=sharing

OmniOps is an AI on-call assistant for production incidents. An alert comes in, a team of 4 AI agents investigates it and writes a fix plan, and risky plans wait for a human to approve them in the app or from Slack.

**Hackathon theme:** Agentic AI & Intelligent Systems

| What | Link |
|---|---|
| Web app | https://16bits-omniops.vercel.app |
| Backend health check | https://one6bits.onrender.com/api/health |
| CLI on npm | https://www.npmjs.com/package/omniops (`npx omniops`) |
| In-app docs | https://16bits-omniops.vercel.app/docs |

**Demo login:** `admin@16bits.io` / `admin123` (or click **USE DEMO ACCOUNT** in the sign-in dialog)

> The backend runs on Render's free tier. If the first request takes about 30 seconds, it is waking up. Open the health link once first.

---

## Try it in 2 minutes

### 1. Sign in
Open the web app, click **SIGN IN**, then **USE DEMO ACCOUNT**. You can also click **CREATE ACCOUNT** to get your own private team.

### 2. Run the agents on an incident
On the console, type or pick an incident (for example "Checkout API 5xx spike after deploy") and run it. You will watch 4 agents work live:
1. **Planner** breaks the incident into steps.
2. **Investigator** reads live server stats and finds the matching runbook (standard fix procedure).
3. **Verifier** is the safety gate. It returns a structured verdict (risk, needs approval, reasons).
4. **Synthesizer** writes the summary, the numbered fix steps and a customer update.

### 3. Or fire a real alert, the way a monitoring tool would
```bash
curl -X POST "https://one6bits.onrender.com/api/agents/webhook/alert" \
  -H "Content-Type: application/json" \
  -d '{"title":"Checkout API 5xx spike","description":"Error rate on checkout-service jumped to 38% after the last deploy. p99 latency 4.2s.","priority":"high"}'
```
The incident appears in the queue and the agents triage it. Prometheus Alertmanager, PagerDuty and Datadog payloads are also accepted as-is.

### 4. Approve
HIGH/CRITICAL incidents, and any plan with a dangerous command (`rm -rf`, `DROP TABLE`, ...), stop at **AWAITING_APPROVAL**. Open the incident and click **Approve**. The approver's name goes into the audit trail. OmniOps never runs commands on your servers; it proposes, a human decides.

### 5. Teams and Slack (Settings)
Create your own account, then open **account menu → Settings**:
- **Slack:** paste a Slack incoming-webhook URL and click **SEND TEST MESSAGE**. Every triaged incident is then posted to your channel with a *Review & approve* button.
- **Alert URLs:** private Alertmanager / PagerDuty / Datadog / curl URLs for your team only.
- **Invite teammates** with the invite code. Teams never see each other's incidents.
- **Reset code:** admins can give a teammate a one-time code if they forget their password (**Forgot password?** on sign-in).

### 6. CLI
```bash
npx omniops triage "PostgreSQL FATAL: remaining connection slots are reserved" HIGH
tail -n 30 /var/log/syslog | npx omniops CRITICAL
npx omniops doctor              # backend health + loaded runbooks
npx omniops approve <incidentId>
```

---

## Features

- **4-agent swarm** with live streaming of every step (Server-Sent Events).
- **Human approval gate:** severity and dangerous-command rules are plain code, not AI, and the AI verdict can only add a hold, never remove one.
- **Alert intake** from Prometheus Alertmanager, PagerDuty and Datadog, with duplicate and "resolved" handling.
- **Runbook search:** keyword ranking plus an AI pick of the best match (or "none applies"). Upload your own runbooks.
- **Teams:** private incidents, runbooks, alert URLs and Slack per team; invite codes; admin and operator roles.
- **Slack:** incident cards with a review link, plus approval notices.
- **Accounts:** sign up, sign in, forgot password (admin reset codes), change password; a password change signs out other sessions.
- **Guardrails:** secrets (AWS keys, tokens, DB URLs) are removed from logs before the AI sees them, and prompt-injection text is treated as plain data.
- **Audit trail** of every agent step and every approval.
- **CLI** on npm (`omniops`).

## AI security

- **Backend-only AI calls.** Every Groq/Gemini call is made by the backend (`backend/src/services/aiService.ts`). The browser and the CLI never see an AI key.
- **Secrets protection.** AI keys, `JWT_SECRET` and `WEBHOOK_SECRET` live only in server environment variables. Team Groq keys and Slack URLs are write-only in the API (shown masked). Passwords are bcrypt-hashed; reset codes are stored hashed and expire in 30 minutes.
- **JSON mode.** The decisions (Verifier verdict, runbook pick) use Groq Structured Outputs: strict `json_schema` on supported models, JSON Object Mode otherwise, and every reply is checked with zod (`backend/src/schemas/aiSchemas.ts`). If the AI returns bad JSON, the incident is held for a human (fails closed).
- **Rate limits** on sign-in, sign-up, runs, webhooks and approvals, plus a run queue so bursts wait instead of failing.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite, Tailwind, NES.css pixel style, deployed on Vercel |
| Backend | Node.js + Express + TypeScript, deployed on Render |
| Database | PostgreSQL (Neon) in production, SQLite locally |
| AI | Groq (`openai/gpt-oss-120b` default), optional Gemini fallback, LangSmith tracing (optional) |
| Auth | JWT + bcrypt |
| Validation | zod |

## Run it locally

```bash
# Backend (port 8000)
cd backend
npm install
cp .env.example .env      # set JWT_SECRET; add GROQ_API_KEY for real AI (no key = mock mode)
npm run dev

# Frontend (port 5173), in a second terminal
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. Without `DATABASE_URL` the backend uses a local SQLite file.

End-to-end tests (backend running on port 8000):
```bash
cd backend && npm run test:e2e
```

Deploy: frontend on Vercel (root `frontend`, `VITE_API_URL` = backend URL). Backend on Render (root `backend`, build `npm install && npm run build`, start `npm start`, env `JWT_SECRET`, `GROQ_API_KEY`, `DATABASE_URL`).

## Known limitations

- Approval records the decision; OmniOps proposes commands but never runs them against your infrastructure.
- Teams have two roles (admin, operator). Team Slack webhooks and Groq keys are stored in the database as plain text; use a database you trust (e.g. Neon with restricted access).
- Rate limits and the run queue live in memory on one instance.
- Without a Gemini key, runbook search is keyword-based (BM25 + synonyms) plus the LLM pick; embeddings add true semantic matching.
- Without `DATABASE_URL`, SQLite on Render's free tier resets on restart, including uploaded runbooks.
- If every AI provider fails, the swarm returns a generic template answer.

<details>
<summary><b>API reference</b> (click to expand)</summary>

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

</details>

## License
MIT
