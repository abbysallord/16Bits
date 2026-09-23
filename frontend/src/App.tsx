import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import DocsPage from './pages/DocsPage'
import IncidentPage from './pages/IncidentPage'
import SettingsPage from './pages/SettingsPage'
import {
  Zap,
  Activity,
  ShieldCheck,
  Clock,
  Terminal,
  Search,
  Sparkles,
  ArrowRight,
  FileText,
  Copy,
  CheckCheck,
  CircleDot,
} from 'lucide-react'
import {
  checkBackendHealth,
  fetchIncidents,
  streamSwarm,
  approveIncident,
  UnauthorizedError,
} from './services/api'
import { useAuth, AuthBadge } from './auth'
import type {
  Incident,
  AgentStepLog,
  SwarmResult,
  HealthStatus,
} from './services/api'
import { buildSimulation } from './services/simulation'

// ---------------------------------------------------------------------------
// Local sketch state (DB-less so the UI is demo-able before backend exists)
// ---------------------------------------------------------------------------

interface PendingIncident {
  id: string
  title: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'PENDING' | 'ANALYZING' | 'RESOLVED'
  resolution?: string
}

const SAMPLES: Array<{
  key: string
  label: string
  title: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}> = [
  {
    key: '1',
    label: 'STRIPE WEBHOOK 429',
    title: 'Payment Webhook Ingestion Throttle on Stripe Gateway',
    description:
      'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on settlement callbacks.',
    priority: 'CRITICAL',
  },
  {
    key: '2',
    label: 'PG REPLICA LAG',
    title: 'Database Read-Replica Replication Lag Exceeding 180s',
    description:
      'Analytics queries are reading stale financial transaction balances due to replication lag spike on PostgreSQL replica cluster.',
    priority: 'HIGH',
  },
  {
    key: '3',
    label: 'ICU TELEMETRY DROP',
    title: 'ICU Cardiac Telemetry Pipeline WebSocket Drop',
    description:
      'Hospital central monitoring hub dropped real-time ECG telemetry stream from 48 bedside cardiac monitors across Ward 3.',
    priority: 'CRITICAL',
  },
]

const AGENTS = [
  {
    stage: 1,
    name: 'PLANNER',
    desc: 'Decomposes incident into an execution DAG + investigation plan.',
    color: '#209cee',
    icon: Sparkles,
  },
  {
    stage: 2,
    name: 'INVESTIGATOR',
    desc: 'Runs telemetry queries, SLA checks, customer profile audits.',
    color: '#ad8bc9',
    icon: Search,
  },
  {
    stage: 3,
    name: 'VERIFIER',
    desc: 'Safety gate: enforces constraints + SLA compliance pre-execution.',
    color: '#f7d51d',
    icon: ShieldCheck,
  },
  {
    stage: 4,
    name: 'SYNTHESIZER',
    desc: 'Writes the remediation playbook + stakeholder comms.',
    color: '#92cc41',
    icon: Activity,
  },
] as const

