---
name: 16bits-ops
description: Autonomous site reliability and incident response swarm for production systems. Triggers on production crashes, connection pool exhaustion, webhook throttles, Redis OOM, or distributed system alerts.
---

# 16Bits OmniOps — Autonomous Incident Response Skill

Use this skill when you encounter production infrastructure anomalies, database crashes, memory exhaustion, third-party API rate limits, or SRE incident escalations.

`16Bits OmniOps` dispatches a specialized 4-agent consensus swarm:
1. **Planner Agent:** Decomposes the anomaly into an investigative Directed Acyclic Graph (DAG).
2. **Investigator Agent:** Queries host telemetry (`os.loadavg`, memory, process uptime) and matches vetted local Standard Operating Procedures (SOPs).
3. **Verifier Gate:** Enforces enterprise SLA safety windows, verifies compliance boundaries, and halts destructive commands behind a mandatory Human-in-the-Loop signature.
4. **Synthesizer Agent:** Generates an executive summary, numbered recovery playbook, customer notification draft, and LangSmith observability trace.

---

## When to Activate

Activate this skill when:
- Database connection pools are exhausted (e.g. `FATAL: remaining connection slots are reserved for non-replication superuser connections`).
- Payment or webhooks suffer 429 rate limit throttles (e.g. Stripe, Twilio).
- Caching layers (Redis, Memcached) trigger OOM eviction spikes or crash loops.
- You need a production-safe, audited recovery playbook with LangSmith trace validation in under 4 seconds.

---

## Invocation Patterns

### 1. Via Terminal CLI
If the local `16Bits OmniOps` engine is running:

```bash
# General triage
node /home/dhanush/Projects/Hackathons/16Bits/cli/16bits.js triage "<error log or incident summary>" [PRIORITY]

# Example
node /home/dhanush/Projects/Hackathons/16Bits/cli/16bits.js triage "Postgres connection pool exhausted on prod-db-01" CRITICAL

# Check status and loaded SOPs
node /home/dhanush/Projects/Hackathons/16Bits/cli/16bits.js status

# Authorize high-risk remediation
node /home/dhanush/Projects/Hackathons/16Bits/cli/16bits.js approve <incident-uuid>
```

### 2. Via REST Webhook
If interacting programmatically or across distributed microservices:

```bash
curl -X POST http://localhost:8000/api/agents/webhook/alert \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Stripe Webhook 429 Rate Limit Spike",
    "description": "540 dropped webhook deliveries in 60s from api.stripe.com. HTTP 429 Too Many Requests.",
    "priority": "HIGH",
    "service": "billing-gateway"
  }'
```

### 3. Response Structure
The engine returns:
- `incidentId`: UUID tracked in SQLite audit database.
- `status`: `AWAITING_APPROVAL` (for high-risk operations) or `RESOLVED`.
- `executionDurationMs`: Engine turnaround time (~3,200ms to 3,800ms).
- `langsmithTraceUrl`: Public or organization trace URL proving transparent step-by-step reasoning.
- `resolutionPreview`: Executive summary and immediate step-by-step commands.
