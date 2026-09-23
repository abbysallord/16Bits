import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  checkBackendHealth,
  fetchIncidents,
  streamSwarm,
  approveIncident,
  getCurrentUser
} from '../services/api'
import type {
  Incident,
  AgentStepLog,
  SwarmResult,
  HealthStatus,
  User
} from '../services/api'

export const ConsolePage: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [activeStep, setActiveStep] = useState<number>(0)
  const [logs, setLogs] = useState<AgentStepLog[]>([])
  const [isExecuting, setIsExecuting] = useState<boolean>(false)
  const [finalResult, setFinalResult] = useState<SwarmResult | null>(null)
  const [copied, setCopied] = useState<boolean>(false)
  const [isApproving, setIsApproving] = useState<boolean>(false)
  const [approvedLocally, setApprovedLocally] = useState<boolean>(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Incident form state
  const [title, setTitle] = useState<string>('Payment Webhook Ingestion Throttle on Stripe Gateway')
  const [description, setDescription] = useState<string>(
    'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on settlement callbacks, risking SLA breach for Platinum Enterprise clients.'
  )
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('CRITICAL')

  useEffect(() => {
    checkBackendHealth().then(setHealth).catch(() => setHealth(null))
    loadIncidents()
    setCurrentUser(getCurrentUser())
  }, [])

  const loadIncidents = async () => {
    try {
      const data = await fetchIncidents()
      setIncidents(data)
    } catch {
      // ignore
    }
  }

  const handleBenchmarkSelect = (type: 'PAYMENT' | 'POSTGRES' | 'REDIS') => {
    if (type === 'PAYMENT') {
      setTitle('Payment Webhook Ingestion Throttle on Stripe Gateway')
      setDescription(
        'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on settlement callbacks, risking SLA breach for Platinum Enterprise clients.'
      )
      setPriority('CRITICAL')
    } else if (type === 'POSTGRES') {
      setTitle('PostgreSQL Connection Pool Exhaustion on Primary DB')
      setDescription(
        'FATAL: remaining connection slots are reserved for non-replication superuser connections. 250 active pool connections exhausted by zombie background workers.'
      )
      setPriority('CRITICAL')
    } else if (type === 'REDIS') {
      setTitle('Redis Cache Cluster Memory OOM & Eviction Cascade')
      setDescription(
        'OOM command not allowed when used memory > maxmemory on Redis node redis-prod-02. Cache miss cascade causing 504 gateway timeouts on catalog service.'
      )
      setPriority('HIGH')
    }
  }

  const handleRunSwarm = async () => {
    setIsExecuting(true)
    setLogs([])
    setFinalResult(null)
    setActiveStep(1)
    setApprovedLocally(false)

    await streamSwarm(
      {
        title,
        description,
        priority,
        category: 'Enterprise Production Incident'
      },
      (step: AgentStepLog) => {
        setLogs((prev) => [...prev, step])
        setActiveStep(step.stepNumber + 1)
      },
      (result: SwarmResult) => {
        setFinalResult(result)
        setIsExecuting(false)
        setActiveStep(5)
        loadIncidents()
      },
      (error: string) => {
        setIsExecuting(false)
        alert(`Swarm execution halted: ${error}`)
      }
    )
  }

  const handleApprove = async () => {
    if (!finalResult?.incidentId) return
    setIsApproving(true)
    try {
      const operatorName = currentUser
        ? `${currentUser.name} (${currentUser.email})`
        : 'Lead Operator (Dhanush)'
      await approveIncident(finalResult.incidentId, operatorName)
      setApprovedLocally(true)
      loadIncidents()
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`)
    } finally {
      setIsApproving(false)
    }
  }

  const copyResolution = () => {
    if (finalResult?.finalResolution) {
      navigator.clipboard.writeText(finalResult.finalResolution)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-8 py-6 px-4 max-w-7xl mx-auto">
      {/* Mock Engine Warning Banner (Feedback Item #2) */}
      {health?.is_mock && (
        <div className="bg-amber-100 border-4 border-black p-4 shadow-[4px_4px_0_0_#000] flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 font-mono text-xs text-amber-900 font-bold">
            <span className="bg-black text-amber-300 px-2 py-0.5 font-press-start text-[10px]">
              [NOTICE]
            </span>
            <span>
              RUNNING IN MOCK ENGINE MODE: Add <code>GEMINI_API_KEY</code> or <code>GROQ_API_KEY</code> to your backend <code>.env</code> for live neural model inference.
            </span>
          </div>
          <span className="font-mono text-[10px] text-amber-800 uppercase font-bold border border-black bg-amber-200 px-2 py-0.5">
            Deterministic Engine V1.0
          </span>
        </div>
      )}

      {/* Breadcrumb / Top Bar */}
      <div className="flex items-center justify-between gap-4 border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <Link to="/" className="font-mono text-xs text-neutral-600 hover:text-black">
            HOME
          </Link>
          <span className="font-mono text-xs text-neutral-400">/</span>
          <span className="font-mono text-xs font-bold text-black">SWARM CONSOLE</span>
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <span className="font-mono text-xs bg-emerald-100 border border-black px-2 py-1 text-emerald-900 font-bold">
              [OPERATOR: {currentUser.name}]
            </span>
          ) : (
            <Link
              to="/login"
              className="font-mono text-xs bg-neutral-100 border border-black px-2 py-1 text-neutral-700 hover:bg-neutral-200 font-bold"
            >
              [NOT LOGGED IN - CLICK TO AUTHENTICATE]
            </Link>
          )}
        </div>
      </div>

      {/* Main Console Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Benchmark Dispatch & Incident Configuration */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Preset Benchmark Buttons */}
          <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0_0_#000]">
            <div className="border-b-2 border-black pb-2 mb-3">
              <span className="font-press-start text-xs text-black">BENCHMARK SCENARIOS</span>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleBenchmarkSelect('PAYMENT')}
                className="w-full text-left p-2.5 font-mono text-xs font-bold border-2 border-black bg-neutral-50 hover:bg-neutral-100 active:translate-y-0.5"
              >
                [SCENARIO 1]: Stripe Webhook 429 Throttle
              </button>
              <button
                type="button"
                onClick={() => handleBenchmarkSelect('POSTGRES')}
                className="w-full text-left p-2.5 font-mono text-xs font-bold border-2 border-black bg-neutral-50 hover:bg-neutral-100 active:translate-y-0.5"
              >
                [SCENARIO 2]: Postgres Connection Pool Exhaustion
              </button>
              <button
                type="button"
                onClick={() => handleBenchmarkSelect('REDIS')}
                className="w-full text-left p-2.5 font-mono text-xs font-bold border-2 border-black bg-neutral-50 hover:bg-neutral-100 active:translate-y-0.5"
              >
                [SCENARIO 3]: Redis Cache OOM Cascade
              </button>
            </div>
          </div>

          {/* Incident Input Form */}
          <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0_0_#000] flex flex-col gap-4">
            <div className="border-b-2 border-black pb-2 flex items-center justify-between">
              <span className="font-press-start text-xs text-black">INCIDENT TELEMETRY</span>
              <span className="font-mono text-[10px] text-neutral-500 font-bold">[RAW LOG INPUT]</span>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-black mb-1">
                INCIDENT TITLE:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 font-mono text-xs border-2 border-black bg-[#f8fafc] text-black focus:outline-none focus:border-[#3b82f6]"
              />
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-black mb-1">
                RAW SYSTEM LOGS / ERROR TRACE:
              </label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2.5 font-mono text-xs border-2 border-black bg-[#f8fafc] text-black focus:outline-none focus:border-[#3b82f6]"
              />
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-black mb-1">
                INCIDENT SEVERITY:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full p-2.5 font-mono text-xs border-2 border-black bg-[#f8fafc] text-black focus:outline-none focus:border-[#3b82f6]"
              >
                <option value="CRITICAL">CRITICAL (15m Response Target)</option>
                <option value="HIGH">HIGH (1h Response Target)</option>
                <option value="MEDIUM">MEDIUM (4h Target)</option>
                <option value="LOW">LOW (24h Target)</option>
              </select>
            </div>

            <button
              type="button"
              disabled={isExecuting}
              onClick={handleRunSwarm}
              className="mt-2 py-3.5 font-mono text-xs font-bold bg-[#3b82f6] text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:bg-blue-600 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {isExecuting ? '[SWARM RUNNING...]' : '[TRIGGER AUTONOMOUS SWARM]'}
            </button>
          </div>

          {/* Recent Audit Incidents */}
          <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0_0_#000]">
            <div className="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
              <span className="font-press-start text-xs text-black">RECENT AUDIT LOG</span>
              <span className="font-mono text-[10px] text-neutral-500 font-bold">{incidents.length} Records</span>
            </div>
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {incidents.slice(0, 5).map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incident/${inc.id}`}
                  className="p-2 border-2 border-black bg-[#f8fafc] hover:bg-neutral-100 flex flex-col gap-1 text-black no-underline"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold truncate max-w-[200px]">
                      {inc.title}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 border border-black font-bold ${
                        inc.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-900'
                          : inc.status === 'AWAITING_APPROVAL'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-blue-100 text-blue-900'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-neutral-500">
                    ID: {inc.id.slice(0, 8)}... // {inc.priority}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 4-Agent Trajectory, Stream & Playbook */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* 4-Agent Visual Step Trajectory */}
          <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0_0_#000]">
            <div className="border-b-2 border-black pb-2 mb-4 flex items-center justify-between">
              <span className="font-press-start text-xs text-black">4-AGENT SWARM TRAJECTORY</span>
              <span className="font-mono text-[10px] text-neutral-500 font-bold">
                {activeStep > 0 ? `STAGE ${activeStep} OF 4` : 'STANDBY'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Agent 1 */}
              <div
                className={`border-2 border-black p-2.5 text-center flex flex-col items-center gap-1.5 transition-all ${
                  activeStep === 1
                    ? 'bg-blue-100 border-[#3b82f6]'
                    : activeStep > 1
                    ? 'bg-emerald-50'
                    : 'bg-neutral-50'
                }`}
              >
                <img src="/assets/agent-planner.svg" alt="Planner" className="w-8 h-8 rendering-pixelated" />
                <span className="font-press-start text-[9px] text-black">PLANNER</span>
                <span className="font-mono text-[9px] text-neutral-600 font-bold">DAG Execution</span>
              </div>

              {/* Agent 2 */}
              <div
                className={`border-2 border-black p-2.5 text-center flex flex-col items-center gap-1.5 transition-all ${
                  activeStep === 2
                    ? 'bg-blue-100 border-[#3b82f6]'
                    : activeStep > 2
                    ? 'bg-emerald-50'
                    : 'bg-neutral-50'
                }`}
              >
                <img src="/assets/agent-investigator.svg" alt="Investigator" className="w-8 h-8 rendering-pixelated" />
                <span className="font-press-start text-[9px] text-black">INVESTIGATOR</span>
                <span className="font-mono text-[9px] text-neutral-600 font-bold">Host Telemetry</span>
              </div>

              {/* Agent 3 */}
              <div
                className={`border-2 border-black p-2.5 text-center flex flex-col items-center gap-1.5 transition-all ${
                  activeStep === 3
                    ? 'bg-blue-100 border-[#3b82f6]'
                    : activeStep > 3
                    ? 'bg-emerald-50'
                    : 'bg-neutral-50'
                }`}
              >
                <img src="/assets/agent-verifier.svg" alt="Verifier" className="w-8 h-8 rendering-pixelated" />
                <span className="font-press-start text-[9px] text-black">VERIFIER</span>
                <span className="font-mono text-[9px] text-neutral-600 font-bold">SLA &amp; Safety Gate</span>
              </div>

              {/* Agent 4 */}
              <div
                className={`border-2 border-black p-2.5 text-center flex flex-col items-center gap-1.5 transition-all ${
                  activeStep === 4
                    ? 'bg-blue-100 border-[#3b82f6]'
                    : activeStep > 4
                    ? 'bg-emerald-50'
                    : 'bg-neutral-50'
                }`}
              >
                <img src="/assets/agent-synthesizer.svg" alt="Synthesizer" className="w-8 h-8 rendering-pixelated" />
                <span className="font-press-start text-[9px] text-black">SYNTHESIZER</span>
                <span className="font-mono text-[9px] text-neutral-600 font-bold">Fix Playbook</span>
              </div>
            </div>
          </div>

          {/* Real-Time Live Logs Terminal */}
          <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0_0_#000]">
            <div className="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
              <span className="font-press-start text-xs text-black">CONSENSUS STREAM LOGS</span>
              <span className="font-mono text-[10px] text-neutral-500 font-bold">
                {logs.length} Steps Recorded
              </span>
            </div>

            <div className="bg-[#f8fafc] border-2 border-black p-3 font-mono text-xs text-neutral-800 max-h-72 overflow-y-auto flex flex-col gap-2">
              {logs.length === 0 ? (
                <div className="text-neutral-400 py-6 text-center">
                  [SYSTEM STANDBY]: Click 'Trigger Autonomous Swarm' to initiate 4-agent consensus stream.
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="border-b border-neutral-200 pb-2">
                    <div className="flex items-center gap-2 font-bold text-black">
                      <span className="bg-black text-white px-1.5 py-0.5 text-[10px]">
                        STEP {log.stepNumber}
                      </span>
                      <span className="text-[#3b82f6]">{log.agentName}:</span>
                      <span className="text-[10px] text-neutral-500 font-normal ml-auto">
                        {log.timestamp.slice(11, 19)}
                      </span>
                    </div>
                    <div className="mt-1 text-neutral-700 pl-2 border-l-2 border-neutral-300">
                      {log.thought}
                    </div>
                    <div className="mt-1 font-bold text-[11px] text-neutral-900 pl-2">
                      &gt; Action: {log.action}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Verifier Human-in-the-Loop Authorization Gate */}
          {finalResult && (finalResult.status === 'AWAITING_APPROVAL' || finalResult.requiresApproval) && !approvedLocally && (
            <div className="border-4 border-black bg-amber-50 p-5 shadow-[6px_6px_0_0_#000] flex flex-col gap-3">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <span className="font-press-start text-xs text-amber-900">
                  HUMAN OPERATOR AUTHORIZATION REQUIRED
                </span>
                <span className="font-mono text-[10px] bg-amber-200 border border-black px-2 py-0.5 font-bold">
                  [SAFETY GATE ACTIVE]
                </span>
              </div>
              <p className="font-mono text-xs text-neutral-800">
                The Verifier Gate detected high-risk execution commands. In accordance with enterprise
                SLA policies, automated execution is halted until an authenticated operator signs the remediation plan.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={handleApprove}
                  className="px-5 py-2.5 font-mono text-xs font-bold bg-emerald-500 text-black border-2 border-black shadow-[3px_3px_0_0_#000] hover:bg-emerald-400 active:translate-y-1 active:shadow-none disabled:opacity-50"
                >
                  {isApproving ? '[AUTHORIZING...]' : '[AUTHORIZE REMEDIATION PLAYBOOK]'}
                </button>
                <span className="font-mono text-[11px] text-neutral-600">
                  Signing as: <strong>{currentUser ? currentUser.name : 'Lead Operator (Dhanush)'}</strong>
                </span>
              </div>
            </div>
          )}

          {approvedLocally && (
            <div className="border-4 border-black bg-emerald-100 p-4 shadow-[4px_4px_0_0_#000] font-mono text-xs text-emerald-900 font-bold">
              [OPERATOR AUTHORIZED]: Remediation plan signed and dispatched to production cluster. Status updated to RESOLVED.
            </div>
          )}

          {/* Final Synthesized Playbook (Light Themed Container) */}
          {finalResult && (
            <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0_0_#000] flex flex-col gap-3">
              <div className="border-b-2 border-black pb-2 flex items-center justify-between flex-wrap gap-2">
                <span className="font-press-start text-xs text-black">SYNTHESIZED PLAYBOOK</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyResolution}
                    className="px-3 py-1 font-mono text-xs font-bold border-2 border-black bg-neutral-100 hover:bg-neutral-200"
                  >
                    {copied ? '[COPIED!]' : '[COPY PLAYBOOK]'}
                  </button>
                  {finalResult.langsmithTraceUrl && (
                    <a
                      href={finalResult.langsmithTraceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 font-mono text-xs font-bold border-2 border-black bg-blue-100 text-blue-900 hover:bg-blue-200 no-underline"
                    >
                      [VIEW LANGSMITH TRACE]
                    </a>
                  )}
                </div>
              </div>

              {/* Clean Light-Themed Monospace Markdown Box (NO pitch black) */}
              <div className="bg-[#f8fafc] border-2 border-black p-4 font-mono text-xs text-neutral-900 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {finalResult.finalResolution}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
