import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const SKILL_MD_RAW = `---
name: 16bits-ops
description: Autonomous site reliability and incident response swarm for production systems. Triggers on production crashes, connection pool exhaustion, webhook throttles, Redis OOM, or distributed system alerts.
---

# 16Bits OmniOps — Autonomous Incident Response Skill

Use this skill when you encounter production infrastructure anomalies, database crashes, memory exhaustion, third-party API rate limits, or SRE incident escalations.

16Bits OmniOps dispatches a specialized 4-agent consensus swarm:
1. Planner Agent: Decomposes the anomaly into an investigative Directed Acyclic Graph (DAG).
2. Investigator Agent: Queries host telemetry (os.loadavg, memory, process uptime) and matches vetted local Standard Operating Procedures (SOPs).
3. Verifier Gate: Enforces enterprise SLA safety windows, verifies compliance boundaries, and halts destructive commands behind a mandatory Human-in-the-Loop signature.
4. Synthesizer Agent: Generates an executive summary, numbered recovery playbook, customer notification draft, and LangSmith observability trace.

---

## When to Activate

Activate this skill when:
- Database connection pools are exhausted (e.g. FATAL: remaining connection slots are reserved).
- Payment or webhooks suffer 429 rate limit throttles (e.g. Stripe, Twilio).
- Caching layers (Redis, Memcached) trigger OOM eviction spikes or crash loops.
- You need a production-safe, audited recovery playbook with LangSmith trace validation.

---

## Invocation Patterns

### 1. Via Terminal CLI
omniops triage "<error log or incident summary>" [PRIORITY]
cat /var/log/syslog | tail -n 25 | omniops CRITICAL
omniops doctor
omniops status
omniops approve <incident-uuid>

### 2. Via REST Webhook
curl -X POST http://localhost:8000/api/agents/webhook/alert \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Stripe Webhook 429 Rate Limit Spike",
    "description": "540 dropped webhook deliveries in 60s from api.stripe.com. HTTP 429 Too Many Requests.",
    "priority": "HIGH",
    "service": "billing-gateway"
  }'

### 3. Response Structure
- incidentId: UUID tracked in SQLite audit database.
- status: AWAITING_APPROVAL (for high-risk operations) or RESOLVED.
- executionDurationMs: Engine turnaround time in milliseconds.
- langsmithTraceUrl: Public or organization trace URL proving transparent step-by-step reasoning.
- resolutionPreview: Executive summary and immediate step-by-step commands.
`

