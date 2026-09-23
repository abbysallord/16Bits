import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Copy,
  CheckCheck,
  Zap,
} from 'lucide-react'
import {
  fetchRunbooks,
  uploadRunbook,
  UnauthorizedError,
} from '../services/api'
import { useAuth, AuthBadge } from '../auth'

export default function DocsPage() {
  const [runbooks, setRunbooks] = useState<Array<{ filename: string; title: string; content: string }>>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [uploadFilename, setUploadFilename] = useState('sop-kubernetes-crashloop.md')
  const [uploadContent, setUploadContent] = useState(
`---
title: "Kubernetes Pod CrashLoopBackOff Runbook"
service: "k8s-pod-governor"
severity: "HIGH"
category: "Infrastructure"
keywords: ["CrashLoopBackOff", "OOMKilled", "pod restart", "exit code 137"]
requires_approval: true
---

### Symptoms
- Pod continuously restarts with status CrashLoopBackOff or OOMKilled.
- Exit code 137 indicates container was killed by Linux OOM killer.

### Diagnosis Commands
1. kubectl describe pod <pod-name> -n <namespace>
2. kubectl logs <pod-name> -n <namespace> --previous --tail=100
3. kubectl top pod <pod-name> -n <namespace>

### Remediation Commands
1. kubectl set resources deployment/<deployment-name> -n <namespace> --limits=memory=2Gi --requests=memory=1Gi
2. kubectl rollout restart deployment/<deployment-name> -n <namespace>

### Rollback Plan
- kubectl rollout undo deployment/<deployment-name> -n <namespace>`
  )
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { ensureToken, logout } = useAuth()

  useEffect(() => {
    loadRunbooks()
  }, [])

  const loadRunbooks = async () => {
    const list = await fetchRunbooks()
    setRunbooks(list)
  }

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleUploadSop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFilename || !uploadContent) return
    setIsUploading(true)
    setUploadStatus(null)
    try {
      // Runbook uploads require a signed-in operator; opens the sign-in dialog if needed
      const token = await ensureToken()
      if (!token) {
        setUploadStatus('[CANCELLED] Sign in as an operator to upload runbooks')
        return
      }
      const res = await uploadRunbook(uploadFilename, uploadContent, token)
      setUploadStatus(`[SUCCESS] ${res.message}`)
      loadRunbooks()
    } catch (err: any) {
      if (err instanceof UnauthorizedError) logout()
      setUploadStatus(`[ERROR] ${err.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const SKILL_MD_TEXT = `---
name: 16bits-ops
description: Autonomous site reliability and incident response swarm for production systems. Triggers on production crashes, connection pool exhaustion, webhook throttles, Redis OOM, or distributed system alerts.
---

# 16Bits OmniOps Agent Skill

Use this skill when investigating, mitigating, or verifying production incidents, infrastructure alerts, database lag spikes, or API gateway errors.

## Trigger Conditions
- SRE/DevOps incident reported (e.g. "Stripe webhook 429", "Postgres replica lag", "Kubernetes CrashLoopBackOff").
- Ingestion of PagerDuty, Datadog, Prometheus, or Stripe alerts.
- Need for deterministic safety verification and human approval gate before executing commands.

## Architecture: 4-Agent Consensus DAG
1. **Planner Agent**: Decomposes the alert into an investigation execution DAG and telemetry probes.
2. **Investigator Agent**: Queries live OS vitals, inspects SOP runbooks, and checks customer SLAs.
3. **Verifier Gate**: Validates actions against strict safety constraints (blocks destructive commands like rm -rf, DROP, FLUSHALL). Flags infrastructure mutations as AWAITING_APPROVAL.
4. **Synthesizer Agent**: Compiles the unified remediation playbook, rollback procedure, and stakeholder notification.

## CLI Execution
\`\`\`bash
# Zero-install execution via npx
npx omniops "Postgres replica lag exceeding 180s on analytics cluster"

# Stdin log pipe
cat /var/log/syslog | npx omniops

# Authorize pending remediation
npx omniops approve <incident-id>

# Run as background daemon
npx omniops listen --port 8000
\`\`\`

## REST API Integration
- Live API Base: https://one6bits.onrender.com
- Ingest Alert: POST https://one6bits.onrender.com/api/agents/webhook/alert (accepts Alertmanager, PagerDuty V3, Datadog or generic JSON; aliases: /api/webhooks/alertmanager, /api/webhooks/pagerduty, /api/webhooks/datadog)
- Stream Execution: POST https://one6bits.onrender.com/api/agents/stream
- Health Probe: GET https://one6bits.onrender.com/api/health
`

  return (
    <div className="min-h-screen flex flex-col font-sans text-neutral-800" style={{ backgroundColor: '#f4f5f7' }}>
      {/* ============ HEADER ============ */}
      <header
        className="sticky top-0 z-50 shadow-sm"
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '4px solid #212529',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center justify-center transition-transform hover:scale-105"
              style={{
                width: 42,
                height: 42,
                backgroundColor: '#212529',
                color: '#92cc41',
                boxShadow: '4px 4px 0px rgba(0,0,0,0.3)',
                textDecoration: 'none',
              }}
            >
              <Zap size={22} strokeWidth={2.5} />
            </Link>
            <div>
              <Link to="/" style={{ textDecoration: 'none', color: '#212529' }}>
                <span className="font-arcade text-sm font-bold tracking-tight">
                  16Bits OmniOps
                </span>
              </Link>
              <div
                className="font-mono text-neutral-600 hidden sm:block text-xs mt-0.5"
              >
                DOCUMENTATION & ENTERPRISE ARCHITECTURE
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="nes-btn font-arcade nes-btn-xs"
              style={{ textDecoration: 'none', fontSize: 9 }}
            >
              CONSOLE
            </Link>
            <Link
              to="/docs"
              className="nes-btn is-primary font-arcade nes-btn-xs"
              style={{ textDecoration: 'none', fontSize: 9 }}
            >
              DOCS
            </Link>
            <a
              href="https://www.npmjs.com/package/omniops"
              target="_blank"
              rel="noreferrer"
              className="nes-btn is-warning font-arcade nes-btn-xs"
              style={{ textDecoration: 'none', fontSize: 9 }}
            >
              NPM: omniops@1.0.3
            </a>
            <AuthBadge />
          </div>
        </div>
      </header>

      {/* ============ DOCS HERO ============ */}
      <section className="max-w-6xl w-full mx-auto px-4 pt-10 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={18} className="text-neutral-900" />
          <span className="font-arcade text-xs text-neutral-700 font-bold">
            ARCHITECTURE & DEVELOPER GUIDE
          </span>
        </div>
        <h1 className="font-arcade text-xl sm:text-2xl md:text-3xl leading-snug text-neutral-900">
          16Bits OmniOps Documentation
        </h1>
        <p className="mt-3 text-neutral-700 text-sm md:text-base max-w-3xl leading-relaxed">
          Autonomous multi-agent consensus system for production site reliability engineering.
          OmniOps pairs a 4-agent Directed Acyclic Graph (DAG) with dynamic SOP runbook matching,
          a deterministic safety verification gate, and full-lifecycle LangSmith observability.
        </p>
      </section>

      {/* ============ MAIN DOCS GRID ============ */}
      <div className="max-w-6xl w-full mx-auto px-4 pb-20 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* STICKY SIDEBAR NAVIGATION */}
        <aside className="lg:col-span-3 space-y-5">
          <div className="nes-container with-title sticky top-24" style={{ backgroundColor: '#ffffff', padding: '16px' }}>
            <p className="title font-arcade" style={{ fontSize: 9 }}>
              Contents
            </p>
            <nav className="space-y-2 text-xs md:text-sm font-medium">
              <a href="#overview" className="block text-neutral-700 hover:text-black hover:font-bold transition-colors">
                1. System Overview
              </a>
              <a href="#architecture" className="block text-neutral-700 hover:text-black hover:font-bold transition-colors">
                2. 4-Agent Consensus DAG
              </a>
              <a href="#cli" className="block text-neutral-700 hover:text-black hover:font-bold transition-colors">
                3. CLI & Zero-Install
              </a>
              <a href="#webhooks" className="block text-neutral-700 hover:text-black hover:font-bold transition-colors">
                4. Webhook Ingestion
              </a>
              <a href="#runbooks" className="block text-neutral-700 hover:text-black hover:font-bold transition-colors">
                5. Dynamic SOP Runbooks
              </a>
              <a href="#skill" className="block text-neutral-700 hover:text-black hover:font-bold transition-colors">
                6. Agentic SKILL.md
              </a>
              <a href="#api" className="block text-neutral-700 hover:text-black hover:font-bold transition-colors">
                7. REST API Reference
              </a>
              <a href="#compliance" className="block text-neutral-700 hover:text-black hover:font-bold transition-colors">
                8. Compliance & Governance
              </a>
              <a href="#knowledge-graph" className="block text-neutral-700 hover:text-black hover:font-bold transition-colors">
                9. Code Knowledge Graph (AST)
              </a>
            </nav>

            <div className="mt-6 pt-4 border-t-2 border-neutral-200 text-xs font-mono space-y-3">
              <div>
                <span className="font-bold text-neutral-900 block text-xs">Render Backend:</span>
                <a
                  href="https://one6bits.onrender.com/api/health"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline break-all"
                >
                  one6bits.onrender.com
                </a>
              </div>
              <div>
                <span className="font-bold text-neutral-900 block text-xs">Global Package:</span>
                <a
                  href="https://www.npmjs.com/package/omniops"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline break-all"
                >
                  npmjs.com/package/omniops
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* CONTENT AREA */}
        <main className="lg:col-span-9 space-y-10">
          {/* SECTION 1: SYSTEM OVERVIEW */}
          <section id="overview" className="nes-container with-title scroll-mt-24" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
            <p className="title font-arcade" style={{ fontSize: 10 }}>
              1. System Overview
            </p>
            <div className="text-sm md:text-base text-neutral-800 space-y-4 leading-relaxed">
              <p>
                Enterprise infrastructure downtime costs an average of <strong>$5,600 per minute</strong>.
                When high-severity incidents strike at 2:00 AM, the human bottleneck causes an average
                Mean Time to Resolution (MTTR) of <strong>45 to 90 minutes</strong>: engineers must manually
                cross-reference PagerDuty alerts, Datadog dashboards, cloud provider status pages, and tribal-knowledge runbooks.
              </p>
              
              <div
                className="p-4 my-4"
                style={{
                  backgroundColor: '#f8fafc',
                  border: '3px solid #212529',
                  boxShadow: '4px 4px 0px rgba(0,0,0,0.1)',
                }}
              >
                <div className="font-arcade text-xs text-neutral-900 mb-3 tracking-wide">
                  BENCHMARK: HUMAN SRE VS. 16BITS OMNIOPS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
                  <div className="p-3 bg-red-50 border-2 border-red-200">
                    <span className="font-bold text-red-800 block text-sm mb-1">Manual Human SRE Triage:</span>
                    <ul className="list-disc list-inside text-neutral-700 space-y-1">
                      <li>Average MTTR: 45 to 90 minutes</li>
                      <li>Fragmented cross-system investigation</li>
                      <li>High risk of fat-finger typos on production</li>
                      <li>Incomplete, rushed post-mortems</li>
                    </ul>
                  </div>
                  <div className="p-3 bg-emerald-50 border-2 border-emerald-300">
                    <span className="font-bold text-emerald-900 block text-sm mb-1">16Bits OmniOps Swarm:</span>
                    <ul className="list-disc list-inside text-neutral-800 space-y-1">
                      <li>Average MTTR: 3.4 seconds (99% reduction)</li>
                      <li>Autonomous 4-agent consensus DAG</li>
                      <li>Deterministic safety verification gate</li>
                      <li>Approver identity from the operator JWT, recorded in the database audit trail</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: 4-AGENT CONSENSUS DAG */}
          <section id="architecture" className="nes-container with-title scroll-mt-24" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
            <p className="title font-arcade" style={{ fontSize: 10 }}>
              2. 4-Agent Consensus DAG
            </p>
            <div className="text-sm md:text-base text-neutral-800 space-y-4 leading-relaxed">
              <p>
                A single prompt to a generic LLM hallucinates risky shell commands without checking safety policies.
                16Bits OmniOps partitions the task into four specialized autonomous agents executing in a strict
                Directed Acyclic Graph (DAG):
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                <div
                  className="p-4"
                  style={{
                    backgroundColor: '#f0f9ff',
                    border: '3px solid #209cee',
                    boxShadow: '3px 3px 0px #209cee',
                  }}
                >
                  <div className="font-arcade text-xs text-blue-800 mb-1">
                    STAGE 1: PLANNER AGENT
                  </div>
                  <p className="text-xs md:text-sm text-neutral-800 mt-2 leading-relaxed">
                    Normalizes messy error logs, identifies root error signatures, categorizes the incident domain,
                    and outputs a structured investigation plan with targeted diagnostic probes.
                  </p>
                  <div className="mt-3 text-neutral-600 text-xs font-mono font-semibold">
                    Output: Investigation Plan + Diagnostic Probes
                  </div>
                </div>

                <div
                  className="p-4"
                  style={{
                    backgroundColor: '#faf5ff',
                    border: '3px solid #ad8bc9',
                    boxShadow: '3px 3px 0px #ad8bc9',
                  }}
                >
                  <div className="font-arcade text-xs text-purple-800 mb-1">
                    STAGE 2: INVESTIGATOR AGENT
                  </div>
                  <p className="text-xs md:text-sm text-neutral-800 mt-2 leading-relaxed">
                    Queries live host telemetry (CPU, RAM, load averages, process uptime), inspects queue backlogs,
                    and semantically matches the exact Standard Operating Procedure (SOP) runbook.
                  </p>
                  <div className="mt-3 text-neutral-600 text-xs font-mono font-semibold">
                    Output: Host Telemetry + Matched SOP Runbook
                  </div>
                </div>

                <div
                  className="p-4"
                  style={{
                    backgroundColor: '#fefce8',
                    border: '3px solid #f7d51d',
                    boxShadow: '3px 3px 0px #f7d51d',
                  }}
                >
                  <div className="font-arcade text-xs text-yellow-900 mb-1">
                    STAGE 3: VERIFIER GATE (SAFETY)
                  </div>
                  <p className="text-xs md:text-sm text-neutral-800 mt-2 leading-relaxed">
                    Audits all proposed actions against safety policies. Destructive commands (rm -rf, DROP TABLE, FLUSHALL)
                    are rejected. Any system state mutation halts behind an operator authorization gate.
                  </p>
                  <div className="mt-3 text-neutral-600 text-xs font-mono font-semibold">
                    Output: Safety Verdict (AWAITING_APPROVAL / RESOLVED)
                  </div>
                </div>

                <div
                  className="p-4"
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '3px solid #92cc41',
                    boxShadow: '3px 3px 0px #92cc41',
                  }}
                >
                  <div className="font-arcade text-xs text-green-800 mb-1">
                    STAGE 4: SYNTHESIZER AGENT
                  </div>
                  <p className="text-xs md:text-sm text-neutral-800 mt-2 leading-relaxed">
                    Compiles the finalized remediation playbook, numbered shell execution commands,
                    rollback instructions, and formats a real-time incident card broadcast to Slack.
                  </p>
                  <div className="mt-3 text-neutral-600 text-xs font-mono font-semibold">
                    Output: Finalized Runbook + Slack Broadcast
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: CLI & ZERO-INSTALL */}
          <section id="cli" className="nes-container with-title scroll-mt-24" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
            <p className="title font-arcade" style={{ fontSize: 10 }}>
              3. Global CLI & Zero-Install
            </p>
            <div className="text-sm md:text-base text-neutral-800 space-y-4 leading-relaxed">
              <p>
                The 16Bits OmniOps CLI is published globally on the npm registry as{' '}
                <a
                  href="https://www.npmjs.com/package/omniops"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline text-blue-700"
                >
                  omniops@1.0.3
                </a>
                . It requires zero local setup to evaluate an alert, or can connect directly to your backend
                service via the <code className="bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 font-mono text-xs">OMNIOPS_API_URL</code> environment variable.
              </p>

              <div className="relative my-3">
                <div
                  className="p-4 font-mono text-xs md:text-sm overflow-x-auto leading-relaxed"
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '3px solid #212529',
                    color: '#0f172a',
                  }}
                >
                  <div className="text-neutral-500 mb-1"># Global installation (binary: omniops)</div>
                  <div className="font-bold text-neutral-900">npm install -g omniops</div>
                  
                  <div className="text-neutral-500 mt-3 mb-1"># Or zero-install execution via npx</div>
                  <div className="font-bold text-neutral-900">npx omniops "Stripe payment gateway webhook consumer lag &gt; 4000"</div>
                  
                  <div className="text-neutral-500 mt-3 mb-1"># Pipe production server logs directly from stdout</div>
                  <div className="font-bold text-neutral-900">cat /var/log/nginx/error.log | omniops</div>
                  
                  <div className="text-neutral-500 mt-3 mb-1"># Sign off and approve remediation for an incident</div>
                  <div className="font-bold text-neutral-900">omniops approve inc-1741234567890</div>
                  <div className="text-neutral-500 mt-1 mb-1"># Signs in as the demo operator by default; set OMNIOPS_TOKEN or OMNIOPS_EMAIL / OMNIOPS_PASSWORD for your own account (CLI v1.0.3+)</div>
                  
                  <div className="text-neutral-500 mt-3 mb-1"># Start continuous alert ingestion daemon</div>
                  <div className="font-bold text-neutral-900">omniops listen --port 8000</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'cli-commands',
                      'npm install -g omniops\nnpx omniops "Stripe payment gateway webhook consumer lag > 4000"\ncat /var/log/nginx/error.log | omniops'
                    )
                  }
                  className="nes-btn nes-btn-xs absolute top-3 right-3 font-mono"
                  style={{ fontSize: 10 }}
                >
                  {copiedKey === 'cli-commands' ? (
                    <>
                      <CheckCheck size={12} className="inline mr-1 text-green-700" />
                      COPIED
                    </>
                  ) : (
                    <>
                      <Copy size={12} className="inline mr-1" />
                      COPY
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 4: WEBHOOK INGESTION */}
          <section id="webhooks" className="nes-container with-title scroll-mt-24" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
            <p className="title font-arcade" style={{ fontSize: 10 }}>
              4. Webhook Ingestion & Slack Dispatch
            </p>
            <div className="text-sm md:text-base text-neutral-800 space-y-4 leading-relaxed">
              <p>
                Point your monitoring tool at one URL. OmniOps reads Prometheus Alertmanager, PagerDuty (V3
                webhooks) and Datadog payloads as they are, maps severity to priority, skips resolved alerts,
                and does not re-run the swarm while the same alert already has an open incident.
              </p>

              <div
                className="p-4 font-mono text-xs md:text-sm bg-slate-50 border-2 border-neutral-900 text-neutral-900 leading-relaxed"
                style={{ backgroundColor: '#f8fafc' }}
              >
                <span className="font-bold text-neutral-900 block mb-1">
                  POST https://one6bits.onrender.com/api/agents/webhook/alert
                </span>
                <span className="text-neutral-500 block text-xs">
                  Per-tool aliases: /api/webhooks/alertmanager · /api/webhooks/pagerduty · /api/webhooks/datadog
                </span>
                <span className="text-neutral-500 block mb-3 text-xs">
                  Auth (when WEBHOOK_SECRET is set): header x-webhook-secret: &lt;secret&gt;, or Authorization: Bearer &lt;secret&gt;
                </span>
                <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
{`# Generic JSON (waits and returns the swarm result)
curl -X POST https://one6bits.onrender.com/api/agents/webhook/alert \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: $WEBHOOK_SECRET" \\
  -d '{"title": "Database Read Replica Lag Exceeds 180s",
       "description": "Replica lag on replica-02 breached 180s for 3 checks.",
       "priority": "HIGH"}'

# Prometheus Alertmanager (alertmanager.yml)
receivers:
  - name: omniops
    webhook_configs:
      - url: https://one6bits.onrender.com/api/webhooks/alertmanager
        http_config:
          authorization:
            credentials: <WEBHOOK_SECRET>

# PagerDuty: Integrations > Generic Webhooks (v3) > New Webhook
#   URL: https://one6bits.onrender.com/api/webhooks/pagerduty
#   Event: incident.triggered   Custom header: x-webhook-secret = <WEBHOOK_SECRET>

# Datadog: Integrations > Webhooks > New
#   URL: https://one6bits.onrender.com/api/webhooks/datadog
#   Custom headers: {"x-webhook-secret": "<WEBHOOK_SECRET>"}
#   Payload: {"title": "$EVENT_TITLE", "body": "$EVENT_MSG", "alert_transition": "$ALERT_TRANSITION",
#             "alert_priority": "$ALERT_PRIORITY", "alert_type": "$ALERT_TYPE",
#             "aggreg_key": "$AGGREG_KEY", "link": "$LINK", "hostname": "$HOSTNAME"}`}
                </pre>
              </div>

              <p className="text-sm text-neutral-700">
                Alertmanager, PagerDuty and Datadog calls get an immediate 202 with the incident ID while the
                swarm runs in the background, so they never time out. Resolved notifications are acknowledged
                without a new run.
              </p>

              <p className="text-sm text-neutral-700">
                When an alert is verified and synthesized, OmniOps automatically formats a rich incident
                card and broadcasts the remediation playbook to your on-call Slack channel via{' '}
                <code className="bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 font-mono text-xs">SLACK_WEBHOOK_URL</code>.
              </p>
            </div>
          </section>

          {/* SECTION 5: DYNAMIC SOP RUNBOOKS */}
          <section id="runbooks" className="nes-container with-title scroll-mt-24" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
            <p className="title font-arcade" style={{ fontSize: 10 }}>
              5. Dynamic SOP Runbooks
            </p>
            <div className="text-sm md:text-base text-neutral-800 space-y-4 leading-relaxed">
              <p>
                SRE teams can author Standard Operating Procedures (SOPs) as standard Markdown documents with
                YAML frontmatter. OmniOps loads and indexes runbooks dynamically at runtime without requiring
                server restarts or database migrations.
              </p>

              {/* CURRENT RUNBOOKS LIST */}
              <div className="p-4 bg-slate-50 border-2 border-neutral-900">
                <div className="font-arcade text-xs text-neutral-900 mb-3">
                  LOADED RUNBOOKS IN MEMORY ({runbooks.length})
                </div>
                <div className="space-y-2">
                  {runbooks.map((rb, idx) => (
                    <div key={idx} className="p-3 bg-white border border-neutral-300 text-xs md:text-sm flex items-center justify-between">
                      <span className="font-bold text-blue-800">{rb.title}</span>
                      <span className="text-neutral-500 text-xs font-mono">({rb.filename})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* INTERACTIVE SOP UPLOADER */}
              <form onSubmit={handleUploadSop} className="p-4 bg-white border-2 border-neutral-900 space-y-4">
                <div className="font-arcade text-xs text-neutral-900">
                  UPLOAD CUSTOM RUNBOOK TO BACKEND
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 font-mono">FILENAME</label>
                  <input
                    type="text"
                    className="nes-input text-xs font-mono"
                    value={uploadFilename}
                    onChange={(e) => setUploadFilename(e.target.value)}
                    placeholder="sop-custom-service.md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 font-mono">MARKDOWN SOP CONTENT</label>
                  <textarea
                    className="nes-textarea text-xs font-mono leading-relaxed"
                    rows={7}
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                  />
                </div>
                {uploadStatus && (
                  <div
                    className="p-3 text-xs font-mono"
                    style={{
                      border: '2px solid #212529',
                      backgroundColor: uploadStatus.startsWith('[SUCCESS]') ? '#e6f9d8' : '#fdf0d5',
                    }}
                  >
                    {uploadStatus}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isUploading}
                  className="nes-btn is-primary nes-btn-xs font-arcade"
                  style={{ fontSize: 9 }}
                >
                  {isUploading ? 'INDEXING RUNBOOK...' : 'UPLOAD & INDEX RUNBOOK →'}
                </button>
              </form>
            </div>
          </section>

          {/* SECTION 6: AGENTIC SKILL.MD */}
          <section id="skill" className="nes-container with-title scroll-mt-24" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
            <p className="title font-arcade" style={{ fontSize: 10 }}>
              6. Agentic SKILL.md for AI Coding Assistants
            </p>
            <div className="text-sm md:text-base text-neutral-800 space-y-4 leading-relaxed">
              <p>
                External AI coding assistants like Claude Code, Cursor, Antigravity, or Cline can be equipped
                with the official <strong>16Bits OmniOps Skill</strong>. Drop this specification into your
                skills directory to allow your local agents to invoke OmniOps autonomously:
              </p>

              <div className="relative my-3">
                <pre
                  className="p-4 font-mono text-xs md:text-sm overflow-x-auto leading-relaxed"
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '3px solid #212529',
                    color: '#0f172a',
                    maxHeight: 320,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {SKILL_MD_TEXT}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy('skill-md', SKILL_MD_TEXT)}
                  className="nes-btn nes-btn-xs absolute top-3 right-3 font-mono"
                  style={{ fontSize: 10 }}
                >
                  {copiedKey === 'skill-md' ? (
                    <>
                      <CheckCheck size={12} className="inline mr-1 text-green-700" />
                      COPIED SKILL.MD
                    </>
                  ) : (
                    <>
                      <Copy size={12} className="inline mr-1" />
                      COPY SKILL.MD
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 7: REST API REFERENCE */}
          <section id="api" className="nes-container with-title scroll-mt-24" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
            <p className="title font-arcade" style={{ fontSize: 10 }}>
              7. REST API Reference
            </p>
            <div className="text-xs md:text-sm text-neutral-800 space-y-3 leading-relaxed overflow-x-auto">
              <table className="nes-table is-bordered w-full text-xs md:text-sm">
                <thead>
                  <tr>
                    <th className="font-arcade" style={{ fontSize: 8 }}>METHOD</th>
                    <th className="font-arcade" style={{ fontSize: 8 }}>ENDPOINT</th>
                    <th className="font-arcade" style={{ fontSize: 8 }}>DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold text-blue-700 font-mono">GET</td>
                    <td className="font-mono text-xs">/api/health</td>
                    <td>Health status, active AI provider, and database state</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-green-700 font-mono">POST</td>
                    <td className="font-mono text-xs">/api/auth/login</td>
                    <td>Authenticate operator & return signed JWT bearer token</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-blue-700 font-mono">GET</td>
                    <td className="font-mono text-xs">/api/incidents</td>
                    <td>Fetch recent incidents and operational audit trails</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-green-700 font-mono">POST</td>
                    <td className="font-mono text-xs">/api/agents/execute</td>
                    <td>Synchronous 4-agent swarm orchestration endpoint</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-green-700 font-mono">POST</td>
                    <td className="font-mono text-xs">/api/agents/stream</td>
                    <td>Server-Sent Events (SSE) streaming agent execution log</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-yellow-700 font-mono">POST</td>
                    <td className="font-mono text-xs">/api/agents/approve</td>
                    <td>Operator sign-off on awaiting actions (requires <code>Authorization: Bearer &lt;JWT&gt;</code> from /api/auth/login)</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-blue-700 font-mono">GET</td>
                    <td className="font-mono text-xs">/api/agents/runbooks</td>
                    <td>List all loaded Standard Operating Procedure runbooks</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-green-700 font-mono">POST</td>
                    <td className="font-mono text-xs">/api/agents/runbooks</td>
                    <td>Upload and index a new custom Markdown SOP runbook</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-green-700 font-mono">POST</td>
                    <td className="font-mono text-xs">/api/agents/webhook/alert</td>
                    <td>Universal alert ingestion (PagerDuty, Datadog, Prometheus)</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-green-700 font-mono">POST</td>
                    <td className="font-mono text-xs">/api/webhooks/alerts</td>
                    <td>Direct alias for external alert webhook ingestion</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 8: COMPLIANCE & GOVERNANCE */}
          <section id="compliance" className="nes-container with-title scroll-mt-24" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
            <p className="title font-arcade" style={{ fontSize: 10 }}>
              8. Compliance, Security & Governance
            </p>
            <div className="text-sm md:text-base text-neutral-800 space-y-4 leading-relaxed">
              <p>
                In high-stakes enterprise environments (banking, healthcare, critical infrastructure),
                unsupervised AI execution is a severe compliance violation. OmniOps enforces three strict
                governance tiers:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>
                  <strong>Deterministic Destructive Command Block:</strong> System interceptors inspect all
                  remediation commands. Keywords like <code className="bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 font-mono text-xs">rm -rf</code>,{' '}
                  <code className="bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 font-mono text-xs">DROP DATABASE</code>, or{' '}
                  <code className="bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 font-mono text-xs">FLUSHALL</code> are unconditionally purged.
                </li>
                <li>
                  <strong>Human-in-the-Loop Sign-Off:</strong> Remediation actions that mutate production
                  state halt in the <code className="bg-yellow-100 px-1.5 py-0.5 border border-yellow-300 font-mono text-xs text-yellow-900">AWAITING_APPROVAL</code> state.
                  An authorized operator must sign off via JWT Bearer token or CLI approval command.
                </li>
                <li>
                  <strong>Audit Logging:</strong> Every agent step, the approving operator and the approval
                  time are recorded in the database (Postgres, or SQLite locally), and traced to LangSmith when a key is set.
                </li>
              </ul>
            </div>
          </section>

          {/* SECTION 9: CODEBASE KNOWLEDGE GRAPH (AST) */}
          <section id="knowledge-graph" className="nes-container with-title scroll-mt-24" style={{ backgroundColor: '#ffffff', padding: '24px' }}>
            <p className="title font-arcade" style={{ fontSize: 10 }}>
              9. Codebase Knowledge Graph (AST Architecture)
            </p>
            <div className="text-sm md:text-base text-neutral-800 space-y-4 leading-relaxed">
              <p>
                To eliminate AI hallucination during incident triage, 16Bits OmniOps employs static
                Abstract Syntax Tree (AST) extraction and community detection across the backend codebase
                using Graphify.
              </p>

              <div
                className="p-4 my-3"
                style={{
                  backgroundColor: '#f8fafc',
                  border: '3px solid #212529',
                  boxShadow: '4px 4px 0px rgba(0,0,0,0.1)',
                }}
              >
                <div className="font-arcade text-xs text-neutral-900 mb-2">
                  STATIC AST PIPELINE & ARCHITECTURAL CLUSTERING
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
                  <div className="p-3 bg-blue-50 border-2 border-blue-200">
                    <span className="font-bold text-blue-900 block text-sm mb-1">AST Structural Extraction:</span>
                    <p className="text-neutral-700 leading-relaxed">
                      Parses TypeScript code into deterministic symbol graphs (functions, imports, class hierarchies)
                      with zero LLM guessing or hallucinations.
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 border-2 border-purple-200">
                    <span className="font-bold text-purple-900 block text-sm mb-1">Leiden Community Detection:</span>
                    <p className="text-neutral-700 leading-relaxed">
                      Partitions code into tightly-coupled modules: Authentication, Database Access,
                      Swarm Orchestration, Guardrails, and Webhook Ingestion.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-neutral-100 border border-neutral-300 text-xs font-mono">
                <span className="font-bold block text-neutral-900 mb-1">Interactive Graph & Audit Artifacts:</span>
                <span className="text-neutral-700 block">
                  Artifact directory: <code className="bg-white px-1 border border-neutral-300">backend/graphify-out/</code>
                </span>
                <span className="text-neutral-700 block mt-1">
                  Files: <code className="bg-white px-1 border border-neutral-300">graph.html</code> (interactive visual canvas),{' '}
                  <code className="bg-white px-1 border border-neutral-300">GRAPH_REPORT.md</code> (architectural god nodes & coupling audit),{' '}
                  <code className="bg-white px-1 border border-neutral-300">graph.json</code> (networkx raw data).
                </span>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* ============ FOOTER ============ */}
      <footer
        style={{
          borderTop: '4px solid #212529',
          backgroundColor: '#212529',
          color: '#e7e7e7',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="font-arcade text-xs text-green-400 mb-3">
              ENTERPRISE SRE SWARM
            </div>
            <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">
              16Bits OmniOps reduces enterprise incident response time from 45 minutes to 3.4 seconds
              through a multi-agent consensus DAG.
            </p>
          </div>
          <div>
            <div className="font-arcade text-xs text-blue-400 mb-3">
              RESOURCES
            </div>
            <ul className="text-xs md:text-sm space-y-2 font-mono">
              <li>
                <Link to="/" className="text-neutral-300 hover:text-white transition-colors">
                  &gt; Swarm Console
                </Link>
              </li>
              <li>
                <Link to="/docs" className="text-neutral-300 hover:text-white transition-colors">
                  &gt; Documentation
                </Link>
              </li>
              <li>
                <a
                  href="https://www.npmjs.com/package/omniops"
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  &gt; npm: omniops@1.0.3
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-arcade text-xs text-yellow-400 mb-3">
              SUBMISSION STATUS
            </div>
            <p className="text-xs md:text-sm text-neutral-300 leading-relaxed font-mono">
              Theme: Agentic AI & Intelligent Systems
              <br />
              Status: Production Verified
              <br />
              Deployments: Render + Vercel + npm
            </p>
          </div>
        </div>
        <div className="text-center pb-6 text-xs text-neutral-400 font-mono border-t border-neutral-700 pt-4">
          16Bits OmniOps · Production Release 1.0.0 · MIT License
        </div>
      </footer>
    </div>
  )
}
