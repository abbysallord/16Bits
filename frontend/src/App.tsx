import React, { useState, useEffect } from 'react'
import {
  Zap,
  Activity,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Terminal,
  Play,
  Layers,
  Search,
  Sparkles,
  ExternalLink,
  Presentation,
  Check,
  Database,
  ArrowRight,
  FileText
} from 'lucide-react'
import {
  checkBackendHealth,
  fetchIncidents,
  streamSwarm,
} from './services/api'
import type {
  Incident,
  AgentStepLog,
  SwarmResult,
  HealthStatus
} from './services/api'

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [, setIncidents] = useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [activeStep, setActiveStep] = useState<number>(0)
  const [logs, setLogs] = useState<AgentStepLog[]>([])
  const [isExecuting, setIsExecuting] = useState<boolean>(false)
  const [finalResult, setFinalResult] = useState<SwarmResult | null>(null)

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
      if (data.length > 0 && !selectedIncident) {
        setSelectedIncident(data[0])
      }
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
  }

  const selectBenchmark = (sampleTitle: string, sampleDesc: string, samplePriority: 'CRITICAL' | 'HIGH' | 'MEDIUM') => {
    setTitle(sampleTitle)
    setDescription(sampleDesc)
    setPriority(samplePriority)
  }

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-emerald-500/30">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg text-white">16Bits OmniOps</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-950/30 text-emerald-400 font-semibold">
                  AGENTIC AI SWARM
                </span>
              </div>
              <p className="text-xs text-neutral-500">Express.js • SQLite • Gemini/Groq • Multi-Agent Pipeline</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border border-neutral-800 bg-neutral-900/60">
              <Database className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-neutral-300">SQLite Active</span>
              <span className="text-neutral-500">•</span>
              <span className="text-emerald-400 font-medium">API: {health?.status === 'ok' ? 'Online (8000)' : 'Offline'}</span>
            </div>

            <a
              href="http://localhost:3030"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 transition"
            >
              <Presentation className="h-3.5 w-3.5 text-emerald-400" />
              <span>Pitch Deck</span>
              <ExternalLink className="h-3 w-3 text-neutral-500" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* 4-Agent Visual State Graph */}
        <section className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Layers className="h-4 w-4 text-emerald-400" />
              <span>Multi-Agent Consensus Pipeline</span>
            </div>
            <span className="text-xs font-mono text-neutral-500">
              Status: {isExecuting ? 'AUTONOMOUS EXECUTION IN PROGRESS' : 'SWARM READY'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Agent 1 */}
            <div className={`p-4 rounded-xl border transition-all ${
              activeStep === 1
                ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
                : activeStep > 1
                ? 'border-neutral-700 bg-neutral-900/80 text-neutral-300'
                : 'border-neutral-800 bg-neutral-950/50 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                  Stage 1
                </span>
                {activeStep > 1 && <Check className="h-4 w-4 text-emerald-400" />}
              </div>
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" /> Planner Agent
              </h4>
              <p className="text-xs text-neutral-400 mt-1">
                Decomposes incident into execution DAG & investigation requirements.
              </p>
            </div>

            {/* Agent 2 */}
            <div className={`p-4 rounded-xl border transition-all ${
              activeStep === 2
                ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
                : activeStep > 2
                ? 'border-neutral-700 bg-neutral-900/80 text-neutral-300'
                : 'border-neutral-800 bg-neutral-950/50 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                  Stage 2
                </span>
                {activeStep > 2 && <Check className="h-4 w-4 text-emerald-400" />}
              </div>
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-purple-400" /> Investigator Agent
              </h4>
              <p className="text-xs text-neutral-400 mt-1">
                Executes telemetry tool queries, SLA checks, and customer profile audit.
              </p>
            </div>

            {/* Agent 3 */}
            <div className={`p-4 rounded-xl border transition-all ${
              activeStep === 3
                ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
                : activeStep > 3
                ? 'border-neutral-700 bg-neutral-900/80 text-neutral-300'
                : 'border-neutral-800 bg-neutral-950/50 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  Stage 3
                </span>
                {activeStep > 3 && <Check className="h-4 w-4 text-emerald-400" />}
              </div>
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Verification Gate
              </h4>
              <p className="text-xs text-neutral-400 mt-1">
                Enforces safety constraints & SLA contract compliance before execution.
              </p>
            </div>

            {/* Agent 4 */}
            <div className={`p-4 rounded-xl border transition-all ${
              activeStep === 4
                ? 'border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-500/20'
                : 'border-neutral-800 bg-neutral-950/50 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  Stage 4
                </span>
                {finalResult && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              </div>
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-400" /> Synthesizer Agent
              </h4>
              <p className="text-xs text-neutral-400 mt-1">
                Generates actionable remediation playbook & stakeholder comms.
              </p>
            </div>
          </div>
        </section>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form & Benchmarks */}
          <div className="lg:col-span-5 space-y-4">
            {/* Quick Benchmark Presets */}
            <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-4">
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 block mb-2 font-semibold">
                Instant Judge Demo Scenarios (1-Click)
              </span>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    selectBenchmark(
                      'Payment Webhook Ingestion Throttle on Stripe Gateway',
                      'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on settlement callbacks.',
                      'CRITICAL'
                    )
                  }
                  className="w-full text-left p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:border-emerald-500/50 transition text-xs group"
                >
                  <div className="flex items-center justify-between font-semibold text-white group-hover:text-emerald-400">
                    <span>1. Stripe Webhook 429 Rate Limit</span>
                    <span className="text-[10px] font-mono text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded">CRITICAL</span>
                  </div>
                  <p className="text-neutral-400 text-[11px] mt-1 line-clamp-1">
                    Queue depth 4,120 items; Platinum enterprise SLA risk.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    selectBenchmark(
                      'Database Read-Replica Replication Lag Exceeding 180s',
                      'Analytics queries are reading stale financial transaction balances due to replication lag spike on PostgreSQL replica cluster.',
                      'HIGH'
                    )
                  }
                  className="w-full text-left p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 hover:border-emerald-500/50 transition text-xs group"
                >
                  <div className="flex items-center justify-between font-semibold text-white group-hover:text-emerald-400">
                    <span>2. PostgreSQL Replication Lag</span>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/30 px-1.5 py-0.5 rounded">HIGH</span>
                  </div>
                  <p className="text-neutral-400 text-[11px] mt-1 line-clamp-1">
                    Lag exceeding 180s; inconsistent financial reporting.
                  </p>
                </button>
              </div>
            </div>

            {/* Incident Trigger Form */}
            <form onSubmit={handleRunSwarm} className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" /> Trigger Autonomous Swarm
              </h3>

              <div>
                <label className="text-xs text-neutral-400 font-mono mb-1 block">INCIDENT TITLE</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isExecuting}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                  placeholder="e.g. Critical Kafka consumer lag spike"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-mono mb-1 block">DESCRIPTION / TELEMETRY</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isExecuting}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-emerald-500 transition leading-relaxed"
                  placeholder="Describe the operational failure or paste error logs..."
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-neutral-400 font-mono mb-1 block">PRIORITY</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    disabled={isExecuting}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CRITICAL">CRITICAL (15m SLA)</option>
                    <option value="HIGH">HIGH (1h SLA)</option>
                    <option value="MEDIUM">MEDIUM (4h SLA)</option>
                    <option value="LOW">LOW (24h SLA)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isExecuting || !title.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
              >
                {isExecuting ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    <span>Orchestrating Swarm Execution...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Dispatch 4-Agent Swarm</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Real-Time Execution Audit Logs & Final Resolution */}
          <div className="lg:col-span-7 space-y-4">
            {/* Live Agent Logs Stream */}
            <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span>Autonomous Agent Execution Stream</span>
                </div>
                {finalResult && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-bold">
                    Resolved in {finalResult.executionDurationMs}ms
                  </span>
                )}
              </div>

              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                {logs.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500 text-xs font-mono">
                    Awaiting trigger. Click "Dispatch 4-Agent Swarm" to observe real-time agent coordination.
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-950/70 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3" /> {log.agentName}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-neutral-300 font-mono text-[11px] bg-neutral-900/60 p-2 rounded border border-neutral-800/60">
                        {log.action}
                      </div>
                      <p className="text-neutral-400 text-xs leading-relaxed whitespace-pre-wrap">
                        {log.thought}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Final Synthesized Resolution Card */}
            {finalResult && (
              <div className="bg-neutral-900/40 border border-emerald-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  <span>Synthesized Resolution & Actionable Plan</span>
                </div>
                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 text-xs leading-relaxed text-neutral-300 whitespace-pre-wrap max-h-[400px] overflow-y-auto font-sans">
                  {finalResult.finalResolution}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