function ConsoleView() {
  // backend health + incidents (real API when available)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pending, setPending] = useState<PendingIncident[]>([])

  // trigger form
  const [title, setTitle] = useState(SAMPLES[0].title)
  const [description, setDescription] = useState(SAMPLES[0].description)
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('CRITICAL')

  // swarm run
  const [activeStep, setActiveStep] = useState(0)
  const [logs, setLogs] = useState<AgentStepLog[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [finalResult, setFinalResult] = useState<SwarmResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [approvedLocally, setApprovedLocally] = useState(false)
  const [approvedBy, setApprovedBy] = useState<string | null>(null)
  const { ensureToken, logout, user } = useAuth()

  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkBackendHealth().then(setHealth).catch(() => setHealth(null))
    loadIncidents()
  }, [user?.id])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const loadIncidents = async () => {
    try {
      const data = await fetchIncidents()
      const BANNED = ['fuck', 'shit', 'bitch', 'ass', 'boy', 'friend', 'dating', 'sex']
      const clean = data.filter((inc) => {
        const text = (inc.title + ' ' + (inc.description || '')).toLowerCase()
        return !BANNED.some((b) => text.includes(b)) && (inc.title || '').trim().length >= 8
      })
      setIncidents(clean)
    } catch {
      setIncidents([])
    }
  }

  const selectSample = (s: (typeof SAMPLES)[number]) => {
    setTitle(s.title)
    setDescription(s.description)
    setPriority(s.priority)
  }

  const handleRunSwarm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim() || isExecuting) return

    setIsExecuting(true)
    setActiveStep(1)
    setLogs([])
    setFinalResult(null)
    setApprovedLocally(false)
    setApprovedBy(null)
    setPending((prev) => [
      ...prev.filter((p) => p.title !== title),
      {
        id: `local-${Date.now()}`,
        title,
        description,
        priority,
        status: 'ANALYZING',
      },
    ])

    const hasBackend = health?.status === 'ok'

    if (hasBackend) {
      await streamSwarm(
        { title, description, priority, category: 'Fintech Operations' },
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
    } else {
      // SKETCH MODE: simulated agent run so the UI is demo-able offline
      const { steps, result } = buildSimulation(title, priority)
      let t = 0
      steps.forEach((step, idx) => {
        t += idx === 0 ? 300 : 1600
        setTimeout(() => {
          setActiveStep(step.stepNumber)
          setLogs((prev) => [...prev, step])
          if (idx === steps.length - 1) {
            setTimeout(() => {
              setFinalResult(result)
              setIsExecuting(false)
              setPending((prev) =>
                prev.map((p) =>
                  p.title === title ? { ...p, status: 'RESOLVED', resolution: result.finalResolution } : p
                )
              )
            }, 900)
          }
        }, t)
      })
    }
  }

  const handleApprove = async () => {
    if (!finalResult) return
    setIsApproving(true)
    try {
      if (health?.status === 'ok') {
        // Approval is signed with the operator's JWT; opens the sign-in dialog if needed
        let token = await ensureToken()
        if (!token) return
        try {
          const res = await approveIncident(finalResult.incidentId, token)
          setApprovedBy(res.authorizedBy)
        } catch (err) {
          if (!(err instanceof UnauthorizedError)) throw err
          // Session expired or server secret rotated: sign in again and retry once
          logout()
          token = await ensureToken()
          if (!token) return
          const res = await approveIncident(finalResult.incidentId, token)
          setApprovedBy(res.authorizedBy)
        }
      }
      setApprovedLocally(true)
    } catch (err: any) {
      alert(`Approval error: ${err.message}`)
    } finally {
      setIsApproving(false)
    }
  }

  const copyResult = () => {
    if (!finalResult) return
    navigator.clipboard.writeText(finalResult.finalResolution)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8f8f8' }}>
      {/* ============ HEADER ============ */}
      <header
        className="sticky top-0 z-50"
        style={{
          backgroundColor: '#f8f8f8',
          borderBottom: '4px solid #212529',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center justify-center"
              style={{
                width: 40,
                height: 40,
                backgroundColor: '#212529',
                color: '#92cc41',
                boxShadow: '4px 4px 0px rgba(0,0,0,0.4)',
                textDecoration: 'none',
              }}
            >
              <Zap size={22} strokeWidth={2.5} />
            </Link>
            <div>
              <Link to="/" style={{ textDecoration: 'none', color: '#212529' }}>
                <span className="font-arcade" style={{ fontSize: 13, fontWeight: 'bold' }}>
                  16Bits OmniOps
                </span>
              </Link>
              <div
                className="font-code text-neutral-600 hidden sm:block"
                style={{ fontSize: 10, marginTop: 2 }}
              >
                AGENTIC AI SWARM · MULTI-AGENT INCIDENT RESPONSE
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="nes-btn is-primary nes-btn-xs font-arcade"
              style={{ textDecoration: 'none', fontSize: 9 }}
            >
              CONSOLE
            </Link>
            <Link
              to="/docs"
              className="nes-btn nes-btn-xs font-arcade"
              style={{ textDecoration: 'none', fontSize: 9 }}
            >
              DOCS
            </Link>
            <a
              href="https://www.npmjs.com/package/omniops"
              target="_blank"
              rel="noreferrer"
              className="nes-btn is-warning nes-btn-xs font-arcade"
              style={{ textDecoration: 'none', fontSize: 9 }}
            >
              NPM: omniops@1.0.3
            </a>
            <AuthBadge />
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="max-w-6xl w-full mx-auto px-4 pt-10 pb-8">
        <p className="font-arcade text-neutral-500" style={{ fontSize: 9, marginBottom: 12 }}>
          {'> THEME: AGENTIC AI & INTELLIGENT SYSTEMS'}
          <span className="blink">_</span>
        </p>
        <h1
          className="font-arcade leading-relaxed"
          style={{ fontSize: 'clamp(16px, 3.5vw, 26px)', maxWidth: 900 }}
        >
          AUTONOMOUS OPS.
          <br />
          <span style={{ color: '#209cee' }}>ZERO MANUAL</span>{' '}
          <span style={{ color: '#92cc41' }}>COORDINATION.</span>
        </h1>
        <p
          className="mt-4 text-neutral-800 leading-relaxed font-sans"
          style={{
            fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
            fontSize: 'clamp(15px, 1.8vw, 17px)',
            maxWidth: 680,
            lineHeight: 1.6,
          }}
        >
          Autonomous incident triage and remediation swarm for mission-critical infrastructure.
          Four collaborative agents investigate root causes, query telemetry, and propose
          verified fixes in seconds, with a signed-in human approving every high-risk plan.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className="font-code text-xs px-2.5 py-1"
            style={{
              border: '2px solid #212529',
              backgroundColor: '#e6f9d8',
              color: '#212529',
              fontWeight: 700,
            }}
          >
            [ 2.4s MTTR ]
          </span>
          <span
            className="font-code text-xs px-2.5 py-1"
            style={{
              border: '2px solid #212529',
              backgroundColor: '#fef3c7',
              color: '#212529',
              fontWeight: 700,
            }}
          >
            [ HUMAN APPROVAL GATE ]
          </span>
          <span
            className="font-code text-xs px-2.5 py-1"
            style={{
              border: '2px solid #212529',
              backgroundColor: '#dbeafe',
              color: '#212529',
              fontWeight: 700,
            }}
          >
            [ AST CALL GRAPH RAG ]
          </span>
          <span
            className="font-code text-xs px-2.5 py-1"
            style={{
              border: '2px solid #212529',
              backgroundColor: '#f3e8ff',
              color: '#212529',
              fontWeight: 700,
            }}
          >
            [ LANGSMITH TRACED ]
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href="#pipeline" className="nes-btn is-success font-arcade nes-btn-sm">
            RUN DEMO SWARM
          </a>
          <Link to="/docs" className="nes-btn font-arcade nes-btn-sm">
            VIEW DOCS
          </Link>
          <span className="font-code text-neutral-500" style={{ fontSize: 11 }}>
            v1.0 · Autonomous 4-Agent Swarm · Live Production
          </span>
        </div>
      </section>

            {/* ============ PIPELINE ============ */}
            <section id="pipeline" className="max-w-6xl w-full mx-auto px-4 pb-8 scroll-mt-20">
              <div className="nes-container with-title is-centered" style={{ backgroundColor: '#fff' }}>
                <p className="title font-arcade" style={{ fontSize: 10 }}>
                  Multi-Agent Consensus Pipeline
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {AGENTS.map((agent) => {
                    const isRunning = isExecuting && activeStep === agent.stage
                    const isDone = (!isExecuting && activeStep >= agent.stage && (finalResult || activeStep > agent.stage)) ||
                      (!isExecuting && !!finalResult)
                    const Icon = agent.icon
                    return (
                      <div
                        key={agent.stage}
                        className="flex flex-col items-center gap-2"
                        style={{ opacity: !isRunning && !isDone && activeStep === 0 ? 0.45 : 1 }}
                      >
                        <div
                          className="flex items-center justify-center"
                          style={{
                            width: 64,
                            height: 64,
                            backgroundColor: isRunning ? agent.color : '#212529',
                            color: isRunning ? '#212529' : agent.color,
                            border: '3px solid #212529',
                            boxShadow: isRunning ? `4px 4px 0px ${agent.color}` : '4px 4px 0px rgba(0,0,0,0.3)',
                            animation: isRunning ? 'nes-blink 0.5s step-end infinite' : undefined,
                          }}
                        >
                          <Icon size={28} strokeWidth={2} />
                        </div>
                        <div className="font-arcade" style={{ fontSize: 9 }}>
                          STAGE {agent.stage}
                        </div>
                        <div className="font-arcade" style={{ fontSize: 8, color: agent.color }}>
                          {agent.name}
                          {isRunning && ' [RUNNING]'}
                          {isDone && !isRunning && ' [OK]'}
                        </div>
                        <p className="font-code text-neutral-600 text-center" style={{ fontSize: 10, lineHeight: 1.5 }}>
                          {agent.desc}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* pipeline progress bar */}
                <div className="mt-6 flex justify-center">
                  <progress
                    className={`nes-progress ${isExecuting ? 'is-pattern' : finalResult ? 'is-success' : ''}`}
                    value={finalResult ? 100 : activeStep}
                    max={4}
                    style={{ width: '80%', height: 18 }}
                  />
                </div>
              </div>
            </section>

            {/* ============ WORKSPACE ============ */}
            <section className="max-w-6xl w-full mx-auto px-4 pb-12 flex-1 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT: samples + trigger form */}
                <div className="lg:col-span-5 space-y-6">
                  {/* sample scenarios */}
                  <div className="nes-container with-title" style={{ backgroundColor: '#fff' }}>
                    <p className="title font-arcade" style={{ fontSize: 9 }}>
                      1-Click Demo Scenarios
                    </p>
                    <div className="space-y-2">
                      {SAMPLES.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => selectSample(s)}
                          disabled={isExecuting}
                          className="nes-btn w-full text-left"
                          style={{
                            fontSize: 10,
                            padding: '8px 10px',
                            fontFamily: "'JetBrains Mono', monospace",
                            borderColor: title === s.title ? '#92cc41' : undefined,
                            borderWidth: title === s.title ? 3 : 1,
                          }}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-bold">{s.label}</span>
                            <span
                              style={{
                                fontSize: 8,
                                padding: '2px 4px',
                                border: '1px solid #212529',
                                backgroundColor:
                                  s.priority === 'CRITICAL' ? '#f44336' : '#f7d51d',
                                color: s.priority === 'CRITICAL' ? '#fff' : '#212529',
                              }}
                            >
                              {s.priority}
                            </span>
                          </span>
                          <span className="block text-neutral-600 mt-1" style={{ fontSize: 9 }}>
                            {s.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* trigger form */}
                  <form
                    onSubmit={handleRunSwarm}
                    className="nes-container with-title"
                    style={{ backgroundColor: '#fff' }}
                  >
                    <p className="title font-arcade" style={{ fontSize: 9 }}>
                      <Terminal size={11} className="inline mr-1 -mt-1" />
                      Trigger Swarm
                    </p>

                    <div className="nes-field mb-3">
                      <label className="font-code font-bold" style={{ fontSize: 10 }}>
                        INCIDENT_TITLE
                      </label>
                      <input
                        type="text"
                        className="nes-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isExecuting}
                        placeholder="e.g. Kafka consumer lag spike"
                        style={{ fontSize: 11 }}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="font-code font-bold" style={{ fontSize: 10 }}>
                        DESCRIPTION / TELEMETRY
                      </label>
                      <textarea
                        className="nes-textarea"
                        rows={8}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isExecuting}
                        placeholder="Describe the failure or paste logs..."
                        style={{ fontSize: 10 }}
                      />
                    </div>

                    <div className="mb-4">
                      <label className="font-code font-bold block mb-1" style={{ fontSize: 10 }}>
                        PRIORITY
                      </label>
                      {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', fontSize: 10 }}>
                          <input
                            type="radio"
                            className="nes-radio"
                            name="priority"
                            checked={priority === p}
                            onChange={() => setPriority(p)}
                            disabled={isExecuting}
                            style={{ marginRight: 6 }}
                          />
                          <span className="font-code">{p}</span>
                        </label>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={isExecuting || !title.trim()}
                      className={`nes-btn ${isExecuting ? 'is-disabled' : 'is-primary'} w-full font-arcade`}
                      style={{ fontSize: 9, padding: '10px 8px' }}
                    >
                      {isExecuting ? 'ORCHESTRATING...' : 'DISPATCH 4-AGENT SWARM'}
                    </button>
                  </form>
                </div>

                {/* RIGHT: logs + resolution */}
                <div className="lg:col-span-7 space-y-6">
                  {/* execution stream */}
                  <div className="nes-container with-title" style={{ backgroundColor: '#212529' }}>
                    <p className="title font-arcade" style={{ fontSize: 9, color: '#92cc41' }}>
                      <Activity size={11} className="inline mr-1 -mt-1" />
                      Agent Execution Stream
                    </p>

                    <div
                      ref={logRef}
                      className="overflow-y-auto font-code"
                      style={{
                        maxHeight: 340,
                        backgroundColor: '#0f0f0f',
                        padding: 12,
                        border: '2px solid #212529',
                        fontSize: 10,
                        lineHeight: 1.6,
                        color: '#c5e1a5',
                      }}
                    >
                      {logs.length === 0 ? (
                        <div style={{ color: '#666' }}>
                          {'> awaiting trigger...'}
                          <br />
                          {'> click "DISPATCH 4-AGENT SWARM" to observe real-time agent coordination.'}
                          <br />
                          <span className="blink">{'> _'}</span>
                        </div>
                      ) : (
                        logs.map((log, idx) => (
                          <div key={idx} style={{ marginBottom: 12 }}>
                            <div style={{ color: '#92cc41' }}>
                              <ArrowRight size={9} className="inline mr-1" />
                              [{new Date(log.timestamp).toLocaleTimeString()}] {log.agentName}
                            </div>
                            <div style={{ color: '#209cee' }}>&gt; action: {log.action}</div>
                            <div style={{ color: '#ad8bc9', whiteSpace: 'pre-wrap' }}>
                              &gt; thought: {log.thought}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* resolution */}
                  {finalResult && (
                    <div className="nes-container with-title" style={{ backgroundColor: '#fff' }}>
                      <p className="title font-arcade" style={{ fontSize: 9 }}>
                        <FileText size={11} className="inline mr-1 -mt-1" />
                        Synthesized Resolution
                      </p>

                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <span className="font-code text-neutral-600" style={{ fontSize: 10 }}>
                          Resolved in {finalResult.executionDurationMs}ms · {finalResult.status}
                        </span>
                        <button
                          type="button"
                          onClick={copyResult}
                          className="nes-btn nes-btn-xs font-code"
                          style={{ fontSize: 9 }}
                        >
                          {copied ? (
                            <>
                              <CheckCheck size={10} className="inline mr-1" style={{ color: '#92cc41' }} />
                              COPIED
                            </>
                          ) : (
                            <>
                              <Copy size={10} className="inline mr-1" />
                              COPY FIX
                            </>
                          )}
                        </button>
                      </div>

                      {/* human approval gate */}
                      {finalResult.status === 'AWAITING_APPROVAL' && !approvedLocally ? (
                        <div
                          className="p-3 mb-3"
                          style={{ border: '3px solid #f7d51d', backgroundColor: '#fdf6d8' }}
                        >
                          <div className="font-arcade" style={{ fontSize: 9, color: '#8a7500' }}>
                            <ShieldCheck size={12} className="inline mr-1" />
                            HUMAN AUTHORIZATION REQUIRED
                          </div>
                          <p className="font-code mt-1" style={{ fontSize: 10, color: '#5c5000' }}>
                            Remediation involves infrastructure changes. Compliance policy requires
                            operator sign-off before dispatching commands.
                          </p>
                          <button
                            type="button"
                            onClick={handleApprove}
                            disabled={isApproving}
                            className="nes-btn is-warning nes-btn-xs font-arcade mt-2"
                            style={{ fontSize: 8 }}
                          >
                            {isApproving ? 'AUTHORIZING...' : 'AUTHORIZE EXECUTION →'}
                          </button>
                        </div>
                      ) : (
                        <div
                          className="p-2 mb-3 font-code"
                          style={{ border: '2px solid #92cc41', backgroundColor: '#e6f9d8', fontSize: 10 }}
                        >
                          <CircleDot size={10} className="inline mr-1" style={{ color: '#92cc41' }} />
                          {approvedBy
                            ? `Remediation authorized by ${approvedBy} · committed to audit trail`
                            : 'Remediation authorized by human operator · committed to audit trail'}
                        </div>
                      )}

                      <div
                        className="font-code overflow-y-auto"
                        style={{
                          backgroundColor: '#f8f8f8',
                          border: '2px solid #212529',
                          padding: 12,
                          fontSize: 11,
                          lineHeight: 1.6,
                          maxHeight: 400,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {finalResult.finalResolution}
                      </div>
                    </div>
                  )}

                  {/* incident queue */}
                  <div className="nes-container with-title" style={{ backgroundColor: '#fff' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="title font-arcade" style={{ fontSize: 9 }}>
                        Incident Queue ({Math.min(pending.length + incidents.length, 6)})
                      </p>
                      {(pending.length > 0 || incidents.length > 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            setPending([])
                            setIncidents([])
                          }}
                          className="font-code text-xs px-2 py-0.5 border border-neutral-300 hover:bg-neutral-100 text-neutral-600 cursor-pointer"
                          style={{ fontSize: 9 }}
                        >
                          [CLEAR QUEUE]
                        </button>
                      )}
                    </div>
                    {pending.length === 0 && incidents.length === 0 ? (
                      <p className="font-code text-neutral-500" style={{ fontSize: 10 }}>
                        Queue empty. Select a demo scenario above or trigger a custom alert to dispatch the swarm.
                      </p>
                    ) : (
                      <table className="nes-table is-bordered is-centered w-full">
                        <thead>
                          <tr>
                            <th className="font-arcade" style={{ fontSize: 8 }}>TITLE</th>
                            <th className="font-arcade" style={{ fontSize: 8 }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ...pending,
                            ...incidents.filter((inc) => !pending.some((p) => p.title === inc.title)),
                          ].slice(0, 6).map((item) => (
                            <tr key={item.id}>
                              <td className="font-code text-left" style={{ fontSize: 10 }}>
                                {item.id.startsWith('local-') ? item.title : (
                                  <Link to={`/incidents/${item.id}`} style={{ color: '#212529' }}>{item.title}</Link>
                                )}
                              </td>
                              <td className="font-code" style={{ fontSize: 10, color: item.status === 'RESOLVED' ? '#92cc41' : '#f7d51d' }}>
                                {item.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ============ FOOTER ============ */}
            <footer
              style={{
                borderTop: '4px solid #212529',
                backgroundColor: '#212529',
                color: '#e7e7e7',
              }}
            >
              <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="font-arcade" style={{ fontSize: 9, color: '#92cc41', marginBottom: 10 }}>
                    STACK
                  </div>
                  <ul className="font-code" style={{ fontSize: 10, lineHeight: 2 }}>
                    <li>- React 19 + Vite</li>
                    <li>- React Router</li>
                    <li>- Express.js + JWT (Active)</li>
                    <li>- {health?.database?.startsWith('Postgres') ? 'Postgres (Active)' : 'SQLite WAL Mode (Active)'}</li>
                    <li>- LangSmith Tracing (Active)</li>
                    <li>- npm: omniops@1.0.3</li>
                  </ul>
                </div>
                <div>
                  <div className="font-arcade" style={{ fontSize: 9, color: '#209cee', marginBottom: 10 }}>
                    AGENT ROLES
                  </div>
                  <ul className="font-code" style={{ fontSize: 10, lineHeight: 2 }}>
                    <li>- Planner: decompose & plan</li>
                    <li>- Investigator: gather telemetry</li>
                    <li>- Verifier: safety gate</li>
                    <li>- Synthesizer: resolution & comms</li>
                  </ul>
                </div>
                <div>
                  <div className="font-arcade" style={{ fontSize: 9, color: '#f7d51d', marginBottom: 10 }}>
                    HUMAN-IN-THE-LOOP
                  </div>
                  <ul className="font-code" style={{ fontSize: 10, lineHeight: 2 }}>
                    <li>- Approval gate on infra mutations</li>
                    <li>- Signed audit trail</li>
                    <li>- SLA priority tiers</li>
                    <li>- Slack webhook alerts</li>
                  </ul>
                </div>
              </div>
              <div className="text-center pb-4 font-code" style={{ fontSize: 9, color: '#888' }}>
                16Bits OmniOps · Theme: Agentic AI & Intelligent Systems · Production Release 1.0.0
                <Clock size={9} className="inline ml-1" />
              </div>
            </footer>
          </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/incidents/:id" element={<IncidentPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<ConsoleView />} />
    </Routes>
  )
}
