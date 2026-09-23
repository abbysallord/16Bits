# ⚡ 16bits-ops

[![npm version](https://img.shields.io/npm/v/16bits-ops.svg)](https://www.npmjs.com/package/16bits-ops)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Theme: Agentic AI](https://img.shields.io/badge/Theme-Agentic%20AI-blue.svg)](https://github.com/abbysallord/16Bits)

> **Terminal-native autonomous operations swarm for production systems.**  
> Diagnoses outages, pipes terminal errors, audits enterprise SLAs, and generates verified remediation runbooks in **3.4 seconds** with **100% LangSmith trace transparency**.

---

## 🚀 Quick Start

### Global Install via npm
```bash
npm install -g 16bits-ops
```

### Or Run Directly via npx
```bash
npx 16bits-ops triage "Postgres connection pool exhausted on prod-db" CRITICAL
```

---

## 🛠️ Usage & Commands

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

### 2. Run Host Infrastructure Diagnostics (`doctor`)
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

## 🧠 4-Agent Consensus Architecture

1. **Planner Agent:** Decomposes the incident into an execution Directed Acyclic Graph (DAG).
2. **Investigator Agent:** Queries host vitals (RAM, CPU, uptime) and retrieves matching Standard Operating Procedure (SOP) runbooks.
3. **Verifier Gate:** Adversarial safety auditor. Flags `AWAITING_APPROVAL` for critical or destructive operations.
4. **Synthesizer Agent:** Generates an executive incident summary, step-by-step shell commands, stakeholder email draft, and post-mortem rule.

---

## 🔍 100% LangSmith Observability
Every execution wraps in a LangSmith `RunTree` with child spans for each agent step. Live trace URLs are returned in terminal output with millisecond precision.

---

## 📄 License
MIT © [16Bits Team](https://github.com/abbysallord/16Bits)
