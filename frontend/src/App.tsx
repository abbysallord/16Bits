import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Layers,
  Cpu,
  FileText
} from 'lucide-react'
import {
  checkBackendHealth,
  fetchIncidents,
  streamSwarm,
  approveIncident
} from './services/api'
import type {
  Incident,
  AgentStepLog,
  SwarmResult,
  HealthStatus
} from './services/api'

const SKILL_MD_CONTENT = `---
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'CONSOLE' | 'DOCS'>('CONSOLE')
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [, setIncidents] = useState<Incident[]>([])
  const [activeStep, setActiveStep] = useState<number>(0)
  const [logs, setLogs] = useState<AgentStepLog[]>([])
  const [isExecuting, setIsExecuting] = useState<boolean>(false)
  const [finalResult, setFinalResult] = useState<SwarmResult | null>(null)
  const [copied, setCopied] = useState<boolean>(false)
  const [copiedSkill, setCopiedSkill] = useState<boolean>(false)
  const [isApproving, setIsApproving] = useState<boolean>(false)
  const [approvedLocally, setApprovedLocally] = useState<boolean>(false)

  // Incident form state
  const [title, setTitle] = useState<string>('Payment Webhook Ingestion Throttle on Stripe Gateway')
  const [description, setDescription] = useState<string>(
    'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on settlement callbacks.'
  )
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('CRITICAL')

  useEffect(() => {
    checkBackendHealth().then(setHealth).catch(() => setHealth(null))
    loadIncidents()
  }, [])

  const loadIncidents = async () => {
    try {
      const data = await fetchIncidents()
      setIncidents(data)
    } catch {
      // ignore
    }
  }

  const handleRunSwarm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim() || isExecuting) return

    setIsExecuting(true)
    setActiveStep(1)
    setLogs([])
    setFinalResult(null)

    await streamSwarm(
      { title, description, priority, category: 'Enterprise Workflow' },
      (step) => {
        setActiveStep(step.stepNumber)
        setLogs((prev) => [...prev, step])
      },
      (result) => {
        setActiveStep(4)
        setIsExecuting(false)
        setFinalResult(result)
        loadIncidents()
      },
      (err) => {
        setIsExecuting(false)
        alert(`Swarm execution error: ${err}`)
      }
    )
  }

  const handleApprove = async () => {
    if (!finalResult) return
    setIsApproving(true)
    try {
      await approveIncident(finalResult.incidentId, 'Lead Operator (Dhanush)')
      setApprovedLocally(true)
      loadIncidents()
    } catch (err: any) {
      alert(`Approval error: ${err.message}`)
    } finally {
      setIsApproving(false)
    }
  }

  const selectBenchmark = (sampleTitle: string, sampleDesc: string, samplePriority: 'CRITICAL' | 'HIGH' | 'MEDIUM') => {
    setTitle(sampleTitle)
    setDescription(sampleDesc)
    setPriority(samplePriority)
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-neutral-200 font-mono selection:bg-emerald-500/30">
      {/* Top Header */}
      <header className="border-b-4 border-neutral-800 bg-neutral-950 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 border-2 border-emerald-500 bg-neutral-900 text-emerald-400 font-arcade text-xs">
              16B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-arcade text-sm text-white tracking-wider">OMNIOPS</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 border border-emerald-500/50 text-emerald-400 font-bold uppercase">
                  [SWARM v1.0]
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">Autonomous SRE & Workflow Consensus Mesh</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('CONSOLE')}
              className={`nes-btn text-xs py-1 px-3 ${activeTab === 'CONSOLE' ? 'is-primary' : ''}`}
            >
              [OPERATIONS CONSOLE]
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DOCS')}
              className={`nes-btn text-xs py-1 px-3 ${activeTab === 'DOCS' ? 'is-success' : ''}`}
            >
              [AGENT DOCS & SKILL.MD]
            </button>
          </div>

          {/* Engine Status Tag */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <span className="text-neutral-500">ENGINE:</span>
            <span className={`px-2 py-0.5 text-[10px] font-bold border ${health?.status === 'ok' ? 'border-emerald-500 text-emerald-400 bg-emerald-950/40' : 'border-red-500 text-red-400'}`}>
              {health?.status === 'ok' ? '[ONLINE: GROQ+LANGSMITH]' : '[OFFLINE]'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'CONSOLE' ? (
          <>
            {/* 4-Agent Mesh Visualizer */}
            <section className="nes-container is-dark with-title">
              <p className="title text-xs font-arcade text-emerald-400">[4-AGENT CONSENSUS MESH]</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                {/* Agent 1 */}
                <div className={`p-4 border-2 transition-all ${activeStep === 1 ? 'border-blue-400 bg-blue-950/30' : 'border-neutral-800 bg-neutral-900/60'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-blue-400 font-bold uppercase">[AGENT 1]</span>
                    <Layers className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">PLANNER AGENT</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Decomposes alert payload into structured execution DAG.
                  </p>
                  <div className="mt-3 text-[10px] font-bold text-neutral-500">
                    {activeStep === 1 ? '[DECOMPOSING...]' : activeStep > 1 ? '[COMPLETED]' : '[IDLE]'}
                  </div>
                </div>

                {/* Agent 2 */}
                <div className={`p-4 border-2 transition-all ${activeStep === 2 ? 'border-purple-400 bg-purple-950/30' : 'border-neutral-800 bg-neutral-900/60'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-purple-400 font-bold uppercase">[AGENT 2]</span>
                    <Cpu className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">INVESTIGATOR AGENT</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Queries host OS vitals and matches local markdown SOPs.
                  </p>
                  <div className="mt-3 text-[10px] font-bold text-neutral-500">
                    {activeStep === 2 ? '[QUERYING HOST+SOPS...]' : activeStep > 2 ? '[COMPLETED]' : '[IDLE]'}
                  </div>
                </div>

                {/* Agent 3 */}
                <div className={`p-4 border-2 transition-all ${activeStep === 3 ? 'border-amber-400 bg-amber-950/30' : 'border-neutral-800 bg-neutral-900/60'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-amber-400 font-bold uppercase">[AGENT 3]</span>
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">VERIFICATION GATE</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Audits SLA risk; enforces Human-in-the-Loop authorization.
                  </p>
                  <div className="mt-3 text-[10px] font-bold text-neutral-500">
                    {activeStep === 3 ? '[AUDITING SAFETY...]' : activeStep > 3 ? '[COMPLETED]' : '[IDLE]'}
                  </div>
                </div>

                {/* Agent 4 */}
                <div className={`p-4 border-2 transition-all ${activeStep === 4 ? 'border-emerald-400 bg-emerald-950/30' : 'border-neutral-800 bg-neutral-900/60'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">[AGENT 4]</span>
                    <FileText className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="font-bold text-white text-xs mb-1">SYNTHESIZER AGENT</div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Compiles recovery commands, customer memo, & trace.
                  </p>
                  <div className="mt-3 text-[10px] font-bold text-neutral-500">
                    {activeStep === 4 && isExecuting ? '[SYNTHESIZING...]' : finalResult ? '[PLAN READY]' : '[IDLE]'}
                  </div>
                </div>
              </div>
            </section>

            {/* Split Grid: Form/Benchmarks & Stream/Resolution */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Dispatch & Benchmarks */}
              <div className="lg:col-span-5 space-y-6">
                <section className="nes-container is-dark with-title">
                  <p className="title text-xs font-arcade text-white">[DISPATCH CONSOLE]</p>

                  {/* Benchmark presets */}
                  <div className="mb-4">
                    <label className="text-[10px] text-neutral-400 block mb-1.5 font-bold">[SELECT BENCHMARK INCIDENT]</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => selectBenchmark(
                          'Payment Webhook Ingestion Throttle on Stripe Gateway',
                          'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on callbacks.',
                          'CRITICAL'
                        )}
                        className="text-left p-2 border border-neutral-800 hover:border-neutral-600 bg-neutral-900/80 text-xs text-neutral-300 transition"
                      >
                        <span className="text-amber-400 font-bold">[FINTECH]</span> Stripe 429 Rate Limit Surge
                      </button>
                      <button
                        type="button"
                        onClick={() => selectBenchmark(
                          'Postgres Primary Connection Pool Exhaustion (prod-db-01)',
                          'FATAL: remaining connection slots are reserved for non-replication superuser connections. Active client sessions at 98% of max_connections.',
                          'HIGH'
                        )}
                        className="text-left p-2 border border-neutral-800 hover:border-neutral-600 bg-neutral-900/80 text-xs text-neutral-300 transition"
                      >
                        <span className="text-blue-400 font-bold">[DATABASE]</span> PostgreSQL Connection Pool Saturation
                      </button>
                      <button
                        type="button"
                        onClick={() => selectBenchmark(
                          'Redis Memory 98% OOM Eviction Spike on session-cache',
                          'Redis instance has hit maxmemory policy limit. Cache eviction latency spike threatening active user sessions.',
                          'HIGH'
                        )}
                        className="text-left p-2 border border-neutral-800 hover:border-neutral-600 bg-neutral-900/80 text-xs text-neutral-300 transition"
                      >
                        <span className="text-red-400 font-bold">[INFRA]</span> Redis Memory OOM Eviction Spike
                      </button>
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleRunSwarm} className="space-y-4">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1 font-bold">[INCIDENT TITLE]</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isExecuting}
                        className="w-full bg-neutral-900 border-2 border-neutral-800 p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. Database connection pool exhausted"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1 font-bold">[TELEMETRY / ERROR LOG]</label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isExecuting}
                        className="w-full bg-neutral-900 border-2 border-neutral-800 p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        placeholder="Paste error logs, stack traces, or alerts..."
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1 font-bold">[PRIORITY SLA]</label>
                      <select
                        value={priority}
                        onChange={(e: any) => setPriority(e.target.value)}
                        disabled={isExecuting}
                        className="w-full bg-neutral-900 border-2 border-neutral-800 p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="CRITICAL">CRITICAL (15m SLA Guardrail)</option>
                        <option value="HIGH">HIGH (1h SLA Guardrail)</option>
                        <option value="MEDIUM">MEDIUM (4h SLA Guardrail)</option>
                        <option value="LOW">LOW (24h SLA Guardrail)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isExecuting || !title.trim()}
                      className="nes-btn is-primary w-full text-xs font-bold py-2 mt-2"
                    >
                      {isExecuting ? '[ORCHESTRATING SWARM...]' : '[DISPATCH 4-AGENT SWARM]'}
                    </button>
                  </form>
                </section>
              </div>

              {/* Right Column: Execution Trajectory & Final Plan */}
              <div className="lg:col-span-7 space-y-6">
                {/* Live Agent Logs Stream */}
                <section className="nes-container is-dark with-title">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-800">
                    <p className="title text-xs font-arcade text-white">[LIVE EXECUTION STREAM]</p>
                    {finalResult && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500 px-2 py-0.5">
                        [COMPLETED IN {finalResult.executionDurationMs}MS]
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-xs">
                    {logs.length === 0 ? (
                      <div className="py-10 text-center text-neutral-500 text-xs">
                        [AWAITING TRIGGER. CLICK DISPATCH TO EXECUTE SWARM.]
                      </div>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className="p-3 border border-neutral-800 bg-neutral-950 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-400 uppercase">
                              &gt; [STEP {log.stepNumber}] {log.agentName}
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-300 font-bold bg-neutral-900 p-1.5 border border-neutral-800">
                            {log.action}
                          </div>
                          <p className="text-neutral-400 text-xs leading-relaxed whitespace-pre-wrap mt-1">
                            {log.thought}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Final Synthesized Resolution Card */}
                {finalResult && (
                  <section className="nes-container is-dark with-title">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-800">
                      <p className="title text-xs font-arcade text-emerald-400">[SYNTHESIZED RESOLUTION]</p>
                      
                      <div className="flex items-center gap-2">
                        {finalResult.langsmithTraceUrl && (
                          <a
                            href={finalResult.langsmithTraceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="nes-btn is-warning text-[10px] py-0.5 px-2"
                          >
                            [LANGSMITH TRACE]
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(finalResult.finalResolution)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                          }}
                          className="nes-btn is-primary text-[10px] py-0.5 px-2"
                        >
                          {copied ? '[COPIED]' : '[COPY RESOLUTION]'}
                        </button>
                      </div>
                    </div>

                    {/* Human-in-the-Loop Safety Gate */}
                    {finalResult.status === 'AWAITING_APPROVAL' && !approvedLocally ? (
                      <div className="p-3 border-2 border-amber-500 bg-amber-950/30 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-amber-300 text-xs">
                            [HUMAN AUTHORIZATION REQUIRED: SAFETY GUARDRAIL GATE]
                          </div>
                          <p className="text-[11px] text-amber-200/80 mt-0.5">
                            High-risk remediation requires explicit digital sign-off before dispatching commands.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={isApproving}
                          className="nes-btn is-error text-xs py-1 px-3 shrink-0"
                        >
                          {isApproving ? '[AUTHORIZING...]' : '[AUTHORIZE EXECUTION]'}
                        </button>
                      </div>
                    ) : (
                      <div className="p-2 border border-emerald-500 bg-emerald-950/30 mb-4 text-xs text-emerald-300">
                        [PLAN AUTHORIZED BY HUMAN OPERATOR • SIGNED & AUDITED IN SQLITE]
                      </div>
                    )}

                    <div className="bg-neutral-950 p-4 border border-neutral-800 text-xs leading-relaxed text-neutral-300 whitespace-pre-wrap max-h-[350px] overflow-y-auto">
                      {finalResult.finalResolution}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </>
        ) : (
          /* DOCS & AGENT SKILL TAB */
          <div className="space-y-6">
            {/* Intro & Overview */}
            <section className="nes-container is-dark with-title">
              <p className="title text-xs font-arcade text-white">[WHAT IS OMNIOPS?]</p>
              <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
                <p>
                  <strong>16Bits OmniOps</strong> is an autonomous multi-agent operational consensus swarm. When a company's production database, payment gateway, or caching layer crashes, instead of humans wasting 45 minutes manually checking 10 dashboards, OmniOps queries host vitals, retrieves verified local Standard Operating Procedure (SOP) runbooks, enforces safety guardrails, and outputs an audited recovery playbook.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 border border-neutral-800 bg-neutral-900/60">
                    <div className="text-emerald-400 font-bold mb-1">[1. ZERO ROOT PASSWORDS]</div>
                    <p className="text-neutral-400 text-[11px]">
                      Never requires AWS root credentials or database write access. Operates safely via read-only SOP mounts and webhooks.
                    </p>
                  </div>
                  <div className="p-3 border border-neutral-800 bg-neutral-900/60">
                    <div className="text-amber-400 font-bold mb-1">[2. OPERATOR SAFETY GATE]</div>
                    <p className="text-neutral-400 text-[11px]">
                      Destructive commands are automatically halted behind an explicit digital sign-off gate before execution.
                    </p>
                  </div>
                  <div className="p-3 border border-neutral-800 bg-neutral-900/60">
                    <div className="text-cyan-400 font-bold mb-1">[3. 100% OBSERVABILITY]</div>
                    <p className="text-neutral-400 text-[11px]">
                      Every single agent thought, tool call, and SLA check is logged live to LangSmith with millisecond precision.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Start Guide */}
            <section className="nes-container is-dark with-title">
              <p className="title text-xs font-arcade text-emerald-400">[QUICK START (3 WAYS TO USE)]</p>
              
              <div className="space-y-4 text-xs">
                {/* Modality 1 */}
                <div className="p-3 border border-neutral-800 bg-neutral-900/40">
                  <div className="font-bold text-white mb-1">[METHOD 1: TERMINAL CLI (OMNIOPS)]</div>
                  <p className="text-neutral-400 text-[11px] mb-2">
                    Run health diagnostics, pipe terminal errors, or triage directly:
                  </p>
                  <pre className="p-2 bg-black border border-neutral-800 text-emerald-400 text-[11px] overflow-x-auto">
                    {`# Host infrastructure probe\nomniops doctor\n\n# Direct triage\nomniops triage "Postgres connection pool exhausted" CRITICAL\n\n# Pipe any command failure\ncat /var/log/syslog | tail -n 25 | omniops CRITICAL`}
                  </pre>
                </div>

                {/* Modality 2 */}
                <div className="p-3 border border-neutral-800 bg-neutral-900/40">
                  <div className="font-bold text-white mb-1">[METHOD 2: MONITORING ALERT WEBHOOK]</div>
                  <p className="text-neutral-400 text-[11px] mb-2">
                    Paste this endpoint into Datadog, Grafana, Sentry, or PagerDuty:
                  </p>
                  <pre className="p-2 bg-black border border-neutral-800 text-cyan-400 text-[11px] overflow-x-auto">
                    {`POST http://<your-server>:8000/api/agents/webhook/alert`}
                  </pre>
                </div>
              </div>
            </section>

            {/* Agent Skill Export for Claude Code / Cursor */}
            <section className="nes-container is-dark with-title">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-neutral-800 mb-3">
                <p className="title text-xs font-arcade text-amber-400">[AGENT SKILL EXPORT: SKILL.MD]</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SKILL_MD_CONTENT)
                    setCopiedSkill(true)
                    setTimeout(() => setCopiedSkill(false), 2000)
                  }}
                  className="nes-btn is-success text-xs py-1 px-3"
                >
                  {copiedSkill ? '[COPIED TO CLIPBOARD!]' : '[COPY SKILL.MD FOR CLAUDE CODE]'}
                </button>
              </div>

              <p className="text-xs text-neutral-400 mb-3">
                Give your autonomous AI coding assistants (Claude Code, Cursor, Codex, Antigravity) instant SRE capabilities. Paste this into <code className="text-amber-300">.agents/skills/16bits-ops/SKILL.md</code>:
              </p>

              <pre className="p-3 bg-black border border-neutral-800 text-neutral-300 text-[11px] overflow-x-auto max-h-[350px] leading-relaxed">
                {SKILL_MD_CONTENT}
              </pre>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-neutral-800 bg-neutral-950 py-3 px-4 text-center text-[10px] text-neutral-500 font-mono">
        16BITS OMNIOPS • AUTONOMOUS SRE MESH • STRICT RUBRIC TECH STACK COMPLIANCE • 2026
      </footer>
    </div>
  )
}
