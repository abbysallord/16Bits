import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import DocsPage from './pages/DocsPage'
import IncidentPage from './pages/IncidentPage'
import DashboardPage from './pages/DashboardPage'
import AgentLabPage from './pages/AgentLabPage'
import AuditPage from './pages/AuditPage'
import SettingsPage from './pages/SettingsPage'
import {
  Activity,
  ShieldCheck,
  Search,
  Sparkles,
  ArrowRight,
  FileText,
  Copy,
  CheckCheck,
  CircleDot,
  AlertTriangle,
} from 'lucide-react'
import {
  fetchIncidents,
  streamSwarm,
  approveIncident,
  UnauthorizedError,
} from './services/api'
import type { Incident, AgentStepLog, SwarmResult } from './services/api'
import { buildSimulation, SCENARIOS, INDUSTRIES } from './services/simulation'
import type { Scenario } from './services/simulation'
import { Shell, useHealth } from './components/Shell'
import { useAuth } from './auth'

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

const AGENTS = [
  {
    stage: 1,
    name: 'PLANNER',
    desc: 'Decomposes incident into an execution DAG + investigation plan.',
    color: 'var(--accent)',
    icon: Sparkles,
  },
  {
    stage: 2,
    name: 'INVESTIGATOR',
    desc: 'Runs telemetry queries, SLA checks, customer profile audits.',
    color: 'var(--purple)',
    icon: Search,
  },
  {
    stage: 3,
    name: 'VERIFIER',
    desc: 'Safety gate: enforces constraints + SLA compliance pre-execution.',
    color: 'var(--warning)',
    icon: ShieldCheck,
  },
  {
    stage: 4,
    name: 'SYNTHESIZER',
    desc: 'Writes the remediation playbook + stakeholder comms.',
    color: 'var(--success)',
    icon: Activity,
  },
] as const

