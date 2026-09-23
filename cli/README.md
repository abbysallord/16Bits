# omniops

[![npm version](https://img.shields.io/npm/v/omniops.svg)](https://www.npmjs.com/package/omniops)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Theme: Agentic AI](https://img.shields.io/badge/Theme-Agentic%20AI-blue.svg)](https://github.com/abbysallord/16Bits)

> **Terminal-native autonomous operations swarm for production systems.**  
> Diagnoses outages, pipes terminal errors, audits enterprise SLAs, and generates verified remediation runbooks with 100% LangSmith trace transparency and cryptographic operator authorization.

---

## Quick Start

### Global Install via npm
```bash
npm install -g omniops
```

### Or Run Directly via npx
```bash
npx omniops triage "Postgres connection pool exhausted on prod-db" CRITICAL
```

---

## Usage & Commands

### 1. Pipe Any Terminal Error or System Log Directly
Pipe standard error, docker logs, or build failures directly into the 4-agent swarm:

```bash
# Pipe any error log
cat /var/log/syslog | tail -n 25 | omniops

# Pipe docker or container logs
docker logs billing-service 2>&1 | omniops CRITICAL

# Pipe command failures
npm run build 2>&1 | omniops
```

### 2. Run Host Infrastructure Diagnostics (doctor)
Inspect host RAM, CPU load averages, and probe listening service ports (Express, Redis, Postgres):

```bash
omniops doctor
```

### 3. Triage Specific Incidents
```bash
omniops triage "Stripe webhook 429 rate limit spike on billing-api" HIGH
```

### 4. Human-in-the-Loop Operator Sign-Off
When high-risk infrastructure remediation is proposed, the Verifier Gate halts execution behind `AWAITING_APPROVAL`. Sign off directly from your terminal:

```bash
omniops approve <incidentId>
```

---

## 4-Agent Consensus Architecture

1. **Planner Agent:** Decomposes messy logs, strips noise, and builds an execution Directed Acyclic Graph (DAG).
2. **Investigator Agent:** Queries host vitals (RAM, CPU, uptime) and retrieves matching Standard Operating Procedure (SOP) runbooks.
3. **Verifier Gate:** Adversarial safety auditor. Flags `AWAITING_APPROVAL` for critical or destructive operations.
4. **Synthesizer Agent:** Generates an executive incident summary, step-by-step shell commands, stakeholder email draft, and post-mortem rule.

---

## Active Input & Output Guardrails

- **Input Guardrails:** Automatically redacts AWS secrets, Bearer tokens, and database credentials before model processing. Neutralizes prompt injections.
- **Output Guardrails:** Intercepts destructive commands (`rm -rf /`, `DROP DATABASE`, `FLUSHALL --force`) and enforces strict zero-emoji compliance.

---

## 100% LangSmith Observability
Every execution wraps in a LangSmith `RunTree` with child spans for each agent step. Live trace URLs are returned in terminal output.

---

## License
MIT (c) [16Bits Team](https://github.com/abbysallord/16Bits)
