import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  Copy,
  CheckCheck,
} from 'lucide-react'
import {
  fetchRunbooks,
  uploadRunbook,
  searchRunbooks,
  deleteRunbook,
  UnauthorizedError,
  type RunbookSummary,
  type RunbookSearchResponse,
} from '../services/api'
import { useAuth } from '../auth'
import { Shell } from '../components/Shell'

export default function DocsPage() {
  const [runbooks, setRunbooks] = useState<RunbookSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('cache node out of memory, evictions spiking')
  const [searchResult, setSearchResult] = useState<RunbookSearchResponse | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchError(null)
    try {
      setSearchResult(await searchRunbooks(searchQuery))
    } catch (err: any) {
      setSearchResult(null)
      setSearchError(err.message)
    } finally {
      setIsSearching(false)
    }
  }

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete runbook ${filename}?`)) return
    try {
      const token = await ensureToken()
      if (!token) return
      await deleteRunbook(filename, token)
      setUploadStatus(`[SUCCESS] Deleted ${filename}`)
      loadRunbooks()
    } catch (err: any) {
      if (err instanceof UnauthorizedError) logout()
      setUploadStatus(`[ERROR] ${err.message}`)
    }
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

  const codeBlock = {
    backgroundColor: 'var(--bg-inset)',
    border: '2px solid var(--border)',
    color: 'var(--ink)',
  } as const

  return (
    <Shell>
      {/* ============ DOCS HERO ============ */}
      <section className="max-w-6xl w-full mx-auto px-4 pt-10 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={18} style={{ color: 'var(--ink)' }} />
          <span className="font-display" style={{ fontSize: 10, color: 'var(--ink-dim)' }}>
            ARCHITECTURE & DEVELOPER GUIDE
          </span>
        </div>
        <h1 className="font-display" style={{ fontSize: 'clamp(14px, 2.5vw, 22px)', lineHeight: 1.5 }}>
          16Bits OmniOps Documentation
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed" style={{ color: 'var(--ink-dim)', fontSize: 15 }}>
          Autonomous multi-agent consensus system for production site reliability engineering.
          OmniOps pairs a 4-agent Directed Acyclic Graph (DAG) with dynamic SOP runbook matching,
          a deterministic safety verification gate, and full-lifecycle LangSmith observability.
        </p>
      </section>

      {/* ============ MAIN DOCS GRID ============ */}
      <div className="max-w-6xl w-full mx-auto px-4 pb-20 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* STICKY SIDEBAR NAVIGATION */}
        <aside className="lg:col-span-3 space-y-5">
          <div className="panel sticky top-24" style={{ padding: 16 }}>
            <p className="panel-title font-display">Contents</p>
            <nav className="space-y-2 font-code" style={{ fontSize: 11 }}>
              {[
                ['#overview', '1. System Overview'],
                ['#architecture', '2. 4-Agent Consensus DAG'],
                ['#cli', '3. CLI & Zero-Install'],
                ['#webhooks', '4. Webhook Ingestion'],
                ['#runbooks', '5. Dynamic SOP Runbooks'],
                ['#skill', '6. Agentic SKILL.md'],
                ['#api', '7. REST API Reference'],
                ['#compliance', '8. Compliance & Governance'],
                ['#knowledge-graph', '9. Code Knowledge Graph (AST)'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="link block" style={{ color: 'var(--ink-dim)' }}>
                  {label}
                </a>
              ))}
            </nav>

            <hr className="rule" />
            <div className="font-code space-y-3" style={{ fontSize: 10 }}>
              <div>
                <span className="font-bold block" style={{ color: 'var(--ink)' }}>Render Backend:</span>
                <a
                  href="https://one6bits.onrender.com/api/health"
                  target="_blank"
                  rel="noreferrer"
                  className="link break-all"
                >
                  one6bits.onrender.com
                </a>
              </div>
              <div>
                <span className="font-bold block" style={{ color: 'var(--ink)' }}>Global Package:</span>
                <a
                  href="https://www.npmjs.com/package/omniops"
                  target="_blank"
                  rel="noreferrer"
                  className="link break-all"
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
          <section id="overview" className="panel scroll-mt-24">
            <p className="panel-title font-display">1. System Overview</p>
            <div className="space-y-4 leading-relaxed" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <p>
                Enterprise infrastructure downtime costs an average of <strong>$5,600 per minute</strong>.
                When high-severity incidents strike at 2:00 AM, the human bottleneck causes an average
                Mean Time to Resolution (MTTR) of <strong>45 to 90 minutes</strong>: engineers must manually
                cross-reference PagerDuty alerts, Datadog dashboards, cloud provider status pages, and tribal-knowledge runbooks.
              </p>

              <div className="p-4" style={{ backgroundColor: 'var(--bg-inset)', border: '3px solid var(--border)' }}>
                <div className="font-display mb-3" style={{ fontSize: 9 }}>
                  BENCHMARK: HUMAN SRE VS. 16BITS OMNIOPS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ fontSize: 12 }}>
                  <div className="p-3" style={{ border: '2px solid var(--danger)', backgroundColor: 'var(--danger-soft)' }}>
                    <span className="font-bold block mb-1" style={{ fontSize: 13 }}>Manual Human SRE Triage:</span>
                    <ul className="list-disc list-inside space-y-1 font-code" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>
                      <li>Average MTTR: 45 to 90 minutes</li>
                      <li>Fragmented cross-system investigation</li>
                      <li>High risk of fat-finger typos on production</li>
                      <li>Incomplete, rushed post-mortems</li>
                    </ul>
                  </div>
                  <div className="p-3" style={{ border: '2px solid var(--success)', backgroundColor: 'var(--success-soft)' }}>
                    <span className="font-bold block mb-1" style={{ fontSize: 13 }}>16Bits OmniOps Swarm:</span>
                    <ul className="list-disc list-inside space-y-1 font-code" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>
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
          <section id="architecture" className="panel scroll-mt-24">
            <p className="panel-title font-display">2. 4-Agent Consensus DAG</p>
            <div className="space-y-4 leading-relaxed" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <p>
                A single prompt to a generic LLM hallucinates risky shell commands without checking safety policies.
                16Bits OmniOps partitions the task into four specialized autonomous agents executing in a strict
                Directed Acyclic Graph (DAG):
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                {[
                  {
                    title: 'STAGE 1: PLANNER AGENT',
                    color: 'var(--accent)',
                    soft: 'var(--accent-soft)',
                    body: 'Normalizes messy error logs, identifies root error signatures, categorizes the incident domain, and outputs a structured investigation plan with targeted diagnostic probes.',
                    out: 'Output: Investigation Plan + Diagnostic Probes',
                  },
                  {
                    title: 'STAGE 2: INVESTIGATOR AGENT',
                    color: 'var(--purple)',
                    soft: 'var(--purple-soft)',
                    body: 'Queries live host telemetry (CPU, RAM, load averages, process uptime), inspects queue backlogs, and semantically matches the exact Standard Operating Procedure (SOP) runbook.',
                    out: 'Output: Host Telemetry + Matched SOP Runbook',
                  },
                  {
                    title: 'STAGE 3: VERIFIER GATE (SAFETY)',
                    color: 'var(--warning)',
                    soft: 'var(--warning-soft)',
                    body: 'Audits all proposed actions against safety policies. Destructive commands (rm -rf, DROP TABLE, FLUSHALL) are rejected. Any system state mutation halts behind an operator authorization gate.',
                    out: 'Output: Safety Verdict (AWAITING_APPROVAL / RESOLVED)',
                  },
                  {
                    title: 'STAGE 4: SYNTHESIZER AGENT',
                    color: 'var(--success)',
                    soft: 'var(--success-soft)',
                    body: 'Compiles the finalized remediation playbook, numbered shell execution commands, rollback instructions, and formats a real-time incident card broadcast to Slack.',
                    out: 'Output: Finalized Runbook + Slack Broadcast',
                  },
                ].map((s) => (
                  <div key={s.title} className="p-4" style={{ border: `3px solid ${s.color}`, backgroundColor: s.soft }}>
                    <div className="font-display mb-1" style={{ fontSize: 9 }}>{s.title}</div>
                    <p className="mt-2 leading-relaxed" style={{ fontSize: 12 }}>{s.body}</p>
                    <div className="mt-3 font-code font-semibold" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>
                      {s.out}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 3: CLI & ZERO-INSTALL */}
          <section id="cli" className="panel scroll-mt-24">
            <p className="panel-title font-display">3. Global CLI & Zero-Install</p>
            <div className="space-y-4 leading-relaxed" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <p>
                The 16Bits OmniOps CLI is published globally on the npm registry as{' '}
                <a
                  href="https://www.npmjs.com/package/omniops"
                  target="_blank"
                  rel="noreferrer"
                  className="link font-bold underline"
                >
                  omniops@1.0.5
                </a>
                . It requires zero local setup to evaluate an alert, or can connect directly to your backend
                service via the <code className="font-code px-1.5 py-0.5" style={codeBlock}>OMNIOPS_API_URL</code> environment variable.
              </p>

              <div className="relative my-3">
                <div className="p-4 font-code overflow-x-auto leading-relaxed" style={{ ...codeBlock, fontSize: 12 }}>
                  <div style={{ color: 'var(--ink-faint)' }}># Global installation (binary: omniops)</div>
                  <div className="font-bold">npm install -g omniops</div>

                  <div className="mt-3" style={{ color: 'var(--ink-faint)' }}># Or zero-install execution via npx</div>
                  <div className="font-bold">npx omniops "Stripe payment gateway webhook consumer lag &gt; 4000"</div>

                  <div className="mt-3" style={{ color: 'var(--ink-faint)' }}># Pipe production server logs directly from stdout</div>
                  <div className="font-bold">cat /var/log/nginx/error.log | omniops</div>

                  <div className="mt-3" style={{ color: 'var(--ink-faint)' }}># Authenticate operator and store JWT in ~/.omniops/config.json</div>
                  <div className="font-bold">omniops login</div>

                  <div className="mt-3" style={{ color: 'var(--ink-faint)' }}># Check active identity, team workspace &amp; token status</div>
                  <div className="font-bold">omniops whoami</div>

                  <div className="mt-3" style={{ color: 'var(--ink-faint)' }}># View incidents triaged from this machine (~/.omniops/history.json)</div>
                  <div className="font-bold">omniops history</div>

                  <div className="mt-3" style={{ color: 'var(--ink-faint)' }}># Claim &amp; migrate machine incident history into private workspace ledger</div>
                  <div className="font-bold">omniops claim</div>

                  <div className="mt-3" style={{ color: 'var(--ink-faint)' }}># Sign off and approve remediation for an incident</div>
                  <div className="font-bold">omniops approve inc-1741234567890</div>
                  <div style={{ color: 'var(--ink-faint)' }}># If unauthenticated, displays operator guidance and launches browser sign-in/approval link</div>

                  <div className="mt-3" style={{ color: 'var(--ink-faint)' }}># Clear local credentials and sign out</div>
                  <div className="font-bold">omniops logout</div>

                  <div className="mt-3" style={{ color: 'var(--ink-faint)' }}># Start continuous alert ingestion daemon</div>
                  <div className="font-bold">omniops listen --port 8000</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'cli-commands',
                      'npm install -g omniops\nomniops login\nomniops history\nomniops claim\nomniops approve <incident-id>'
                    )
                  }
                  className="btn btn-xs absolute top-3 right-3 font-code"
                  style={{ fontSize: 9 }}
                >
                  {copiedKey === 'cli-commands' ? (
                    <>
                      <CheckCheck size={12} className="inline mr-1" style={{ color: 'var(--success)' }} />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" style={{ fontSize: 13 }}>
                <div className="p-3" style={{ border: '2px solid var(--border)', backgroundColor: 'var(--bg-inset)' }}>
                  <span className="font-bold block mb-1 text-accent font-display" style={{ fontSize: 11 }}>
                    MACHINE HISTORY &amp; WORKSPACE CLAIMING
                  </span>
                  <p className="leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
                    Every incident triaged from your local machine via CLI is logged locally to{' '}
                    <code className="font-code px-1 py-0.5" style={codeBlock}>~/.omniops/history.json</code>.
                    When you sign up or log in (<code className="font-code px-1 py-0.5" style={codeBlock}>omniops login</code> or on the web portal),
                    all machine-evaluated incidents are automatically <strong>claimed and linked</strong> to your private team workspace,
                    making your historical triage records and remediations permanently accessible under your private <code className="font-code px-1 py-0.5" style={codeBlock}>/audit</code> ledger.
                  </p>
                </div>
                <div className="p-3" style={{ border: '2px solid var(--border)', backgroundColor: 'var(--bg-inset)' }}>
                  <span className="font-bold block mb-1 text-accent font-display" style={{ fontSize: 11 }}>
                    INTERACTIVE BROWSER APPROVAL FALLBACK
                  </span>
                  <p className="leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
                    Running <code className="font-code px-1 py-0.5" style={codeBlock}>omniops approve &lt;id&gt;</code> without an existing session will no longer fail with an ambiguous raw token error.
                    Instead, the CLI prompts you with friendly operator sign-in instructions and automatically launches the deep-linked approval portal in your browser so you can sign in and approve in one seamless click.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: WEBHOOK INGESTION */}
          <section id="webhooks" className="panel scroll-mt-24">
            <p className="panel-title font-display">4. Webhook Ingestion & Slack Dispatch</p>
            <div className="space-y-4 leading-relaxed" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <p>
                Point your monitoring tool at one URL. OmniOps reads Prometheus Alertmanager, PagerDuty (V3
                webhooks) and Datadog payloads as they are, maps severity to priority, skips resolved alerts,
                and does not re-run the swarm while the same alert already has an open incident.
              </p>

              <div className="p-4 font-code leading-relaxed" style={{ ...codeBlock, fontSize: 12 }}>
                <span className="font-bold block mb-1">POST https://one6bits.onrender.com/api/agents/webhook/alert</span>
                <span className="block" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
                  Per-tool aliases: /api/webhooks/alertmanager · /api/webhooks/pagerduty · /api/webhooks/datadog
                </span>
                <span className="block mb-3" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
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

              <p style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
                Alertmanager, PagerDuty and Datadog calls get an immediate 202 with the incident ID while the
                swarm runs in the background, so they never time out. Resolved notifications are acknowledged
                without a new run.
              </p>

              <p style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
                When an alert is verified and synthesized, OmniOps automatically formats a rich incident
                card and broadcasts the remediation playbook to your on-call Slack channel via{' '}
                <code className="font-code px-1.5 py-0.5" style={codeBlock}>SLACK_WEBHOOK_URL</code>.
              </p>
            </div>
          </section>

          {/* SECTION 5: DYNAMIC SOP RUNBOOKS */}
          <section id="runbooks" className="panel scroll-mt-24">
            <p className="panel-title font-display">5. Dynamic SOP Runbooks</p>
            <div className="space-y-4 leading-relaxed" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <p>
                SRE teams write Standard Operating Procedures (SOPs) as Markdown. Uploads are stored in the
                database, so they survive restarts and redeploys, and are searchable right away. For every
                incident the Investigator agent searches the library by meaning, not just exact words: BM25
                keyword ranking with an ops synonym map, plus Gemini embeddings when a Gemini key is set, then
                the LLM picks the best of the top 3 or reports that none applies.
              </p>

              {/* RUNBOOK SEARCH */}
              <form onSubmit={handleSearch} className="p-4 space-y-3" style={{ border: '2px solid var(--border)', backgroundColor: 'var(--bg-panel)' }}>
                <div className="font-display" style={{ fontSize: 9 }}>TRY RUNBOOK SEARCH</div>
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    style={{ fontSize: 11 }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Describe the symptoms, e.g. payment callbacks getting 429s"
                  />
                  <button type="submit" disabled={isSearching} className="btn btn-primary btn-xs font-display" style={{ fontSize: 9 }}>
                    {isSearching ? 'SEARCHING...' : 'SEARCH →'}
                  </button>
                </div>
                {searchError && (
                  <div className="p-3 font-code" style={{ border: '2px solid var(--danger)', backgroundColor: 'var(--danger-soft)', fontSize: 11 }}>
                    [ERROR] {searchError}
                  </div>
                )}
                {searchResult && (
                  <div className="space-y-2" style={{ fontSize: 12 }}>
                    <div
                      className="p-3 font-code"
                      style={{
                        border: '2px solid var(--border)',
                        backgroundColor: searchResult.chosen ? 'var(--success-soft)' : 'var(--warning-soft)',
                        fontSize: 11,
                      }}
                    >
                      {searchResult.chosen ? (
                        <>
                          PICKED: <span className="font-bold">{searchResult.chosen.title}</span>
                        </>
                      ) : (
                        <>NO RUNBOOK FITS. The agents will propose a cautious plan and flag that a runbook is missing.</>
                      )}
                      {searchResult.rerankReason && <div className="mt-1">{searchResult.rerankReason}</div>}
                    </div>
                    {searchResult.matches.map((m, i) => (
                      <div key={m.filename} className="p-3" style={{ border: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-inset)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold" style={{ color: 'var(--accent)' }}>
                            #{i + 1} {m.title}
                          </span>
                          <span className="whitespace-nowrap" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
                            bm25 {m.signals.bm25}
                            {m.signals.semantic !== null ? ` · semantic ${m.signals.semantic}` : ''}
                          </span>
                        </div>
                        {m.snippet && <div className="mt-1 font-code" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{m.snippet}</div>}
                      </div>
                    ))}
                    {searchResult.matches.length === 0 && <div className="font-code" style={{ fontSize: 11 }}>No keyword or semantic matches.</div>}
                    <div className="font-code" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>METHOD: {searchResult.method}</div>
                  </div>
                )}
              </form>

              {/* CURRENT RUNBOOKS LIST */}
              <div className="p-4" style={{ border: '2px solid var(--border)', backgroundColor: 'var(--bg-inset)' }}>
                <div className="font-display mb-3" style={{ fontSize: 9 }}>
                  RUNBOOK LIBRARY IN DATABASE ({runbooks.length})
                </div>
                <div className="space-y-2">
                  {runbooks.map((rb) => (
                    <div
                      key={rb.filename}
                      className="p-3 flex items-center justify-between gap-2"
                      style={{ border: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-panel)', fontSize: 12 }}
                    >
                      <span className="font-bold" style={{ color: 'var(--accent)' }}>{rb.title}</span>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-code" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
                          ({rb.filename}){rb.source === 'upload' ? ' · team upload' : rb.source === 'builtin' ? ' · built-in' : ''}
                        </span>
                        {rb.source === 'upload' && (
                          <button type="button" onClick={() => handleDelete(rb.filename)} className="btn btn-danger btn-xs font-display" style={{ fontSize: 8 }}>
                            DEL
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* INTERACTIVE SOP UPLOADER */}
              <form onSubmit={handleUploadSop} className="p-4 space-y-4" style={{ border: '2px solid var(--border)', backgroundColor: 'var(--bg-panel)' }}>
                <div className="font-display" style={{ fontSize: 9 }}>UPLOAD CUSTOM RUNBOOK TO BACKEND</div>
                <div>
                  <label htmlFor="rb-filename" className="block font-bold font-code mb-1.5" style={{ fontSize: 11 }}>FILENAME</label>
                  <input
                    id="rb-filename"
                    type="text"
                    className="input"
                    style={{ fontSize: 11 }}
                    value={uploadFilename}
                    onChange={(e) => setUploadFilename(e.target.value)}
                    placeholder="sop-custom-service.md"
                  />
                </div>
                <div>
                  <label htmlFor="rb-content" className="block font-bold font-code mb-1.5" style={{ fontSize: 11 }}>MARKDOWN SOP CONTENT</label>
                  <textarea
                    id="rb-content"
                    className="textarea"
                    rows={7}
                    style={{ fontSize: 11 }}
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                  />
                </div>
                {uploadStatus && (
                  <div
                    className="p-3 font-code"
                    style={{
                      border: '2px solid var(--border)',
                      backgroundColor: uploadStatus.startsWith('[SUCCESS]') ? 'var(--success-soft)' : 'var(--danger-soft)',
                      fontSize: 11,
                    }}
                  >
                    {uploadStatus}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isUploading}
                  className="btn btn-primary btn-xs font-display"
                  style={{ fontSize: 9 }}
                >
                  {isUploading ? 'SAVING & INDEXING...' : 'SAVE & INDEX RUNBOOK →'}
                </button>
              </form>
            </div>
          </section>

          {/* SECTION 6: AGENTIC SKILL.MD */}
          <section id="skill" className="panel scroll-mt-24">
            <p className="panel-title font-display">6. Agentic SKILL.md for AI Coding Assistants</p>
            <div className="space-y-4 leading-relaxed" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <p>
                External AI coding assistants like Claude Code, Cursor, Antigravity, or Cline can be equipped
                with the official <strong>16Bits OmniOps Skill</strong>. Drop this specification into your
                skills directory to allow your local agents to invoke OmniOps autonomously:
              </p>

              <div className="relative my-3">
                <pre
                  className="p-4 font-code overflow-x-auto leading-relaxed"
                  style={{ ...codeBlock, fontSize: 11, maxHeight: 320, margin: 0, whiteSpace: 'pre-wrap' }}
                >
                  {SKILL_MD_TEXT}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy('skill-md', SKILL_MD_TEXT)}
                  className="btn btn-xs absolute top-3 right-3 font-code"
                  style={{ fontSize: 9 }}
                >
                  {copiedKey === 'skill-md' ? (
                    <>
                      <CheckCheck size={12} className="inline mr-1" style={{ color: 'var(--success)' }} />
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
          <section id="api" className="panel scroll-mt-24">
            <p className="panel-title font-display">7. REST API Reference</p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="font-display" style={{ fontSize: 8 }}>METHOD</th>
                    <th className="font-display" style={{ fontSize: 8 }}>ENDPOINT</th>
                    <th className="font-display" style={{ fontSize: 8 }}>DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['GET', '/api/health', 'Health status, active AI provider, and database state', 'var(--accent)'],
                    ['POST', '/api/auth/login', 'Authenticate operator & return signed JWT bearer token', 'var(--success)'],
                    ['POST', '/api/auth/register', 'Register operator account & provision private team workspace', 'var(--success)'],
                    ['GET', '/api/incidents', 'Fetch recent incidents and operational audit trails', 'var(--accent)'],
                    ['POST', '/api/agents/execute', 'Synchronous 4-agent swarm orchestration endpoint', 'var(--success)'],
                    ['POST', '/api/agents/stream', 'Server-Sent Events (SSE) streaming agent execution log', 'var(--success)'],
                    ['POST', '/api/agents/approve', 'Operator sign-off on awaiting actions (requires Bearer JWT)', 'var(--warning)'],
                    ['POST', '/api/agents/claim', 'Batch adopt local machine / demo incidents into team workspace', 'var(--success)'],
                    ['GET', '/api/agents/runbooks', 'List all loaded Standard Operating Procedure runbooks', 'var(--accent)'],
                    ['POST', '/api/agents/runbooks', 'Upload and index a new custom Markdown SOP runbook', 'var(--success)'],
                    ['POST', '/api/agents/webhook/alert', 'Universal alert ingestion (PagerDuty, Datadog, Prometheus)', 'var(--success)'],
                    ['POST', '/api/webhooks/alerts', 'Direct alias for external alert webhook ingestion', 'var(--success)'],
                  ].map(([method, endpoint, desc, color]) => (
                    <tr key={endpoint as string}>
                      <td className="font-code font-bold" style={{ color: color as string }}>{method}</td>
                      <td className="font-code">{endpoint}</td>
                      <td>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 8: COMPLIANCE & GOVERNANCE */}
          <section id="compliance" className="panel scroll-mt-24">
            <p className="panel-title font-display">8. Compliance, Security & Governance</p>
            <div className="space-y-4 leading-relaxed" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <p>
                In high-stakes enterprise environments (banking, healthcare, critical infrastructure),
                unsupervised AI execution is a severe compliance violation. OmniOps enforces strict
                governance and isolation tiers:
              </p>
              <ul className="list-disc list-inside space-y-2" style={{ fontSize: 13 }}>
                <li>
                  <strong>Deterministic Destructive Command Block:</strong> System interceptors inspect all
                  remediation commands. Keywords like <code className="font-code px-1.5 py-0.5" style={codeBlock}>rm -rf</code>,{' '}
                  <code className="font-code px-1.5 py-0.5" style={codeBlock}>DROP DATABASE</code>, or{' '}
                  <code className="font-code px-1.5 py-0.5" style={codeBlock}>FLUSHALL</code> are unconditionally purged.
                </li>
                <li>
                  <strong>Human-in-the-Loop Sign-Off:</strong> Remediation actions that mutate production
                  state halt in the <code className="font-code px-1.5 py-0.5" style={{ ...codeBlock, backgroundColor: 'var(--warning-soft)', borderColor: 'var(--warning)' }}>AWAITING_APPROVAL</code> state.
                  An authorized operator must sign off via JWT Bearer token or CLI approval command.
                </li>
                <li>
                  <strong>Private Workspace Isolation &amp; Audit Logging:</strong> Every agent step, approving operator identity, and approval timestamp are cryptographically bound to the user's JWT and recorded in the database ledger. Incident trails and metrics are strictly isolated within your private team workspace, preventing cross-tenant leakage.
                </li>
                <li>
                  <strong>Machine-to-Workspace Incident Claiming:</strong> Incidents triaged locally via the CLI prior to signing up or authenticating are tracked in <code className="font-code px-1.5 py-0.5" style={codeBlock}>~/.omniops/history.json</code>. Upon signing up or executing <code className="font-code px-1.5 py-0.5" style={codeBlock}>omniops login</code>, all local machine incidents are automatically adopted and claimed into your private workspace, ensuring uninterrupted audit compliance.
                </li>
              </ul>
            </div>
          </section>

          {/* SECTION 9: CODEBASE KNOWLEDGE GRAPH (AST) */}
          <section id="knowledge-graph" className="panel scroll-mt-24">
            <p className="panel-title font-display">9. Codebase Knowledge Graph (AST Architecture)</p>
            <div className="space-y-4 leading-relaxed" style={{ fontSize: 14, color: 'var(--ink)' }}>
              <p>
                To eliminate AI hallucination during incident triage, 16Bits OmniOps employs static
                Abstract Syntax Tree (AST) extraction and community detection across the backend codebase
                using Graphify.
              </p>

              <div className="p-4 my-3" style={{ backgroundColor: 'var(--bg-inset)', border: '3px solid var(--border)' }}>
                <div className="font-display mb-2" style={{ fontSize: 9 }}>
                  STATIC AST PIPELINE & ARCHITECTURAL CLUSTERING
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ fontSize: 12 }}>
                  <div className="p-3" style={{ border: '2px solid var(--accent)', backgroundColor: 'var(--accent-soft)' }}>
                    <span className="font-bold block mb-1" style={{ fontSize: 13 }}>AST Structural Extraction:</span>
                    <p className="leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
                      Parses TypeScript code into deterministic symbol graphs (functions, imports, class hierarchies)
                      with zero LLM guessing or hallucinations.
                    </p>
                  </div>
                  <div className="p-3" style={{ border: '2px solid var(--purple)', backgroundColor: 'var(--purple-soft)' }}>
                    <span className="font-bold block mb-1" style={{ fontSize: 13 }}>Leiden Community Detection:</span>
                    <p className="leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
                      Partitions code into tightly-coupled modules: Authentication, Database Access,
                      Swarm Orchestration, Guardrails, and Webhook Ingestion.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 font-code" style={{ border: '1px solid var(--border-soft)', backgroundColor: 'var(--bg-inset)', fontSize: 11 }}>
                <span className="font-bold block mb-1">Interactive Graph & Audit Artifacts:</span>
                <span className="block" style={{ color: 'var(--ink-dim)' }}>
                  Artifact directory: <code className="px-1" style={codeBlock}>backend/graphify-out/</code>
                </span>
                <span className="block mt-1" style={{ color: 'var(--ink-dim)' }}>
                  Files: <code className="px-1" style={codeBlock}>graph.html</code> (interactive visual canvas),{' '}
                  <code className="px-1" style={codeBlock}>GRAPH_REPORT.md</code> (architectural god nodes & coupling audit),{' '}
                  <code className="px-1" style={codeBlock}>graph.json</code> (networkx raw data).
                </span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </Shell>
  )
}