export const DocsPage: React.FC = () => {
  const [copiedSkill, setCopiedSkill] = useState(false)
  const [copiedCli, setCopiedCli] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  const webhookCurlExample = `curl -X POST http://localhost:8000/api/agents/webhook/alert \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Stripe Webhook 429 Rate Limit Spike",
    "description": "540 dropped webhook deliveries in 60s. HTTP 429 Too Many Requests.",
    "priority": "HIGH",
    "service": "billing-gateway"
  }'`

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 flex flex-col gap-10">
      {/* Page Header */}
      <div className="border-b-4 border-black pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-mono text-xs font-bold text-[#3b82f6] uppercase tracking-wider">
            [DOCUMENTATION &amp; AGENTIC INTERFACE]
          </span>
          <h1 className="font-press-start text-lg sm:text-2xl text-black mt-1">
            INTEGRATE OMNIOPS INTO YOUR AGENTS
          </h1>
          <p className="font-mono text-xs sm:text-sm text-neutral-600 mt-1">
            Provide this skill to Claude Code, Antigravity, Cursor, or your internal orchestrator for autonomous SRE response.
          </p>
        </div>

        <button
          type="button"
          onClick={() => copyToClipboard(SKILL_MD_RAW, setCopiedSkill)}
          className="px-5 py-3 font-mono text-xs font-bold bg-[#3b82f6] text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:bg-blue-600 active:translate-y-1 active:shadow-none transition-all whitespace-nowrap self-start sm:self-auto"
        >
          {copiedSkill ? '[SKILL.MD COPIED TO CLIPBOARD!]' : '[COPY SKILL.MD FOR CLAUDE CODE]'}
        </button>
      </div>

      {/* Claude Code Skill Section */}
      <section className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000] flex flex-col gap-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-press-start text-xs text-black">SKILL.MD SPECIFICATION</span>
            <span className="font-mono text-[10px] bg-neutral-100 border border-black px-2 py-0.5 font-bold">
              YAML FRONTMATTER READY
            </span>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(SKILL_MD_RAW, setCopiedSkill)}
            className="px-3 py-1 font-mono text-xs font-bold border-2 border-black bg-neutral-100 hover:bg-neutral-200"
          >
            {copiedSkill ? '[COPIED!]' : '[COPY ALL]'}
          </button>
        </div>

        <p className="font-mono text-xs text-neutral-700">
          Save this file as <code>~/.agents/skills/16bits-ops/SKILL.md</code>. When Claude Code or Antigravity
          detects an incident alert or database crash, it triggers OmniOps automatically.
        </p>

        {/* Clean Light-Themed Monospace Box (NO pitch black) */}
        <pre className="bg-[#f8fafc] border-2 border-black p-4 font-mono text-xs text-neutral-900 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
          {SKILL_MD_RAW}
        </pre>
      </section>

      {/* Terminal CLI Quickstart */}
      <section className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000] flex flex-col gap-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <span className="font-press-start text-xs text-black">CLI INVOCATION</span>
          <button
            type="button"
            onClick={() => copyToClipboard('npm install -g omniops', setCopiedCli)}
            className="px-3 py-1 font-mono text-xs font-bold border-2 border-black bg-neutral-100 hover:bg-neutral-200"
          >
            {copiedCli ? '[COPIED!]' : '[COPY COMMAND]'}
          </button>
        </div>

        <p className="font-mono text-xs text-neutral-700">
          Install globally and pipe real production errors directly to the swarm:
        </p>

        <div className="bg-[#f8fafc] border-2 border-black p-4 font-mono text-xs text-neutral-900 flex flex-col gap-2">
          <div><span className="text-neutral-500"># 1. Install globally</span></div>
          <div className="font-bold">npm install -g omniops</div>
          <div className="mt-2"><span className="text-neutral-500"># 2. Pipe syslog errors directly to swarm</span></div>
          <div className="font-bold">tail -n 25 /var/log/syslog | omniops CRITICAL</div>
          <div className="mt-2"><span className="text-neutral-500"># 3. Check system vitals and runbooks</span></div>
          <div className="font-bold">omniops doctor</div>
        </div>
      </section>

      {/* REST Webhook Quickstart */}
      <section className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000] flex flex-col gap-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <span className="font-press-start text-xs text-black">REST INGESTION WEBHOOK</span>
          <button
            type="button"
            onClick={() => copyToClipboard(webhookCurlExample, setCopiedWebhook)}
            className="px-3 py-1 font-mono text-xs font-bold border-2 border-black bg-neutral-100 hover:bg-neutral-200"
          >
            {copiedWebhook ? '[COPIED!]' : '[COPY CURL]'}
          </button>
        </div>

        <p className="font-mono text-xs text-neutral-700">
          Point Datadog, PagerDuty, Grafana Alertmanager, or Slack to OmniOps:
        </p>

        <pre className="bg-[#f8fafc] border-2 border-black p-4 font-mono text-xs text-neutral-900 overflow-x-auto leading-relaxed">
          {webhookCurlExample}
        </pre>
      </section>

      {/* Back to Home / Console CTA */}
      <div className="flex items-center justify-between border-t-2 border-black pt-4 font-mono text-xs">
        <Link to="/" className="text-black font-bold hover:underline">
          &larr; Back to Home
        </Link>
        <Link
          to="/console"
          className="px-4 py-2 font-bold bg-[#3b82f6] text-white border-2 border-black shadow-[2px_2px_0_0_#000]"
        >
          [LAUNCH CONSOLE &rarr;]
        </Link>
      </div>
    </div>
  )
}
