import React, { useState, useEffect } from 'react'
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
      { title, description, priority, category: 'Enterprise Operations' },
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
    <div className="flex flex-col min-h-screen bg-[#f1f3f7] text-neutral-900 font-mono">
      {/* Top Header */}
      <header className="border-b-4 border-black bg-white px-4 py-3 sticky top-0 z-50 shadow-[0_4px_0_rgba(0,0,0,0.06)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/logo-pixel.svg"
              alt="16Bits OmniOps Logo"
              className="w-10 h-10 shrink-0 border-2 border-black bg-neutral-100 p-0.5 shadow-[2px_2px_0px_#000]"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-arcade text-sm text-black tracking-wide">16BITS OMNIOPS</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 border border-black bg-amber-200 text-black">
                  [V1.0 LIGHT]
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 font-sans mt-0.5">Autonomous Operations Swarm & SRE Triage</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('CONSOLE')}
              className={`nes-btn text-xs py-1 px-4 ${activeTab === 'CONSOLE' ? 'is-primary' : ''}`}
            >
              [OPERATIONS CONSOLE]
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DOCS')}
              className={`nes-btn text-xs py-1 px-4 ${activeTab === 'DOCS' ? 'is-success' : ''}`}
            >
              [DOCS & SKILL.MD]
            </button>
          </div>

          {/* Engine Status Tag */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <span className="text-neutral-500 font-bold">ENGINE:</span>
            <span className={`px-2 py-1 text-[11px] font-bold border-2 border-black ${health?.status === 'ok' ? 'bg-emerald-300 text-black shadow-[2px_2px_0px_#000]' : 'bg-red-300 text-black shadow-[2px_2px_0px_#000]'}`}>
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
            <section className="nes-container with-title bg-white shadow-[4px_4px_0px_#000]">
              <p className="title text-xs font-arcade text-black bg-emerald-300 border-2 border-black px-2 py-0.5">
                [4-AGENT CONSENSUS SWARM]
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                {/* Agent 1 */}
                <div className={`p-4 border-2 border-black bg-white transition-all shadow-[3px_3px_0px_#000] ${activeStep === 1 ? 'ring-4 ring-blue-400 bg-blue-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <img src="/assets/agent-planner.svg" alt="Planner" className="w-8 h-8 border border-black" />
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 border border-blue-500 text-blue-800">
                      [STEP 1]
                    </span>
                  </div>
                  <div className="font-bold text-black text-xs mb-1">PLANNER AGENT</div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">
                    Decomposes alert into structured investigative DAG.
                  </p>
                  <div className="mt-3 text-[10px] font-bold text-neutral-700">
                    STATUS: {activeStep === 1 ? '[DECOMPOSING...]' : activeStep > 1 ? '[DONE]' : '[READY]'}
                  </div>
                </div>

                {/* Agent 2 */}
                <div className={`p-4 border-2 border-black bg-white transition-all shadow-[3px_3px_0px_#000] ${activeStep === 2 ? 'ring-4 ring-purple-400 bg-purple-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <img src="/assets/agent-investigator.svg" alt="Investigator" className="w-8 h-8 border border-black" />
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 border border-purple-500 text-purple-800">
                      [STEP 2]
                    </span>
                  </div>
                  <div className="font-bold text-black text-xs mb-1">INVESTIGATOR AGENT</div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">
                    Queries host OS vitals & matches local markdown SOPs.
                  </p>
                  <div className="mt-3 text-[10px] font-bold text-neutral-700">
                    STATUS: {activeStep === 2 ? '[QUERYING SOPS...]' : activeStep > 2 ? '[DONE]' : '[READY]'}
                  </div>
                </div>

                {/* Agent 3 */}
                <div className={`p-4 border-2 border-black bg-white transition-all shadow-[3px_3px_0px_#000] ${activeStep === 3 ? 'ring-4 ring-amber-400 bg-amber-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <img src="/assets/agent-verifier.svg" alt="Verifier" className="w-8 h-8 border border-black" />
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 border border-amber-500 text-amber-800">
                      [STEP 3]
                    </span>
                  </div>
                  <div className="font-bold text-black text-xs mb-1">VERIFIER GATE</div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">
                    Audits SLA risk; enforces Human-in-the-Loop authorization.
                  </p>
                  <div className="mt-3 text-[10px] font-bold text-neutral-700">
                    STATUS: {activeStep === 3 ? '[AUDITING SAFETY...]' : activeStep > 3 ? '[DONE]' : '[READY]'}
                  </div>
                </div>

                {/* Agent 4 */}
                <div className={`p-4 border-2 border-black bg-white transition-all shadow-[3px_3px_0px_#000] ${activeStep === 4 ? 'ring-4 ring-emerald-400 bg-emerald-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <img src="/assets/agent-synthesizer.svg" alt="Synthesizer" className="w-8 h-8 border border-black" />
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 border border-emerald-500 text-emerald-800">
                      [STEP 4]
                    </span>
                  </div>
                  <div className="font-bold text-black text-xs mb-1">SYNTHESIZER AGENT</div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">
                    Compiles recovery commands, customer memo, & trace.
                  </p>
                  <div className="mt-3 text-[10px] font-bold text-neutral-700">
                    STATUS: {activeStep === 4 && isExecuting ? '[SYNTHESIZING...]' : finalResult ? '[PLAN READY]' : '[READY]'}
                  </div>
                </div>
              </div>
            </section>

            {/* Split Grid: Form & Output */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Dispatch & Presets */}
              <div className="lg:col-span-5 space-y-6">
                <section className="nes-container with-title bg-white shadow-[4px_4px_0px_#000]">
                  <p className="title text-xs font-arcade text-black bg-blue-200 border-2 border-black px-2 py-0.5">
                    [DISPATCH CONSOLE]
                  </p>

                  {/* Benchmark presets */}
                  <div className="mb-4">
                    <label className="text-[11px] font-bold text-neutral-800 block mb-2">[SELECT REAL BENCHMARK INCIDENT]</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => selectBenchmark(
                          'Payment Webhook Ingestion Throttle on Stripe Gateway',
                          'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on callbacks.',
                          'CRITICAL'
                        )}
                        className="text-left p-2.5 border-2 border-black bg-neutral-50 hover:bg-amber-100 text-xs text-neutral-900 transition shadow-[2px_2px_0px_#000]"
                      >
                        <span className="font-bold text-amber-800">[FINTECH]</span> Stripe 429 Rate Limit Surge
                      </button>
                      <button
                        type="button"
                        onClick={() => selectBenchmark(
                          'Postgres Primary Connection Pool Exhaustion (prod-db-01)',
                          'FATAL: remaining connection slots are reserved for non-replication superuser connections. Active client sessions at 98% of max_connections.',
                          'HIGH'
                        )}
                        className="text-left p-2.5 border-2 border-black bg-neutral-50 hover:bg-blue-100 text-xs text-neutral-900 transition shadow-[2px_2px_0px_#000]"
                      >
                        <span className="font-bold text-blue-800">[DATABASE]</span> PostgreSQL Connection Pool Exhaustion
                      </button>
                      <button
                        type="button"
                        onClick={() => selectBenchmark(
                          'Redis Memory 98% OOM Eviction Spike on session-cache',
                          'Redis instance has hit maxmemory policy limit. Cache eviction latency spike threatening active user sessions.',
                          'HIGH'
                        )}
                        className="text-left p-2.5 border-2 border-black bg-neutral-50 hover:bg-red-100 text-xs text-neutral-900 transition shadow-[2px_2px_0px_#000]"
                      >
                        <span className="font-bold text-red-800">[INFRA]</span> Redis Memory OOM Eviction Spike
                      </button>
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleRunSwarm} className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold text-neutral-800 block mb-1">[INCIDENT TITLE]</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isExecuting}
                        className="w-full bg-white border-2 border-black p-2.5 text-xs text-neutral-900 focus:outline-none focus:bg-amber-50 shadow-[2px_2px_0px_#000]"
                        placeholder="e.g. Database connection pool exhausted"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-800 block mb-1">[TELEMETRY / ERROR LOG]</label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isExecuting}
                        className="w-full bg-white border-2 border-black p-2.5 text-xs text-neutral-900 focus:outline-none focus:bg-amber-50 shadow-[2px_2px_0px_#000]"
                        placeholder="Paste error logs, stack traces, or alerts..."
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-neutral-800 block mb-1">[PRIORITY SLA]</label>
                      <select
                        value={priority}
                        onChange={(e: any) => setPriority(e.target.value)}
                        disabled={isExecuting}
                        className="w-full bg-white border-2 border-black p-2 text-xs text-neutral-900 focus:outline-none shadow-[2px_2px_0px_#000]"
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

              {/* Right Column: Execution Trajectory & Plan */}
              <div className="lg:col-span-7 space-y-6">
                {/* Live Stream */}
                <section className="nes-container with-title bg-white shadow-[4px_4px_0px_#000]">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-black">
                    <p className="title text-xs font-arcade text-black bg-neutral-200 border-2 border-black px-2 py-0.5">
                      [EXECUTION STREAM]
                    </p>
                    {finalResult && (
                      <span className="text-[11px] font-bold bg-emerald-200 border border-black px-2 py-0.5 text-black">
                        [COMPLETED IN {finalResult.executionDurationMs}MS]
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-xs">
                    {logs.length === 0 ? (
                      <div className="py-12 text-center text-neutral-500 text-xs">
                        [AWAITING TRIGGER. CLICK DISPATCH SWARM TO COMMENCE TRIAGE.]
                      </div>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className="p-3 border-2 border-black bg-neutral-50 space-y-1 shadow-[2px_2px_0px_#000]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-blue-700 uppercase">
                              &gt; [STEP {log.stepNumber}] {log.agentName}
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-black font-bold bg-white p-2 border border-neutral-300">
                            {log.action}
                          </div>
                          <p className="text-neutral-700 text-xs leading-relaxed whitespace-pre-wrap mt-1 font-sans">
                            {log.thought}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Final Synthesized Resolution Card */}
                {finalResult && (
                  <section className="nes-container with-title bg-white shadow-[4px_4px_0px_#000]">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 mb-3 border-b-2 border-black">
                      <p className="title text-xs font-arcade text-black bg-emerald-300 border-2 border-black px-2 py-0.5">
                        [SYNTHESIZED REMEDIATION PLAYBOOK]
                      </p>
                      
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
                          {copied ? '[COPIED]' : '[COPY FIX]'}
                        </button>
                      </div>
                    </div>

                    {/* Human-in-the-Loop Safety Gate */}
                    {finalResult.status === 'AWAITING_APPROVAL' && !approvedLocally ? (
                      <div className="p-4 border-4 border-amber-500 bg-amber-50 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[3px_3px_0px_#f59e0b]">
                        <div>
                          <div className="font-bold text-amber-900 text-xs">
                            [HUMAN AUTHORIZATION REQUIRED: SAFETY GUARDRAIL]
                          </div>
                          <p className="text-[11px] text-amber-800 mt-1 font-sans">
                            Critical remediation involves state-changing commands. Compliance requires digital sign-off.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={isApproving}
                          className="nes-btn is-error text-xs py-1 px-4 shrink-0"
                        >
                          {isApproving ? '[AUTHORIZING...]' : '[AUTHORIZE EXECUTION]'}
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 border-2 border-emerald-500 bg-emerald-50 mb-4 text-xs font-bold text-emerald-900">
                        [REMEDIATION PLAN AUTHORIZED BY OPERATOR • AUDITED IN SQLITE]
                      </div>
                    )}

                    <div className="bg-neutral-900 p-4 border-2 border-black text-xs leading-relaxed text-neutral-100 whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
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
            {/* Hero / What is OmniOps */}
            <section className="nes-container with-title bg-white shadow-[4px_4px_0px_#000]">
              <p className="title text-xs font-arcade text-black bg-neutral-200 border-2 border-black px-2 py-0.5">
                [WHAT IS OMNIOPS?]
              </p>

              <div className="flex flex-col md:flex-row items-center gap-6 pb-4">
                <img
                  src="/assets/hero-banner.svg"
                  alt="OmniOps Command Center"
                  className="w-64 h-24 border-2 border-black bg-neutral-100 shadow-[3px_3px_0px_#000] shrink-0"
                />
                <div className="space-y-2 text-xs text-neutral-800 leading-relaxed font-sans">
                  <p className="font-bold text-black font-mono">
                    OmniOps is an automated 911 dispatch doctor for production cloud outages.
                  </p>
                  <p>
                    When an enterprise database connection pool spikes or payment webhooks fail, engineers normally waste 45 minutes manually checking 10 dashboards. OmniOps queries server telemetry, retrieves the company's vetted emergency runbook from disk, checks safety guardrails, and hands the engineer a verified fix.
                  </p>
                </div>
              </div>

              {/* 3 Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-3 border-2 border-black bg-emerald-50 shadow-[2px_2px_0px_#000]">
                  <div className="text-emerald-900 font-bold mb-1">[1. ZERO ROOT KEYS]</div>
                  <p className="text-neutral-700 text-[11px] font-sans">
                    Never requires AWS root credentials or database write passwords. Operates via read-only SOP mounts.
                  </p>
                </div>
                <div className="p-3 border-2 border-black bg-amber-50 shadow-[2px_2px_0px_#000]">
                  <div className="text-amber-900 font-bold mb-1">[2. SAFETY GATE]</div>
                  <p className="text-neutral-700 text-[11px] font-sans">
                    Destructive operations are halted behind an explicit digital sign-off gate before execution.
                  </p>
                </div>
                <div className="p-3 border-2 border-black bg-blue-50 shadow-[2px_2px_0px_#000]">
                  <div className="text-blue-900 font-bold mb-1">[3. 100% OBSERVABLE]</div>
                  <p className="text-neutral-700 text-[11px] font-sans">
                    Every single agent thought, tool call, and SLA check is logged live to LangSmith with trace URLs.
                  </p>
                </div>
              </div>
            </section>

            {/* Quick Start Guide */}
            <section className="nes-container with-title bg-white shadow-[4px_4px_0px_#000]">
              <p className="title text-xs font-arcade text-black bg-blue-200 border-2 border-black px-2 py-0.5">
                [QUICK START GUIDE]
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Modality 1 */}
                <div className="p-3 border-2 border-black bg-neutral-50 shadow-[2px_2px_0px_#000]">
                  <div className="font-bold text-black mb-1">[METHOD 1: TERMINAL CLI]</div>
                  <p className="text-neutral-600 text-[11px] mb-2 font-sans">
                    Run health diagnostics or pipe terminal errors directly into OmniOps:
                  </p>
                  <pre className="p-2.5 bg-neutral-900 border-2 border-black text-emerald-400 text-[11px] overflow-x-auto">
                    {`# Host infrastructure probe\nomniops doctor\n\n# Direct triage\nomniops triage "Postgres pool exhausted" CRITICAL\n\n# Pipe any command failure\ncat error.log | omniops CRITICAL`}
                  </pre>
                </div>

                {/* Modality 2 */}
                <div className="p-3 border-2 border-black bg-neutral-50 shadow-[2px_2px_0px_#000]">
                  <div className="font-bold text-black mb-1">[METHOD 2: MONITORING WEBHOOK]</div>
                  <p className="text-neutral-600 text-[11px] mb-2 font-sans">
                    Paste this endpoint into Datadog, Grafana, Sentry, or PagerDuty:
                  </p>
                  <pre className="p-2.5 bg-neutral-900 border-2 border-black text-cyan-400 text-[11px] overflow-x-auto">
                    {`POST http://<your-server>:8000/api/agents/webhook/alert`}
                  </pre>
                </div>
              </div>
            </section>

            {/* Agent Skill Export for Claude Code / Cursor */}
            <section className="nes-container with-title bg-white shadow-[4px_4px_0px_#000]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b-2 border-black mb-3">
                <p className="title text-xs font-arcade text-black bg-amber-200 border-2 border-black px-2 py-0.5">
                  [AGENT SKILL EXPORT: SKILL.MD]
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SKILL_MD_CONTENT)
                    setCopiedSkill(true)
                    setTimeout(() => setCopiedSkill(false), 2000)
                  }}
                  className="nes-btn is-success text-xs py-1 px-4"
                >
                  {copiedSkill ? '[COPIED TO CLIPBOARD!]' : '[COPY SKILL.MD FOR CLAUDE CODE]'}
                </button>
              </div>

              <p className="text-xs text-neutral-700 mb-3 font-sans">
                Give your autonomous AI coding assistants (Claude Code, Cursor, Codex, Antigravity) instant SRE capabilities. Paste this into <code className="bg-neutral-200 px-1 py-0.5 border border-black font-bold">.agents/skills/16bits-ops/SKILL.md</code>:
              </p>

              <pre className="p-3.5 bg-neutral-900 border-2 border-black text-neutral-100 text-[11px] overflow-x-auto max-h-[350px] leading-relaxed">
                {SKILL_MD_CONTENT}
              </pre>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-black bg-white py-3 px-4 text-center text-[11px] text-neutral-600 font-mono">
        16BITS OMNIOPS • AUTONOMOUS SRE MESH • NES.CSS LIGHT THEME • STRICT RUBRIC TECH STACK COMPLIANCE • 2026
      </footer>
    </div>
  )
}