function ConsoleView() {
  const health = useHealth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pending, setPending] = useState<PendingIncident[]>([])

  // scenario filter
  const [industry, setIndustry] = useState('All')

  // trigger form
  const [title, setTitle] = useState(SCENARIOS[0].title)
  const [description, setDescription] = useState(SCENARIOS[0].description)
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(SCENARIOS[0].priority)

  // swarm run
  const [activeStep, setActiveStep] = useState(0)
  const [logs, setLogs] = useState<AgentStepLog[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [finalResult, setFinalResult] = useState<SwarmResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [approvedLocally, setApprovedLocally] = useState(false)
  const [approvedBy, setApprovedBy] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { ensureToken, logout, user } = useAuth()

  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadIncidents()
  }, [user?.id])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const loadIncidents = async () => {
    try {
      const data = await fetchIncidents()
      setIncidents(data)
    } catch {
      setIncidents([])
    }
  }

  const selectScenario = (s: Scenario) => {
    setTitle(s.title)
    setDescription(s.description)
    setPriority(s.priority)
  }

  const handleRunSwarm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim() || isExecuting) return

    setIsExecuting(true)
    setErrorMsg(null)
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
          setErrorMsg(err)
        },
      )
    } else {
      // SKETCH MODE: simulated agent run so the UI is demo-able offline
      const { steps, result, stepDelays, resultDelay } = buildSimulation(title, priority)
      steps.forEach((step, idx) => {
        setTimeout(() => {
          setActiveStep(step.stepNumber)
          setLogs((prev) => [...prev, step])
          if (idx === steps.length - 1) {
            setTimeout(() => {
              setFinalResult(result)
              setIsExecuting(false)
              setPending((prev) =>
                prev.map((p) =>
                  p.title === title ? { ...p, status: 'RESOLVED', resolution: result.finalResolution } : p,
                ),
              )
            }, resultDelay)
          }
        }, stepDelays[idx] || 0)
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
      setErrorMsg(err.message)
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

  const visibleScenarios = SCENARIOS.filter((s) => industry === 'All' || s.industry === industry)

  return (
    <Shell>
      {/* ============ HERO ============ */}
      <section className="max-w-6xl w-full mx-auto px-4 pt-10 pb-8">
        <p className="font-display" style={{ fontSize: 9, color: 'var(--ink-faint)', marginBottom: 12 }}>
          {'> THEME: AGENTIC AI & INTELLIGENT SYSTEMS'}
          <span className="blink">_</span>
        </p>
        <h1 className="font-display leading-relaxed" style={{ fontSize: 'clamp(16px, 3.5vw, 26px)', maxWidth: 900 }}>
          AUTONOMOUS OPS.
          <br />
          <span style={{ color: 'var(--accent)' }}>ZERO MANUAL</span>{' '}
          <span style={{ color: 'var(--success)' }}>COORDINATION.</span>
        </h1>
        <p
          style={{
            marginTop: 16,
            color: 'var(--ink-dim)',
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
          <span className="badge badge-success">[ 2.4s MTTR ]</span>
          <span className="badge badge-warning">[ HUMAN APPROVAL GATE ]</span>
          <span className="badge badge-accent">[ AST CALL GRAPH RAG ]</span>
          <span className="badge badge-purple">[ LANGSMITH TRACED ]</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href="#pipeline" className="btn btn-success font-display btn-sm">
            RUN DEMO SWARM
          </a>
          <Link to="/docs" className="btn font-display btn-sm">
            VIEW DOCS
          </Link>
          <span className="font-code" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            v1.0 · Autonomous 4-Agent Swarm · 9 Demo Scenarios
          </span>
        </div>
      </section>

      {/* ============ PIPELINE ============ */}
      <section id="pipeline" className="max-w-6xl w-full mx-auto px-4 pb-8 scroll-mt-20">
        <div className="panel">
          <p className="panel-title font-display">Multi-Agent Consensus Pipeline</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {AGENTS.map((agent) => {
              const isRunning = isExecuting && activeStep === agent.stage
              const isDone =
                (!isExecuting && activeStep >= agent.stage && (finalResult || activeStep > agent.stage)) ||
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
                      backgroundColor: isRunning ? agent.color : 'var(--ink)',
                      color: isRunning ? 'var(--bg-panel)' : agent.color,
                      border: '3px solid var(--border)',
                      boxShadow: isRunning ? `4px 4px 0 var(--shadow-color)` : undefined,
                      animation: isRunning ? 'nes-blink 0.5s step-end infinite' : undefined,
                    }}
                  >
                    <Icon size={28} strokeWidth={2} />
                  </div>
                  <div className="font-display" style={{ fontSize: 9 }}>
                    STAGE {agent.stage}
                  </div>
                  <div className="font-display" style={{ fontSize: 8, color: agent.color }}>
                    {agent.name}
                    {isRunning && ' [RUNNING]'}
                    {isDone && !isRunning && ' [OK]'}
                  </div>
                  <p className="font-code text-center" style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--ink-dim)' }}>
                    {agent.desc}
                  </p>
                </div>
              )
            })}
          </div>

          {/* pipeline progress bar */}
          <div className="mt-6">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={finalResult ? 4 : activeStep}
              style={{
                height: 14,
                border: '2px solid var(--border)',
                backgroundColor: 'var(--bg-inset)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${finalResult ? 100 : (activeStep / 4) * 100}%`,
                  backgroundColor: finalResult ? 'var(--success)' : 'var(--accent)',
                  backgroundImage: isExecuting
                    ? 'repeating-linear-gradient(45deg, transparent 0 6px, rgba(0,0,0,0.15) 6px 12px)'
                    : undefined,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ WORKSPACE ============ */}
      <section className="max-w-6xl w-full mx-auto px-4 pb-12 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: scenarios + trigger form */}
          <div className="lg:col-span-5 space-y-6">
            {/* scenario library */}
            <div className="panel">
              <p className="panel-title font-display">1-Click Demo Scenarios ({SCENARIOS.length})</p>

              {/* industry filter */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setIndustry(ind)}
                    disabled={isExecuting}
                    className={`btn btn-xs font-code${industry === ind ? ' btn-primary' : ''}`}
                    style={{ fontSize: 8 }}
                  >
                    {ind.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {visibleScenarios.map((s) => {
                  const selected = title === s.title
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => selectScenario(s)}
                      disabled={isExecuting}
                      className="btn w-full text-left panel-flush"
                      style={{
                        fontSize: 10,
                        padding: '8px 10px',
                        fontFamily: "'JetBrains Mono', monospace",
                        borderColor: selected ? 'var(--success)' : 'var(--border-soft)',
                        borderWidth: selected ? 3 : 2,
                      }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-bold">{s.label}</span>
                        <span
                          style={{
                            fontSize: 8,
                            padding: '2px 4px',
                            border: '1px solid var(--border)',
                            backgroundColor: s.priority === 'CRITICAL' ? 'var(--danger)' : s.priority === 'HIGH' ? 'var(--warning)' : 'var(--bg-inset)',
                            color: s.priority === 'CRITICAL' ? 'var(--danger-ink)' : 'var(--ink)',
                            fontWeight: 700,
                          }}
                        >
                          {s.priority}
                        </span>
                      </span>
                      <span className="block" style={{ color: 'var(--ink-dim)', fontSize: 9, marginTop: 4 }}>
                        {s.industry} · {s.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* trigger form */}
            <form onSubmit={handleRunSwarm} className="panel">
              <p className="panel-title font-display">Trigger Swarm</p>

              <div className="mb-3">
                <label htmlFor="inc-title" className="font-code font-bold block mb-1" style={{ fontSize: 10 }}>
                  INCIDENT_TITLE
                </label>
                <input
                  id="inc-title"
                  type="text"
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isExecuting}
                  placeholder="e.g. Kafka consumer lag spike"
                  style={{ fontSize: 11 }}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="inc-desc" className="font-code font-bold block mb-1" style={{ fontSize: 10 }}>
                  DESCRIPTION / TELEMETRY
                </label>
                <textarea
                  id="inc-desc"
                  className="textarea"
                  rows={8}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isExecuting}
                  placeholder="Describe the failure or paste logs..."
                  style={{ fontSize: 10 }}
                />
              </div>

              <div className="mb-4">
                <span className="font-code font-bold block mb-1" style={{ fontSize: 10 }}>
                  PRIORITY
                </span>
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                  <label key={p} className="radio-row">
                    <input
                      type="radio"
                      name="priority"
                      checked={priority === p}
                      onChange={() => setPriority(p)}
                      disabled={isExecuting}
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                disabled={isExecuting || !title.trim()}
                className={`btn w-full font-display${isExecuting ? '' : ' btn-primary'}`}
                style={{ fontSize: 9, padding: '10px 8px' }}
              >
                {isExecuting ? 'ORCHESTRATING...' : 'DISPATCH 4-AGENT SWARM'}
              </button>

              {errorMsg && (
                <div
                  className="mt-3 font-code flex items-start gap-2"
                  style={{
                    border: '2px solid var(--danger)',
                    backgroundColor: 'var(--danger-soft)',
                    padding: 10,
                    fontSize: 10,
                    color: 'var(--ink)',
                  }}
                  role="alert"
                >
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ wordBreak: 'break-word' }}>{errorMsg}</span>
                </div>
              )}
            </form>
          </div>

          {/* RIGHT: logs + resolution */}
          <div className="lg:col-span-7 space-y-6">
            {/* execution stream */}
            <div className="panel" style={{ backgroundColor: 'var(--bg-panel)' }}>
              <p className="panel-title font-display" style={{ color: 'var(--console-green)' }}>
                <Activity size={11} className="inline mr-1 -mt-0.5" />
                Agent Execution Stream
              </p>

              <div ref={logRef} className="console" style={{ maxHeight: 340 }}>
                {logs.length === 0 ? (
                  <div style={{ color: 'var(--console-faint)' }}>
                    {'> awaiting trigger...'}
                    <br />
                    {'> click "DISPATCH 4-AGENT SWARM" to observe real-time agent coordination.'}
                    <br />
                    <span className="blink">{'> _'}</span>

                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: 12 }}>
                      <div style={{ color: 'var(--console-green)' }}>
                        <ArrowRight size={9} className="inline mr-1" />
                        [{new Date(log.timestamp).toLocaleTimeString()}] {log.agentName}
                      </div>
                      <div style={{ color: 'var(--console-blue)' }}>&gt; action: {log.action}</div>
                      <div style={{ color: 'var(--console-purple)', whiteSpace: 'pre-wrap' }}>&gt; thought: {log.thought}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* resolution */}
            {finalResult && (
              <div className="panel">
                <p className="panel-title font-display">
                  <FileText size={11} className="inline mr-1 -mt-0.5" />
                  Synthesized Resolution
                </p>

                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="font-code" style={{ fontSize: 10, color: 'var(--ink-dim)' }}>
                    Resolved in {finalResult.executionDurationMs}ms · {finalResult.status}
                  </span>
                  <button type="button" onClick={copyResult} className="btn btn-xs font-code" style={{ fontSize: 9 }}>
                    {copied ? (
                      <>
                        <CheckCheck size={10} className="inline mr-1" style={{ color: 'var(--success)' }} />
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
                    style={{ border: '3px solid var(--warning)', backgroundColor: 'var(--warning-soft)' }}
                  >
                    <div className="font-display" style={{ fontSize: 9, color: 'var(--ink)' }}>
                      <ShieldCheck size={12} className="inline mr-1" />
                      HUMAN AUTHORIZATION REQUIRED
                    </div>
                    <p className="font-code mt-1" style={{ fontSize: 10, color: 'var(--ink-dim)' }}>
                      Remediation involves infrastructure changes. Compliance policy requires operator
                      sign-off before dispatching commands.
                    </p>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="btn btn-warning btn-xs font-display mt-2"
                      style={{ fontSize: 8 }}
                    >
                      {isApproving ? 'AUTHORIZING...' : 'AUTHORIZE EXECUTION →'}
                    </button>
                  </div>
                ) : (
                  <div
                    className="p-2 mb-3 font-code"
                    style={{ border: '2px solid var(--success)', backgroundColor: 'var(--success-soft)', fontSize: 10 }}
                  >
                    <CircleDot size={10} className="inline mr-1" style={{ color: 'var(--success)' }} />
                    {approvedBy
                      ? `Remediation authorized by ${approvedBy} · committed to audit trail`
                      : 'Remediation authorized by human operator · committed to audit trail'}
                  </div>
                )}

                <div
                  className="font-code overflow-y-auto"
                  style={{
                    backgroundColor: 'var(--bg-inset)',
                    border: '2px solid var(--border)',
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
            <div className="panel">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <p className="panel-title font-display" style={{ position: 'static', padding: 0, maxWidth: 'none' }}>
                  Incident Queue ({Math.min(pending.length + incidents.length, 6)})
                </p>
                {(pending.length > 0 || incidents.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPending([])
                      setIncidents([])
                    }}
                    className="btn btn-xs btn-ghost font-code"
                    style={{ fontSize: 9 }}
                  >
                    [CLEAR QUEUE]
                  </button>
                )}
              </div>
              {pending.length === 0 && incidents.length === 0 ? (
                <p className="font-code" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                  Queue empty. Select a demo scenario above or trigger a custom alert to dispatch the swarm.
                </p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th className="font-display" style={{ fontSize: 8 }}>TITLE</th>
                      <th className="font-display" style={{ fontSize: 8 }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...pending, ...incidents.filter((inc) => !pending.some((p) => p.title === inc.title))]
                      .slice(0, 6)
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="font-code" style={{ fontSize: 10 }}>
                            {item.id.startsWith('local-') ? (
                              item.title
                            ) : (
                              <Link to={`/incidents/${item.id}`} className="link" style={{ color: 'var(--ink)' }}>
                                {item.title}
                              </Link>
                            )}
                          </td>
                          <td
                            className="font-code"
                            style={{
                              fontSize: 10,
                              color: item.status === 'RESOLVED' ? 'var(--success)' : 'var(--warning)',
                            }}
                          >
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
    </Shell>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/agents" element={<AgentLabPage />} />
      <Route path="/audit" element={<AuditPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/incidents/:id" element={<IncidentPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<ConsoleView />} />
    </Routes>
  )
}
