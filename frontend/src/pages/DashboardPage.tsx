import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Zap, ShieldCheck, Timer } from 'lucide-react'
import { fetchIncidents } from '../services/api'
import type { Incident } from '../services/api'
import { SCENARIOS } from '../services/simulation'
import { Shell, useHealth } from '../components/Shell'

/** Ops metrics dashboard: KPIs, priority mix donut, resolution trend sparkline. */

interface Kpi {
  label: string
  value: string
  sub: string
  color: string
  icon: typeof Zap
}

function useOpsMetrics() {
  const health = useHealth()
  const [incidents, setIncidents] = useState<Incident[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchIncidents()
        if (!cancelled) setIncidents(data)
      } catch {
        if (!cancelled) setIncidents([])
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => {
    const live = health?.status === 'ok'
    const incs = incidents ?? []
    const resolved = incs.filter((i) => i.status === 'RESOLVED')
    const awaiting = incs.filter((i) => i.status === 'AWAITING_APPROVAL')
    const failed = incs.filter((i) => i.status === 'FAILED')

    // Priority mix across library + live data (for the donut)
    const all: Array<{ priority: string }> = [...incs, ...SCENARIOS.map((s) => ({ priority: s.priority }))]
    const mix = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>
    all.forEach((a) => {
      mix[a.priority] = (mix[a.priority] || 0) + 1
    })

    const byDay = new Map<string, number>()
    incs.forEach((i) => {
      const d = new Date(i.created_at).toISOString().slice(0, 10)
      byDay.set(d, (byDay.get(d) || 0) + 1)
    })
    const trend = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14)

    const kpis: Kpi[] = [
      {
        label: 'MTTR (SIMULATED)',
        value: '2.4s',
        sub: 'human baseline: 45-90 min',
        color: 'var(--success)',
        icon: Timer,
      },
      {
        label: 'TOTAL INCIDENTS',
        value: live ? String(incs.length) : `${incs.length + SCENARIOS.length}`,
        sub: live ? 'from live API' : 'sketch mode (library + live)',
        color: 'var(--accent)',
        icon: Zap,
      },
      {
        label: 'RESOLVED',
        value: String(resolved.length),
        sub: `${awaiting.length} awaiting approval · ${failed.length} failed`,
        color: 'var(--purple)',
        icon: ShieldCheck,
      },
      {
        label: 'AUTO-RESOLUTION RATE',
        value: incs.length ? `${Math.round((resolved.length / incs.length) * 100)}%` : '—',
        sub: 'low-risk plans resolved autonomously',
        color: 'var(--warning)',
        icon: TrendingUp,
      },
    ]

    return { kpis, mix, trend, live }
  }, [health, incidents])
}

function Donut({ mix }: { mix: Record<string, number> }) {
  const total = Object.values(mix).reduce((a, b) => a + b, 0) || 1
  const colors: Record<string, string> = {
    CRITICAL: 'var(--danger)',
    HIGH: 'var(--warning)',
    MEDIUM: 'var(--accent)',
    LOW: 'var(--success)',
  }
  const R = 52
  const C = 2 * Math.PI * R
  let acc = 0

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label="Incident priority mix">
        <circle cx={70} cy={70} r={R} fill="none" stroke="var(--bg-inset)" strokeWidth={18} />
        {Object.entries(mix).map(([k, v]) => {
          if (!v) return null
          const frac = v / total
          const el = (
            <circle
              key={k}
              cx={70}
              cy={70}
              r={R}
              fill="none"
              stroke={colors[k] || 'var(--accent)'}
              strokeWidth={18}
              strokeDasharray={`${frac * C} ${C}`}
              strokeDashoffset={-acc * C}
              transform="rotate(-90 70 70)"
            />
          )
          acc += frac
          return el
        })}
        <text x={70} y={66} textAnchor="middle" className="font-display" fontSize={11} fill="var(--ink)">
          {total}
        </text>
        <text x={70} y={82} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={8} fill="var(--ink-dim)">
          INCIDENTS
        </text>
      </svg>
      <div className="font-code space-y-1.5" style={{ fontSize: 10 }}>
        {Object.entries(mix).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span style={{ width: 10, height: 10, backgroundColor: colors[k], display: 'inline-block' }} />
            <span style={{ color: 'var(--ink-dim)' }}>
              {k} — {v} ({Math.round((v / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Trend({ trend }: { trend: Array<[string, number]> }) {
  if (trend.length === 0) {
    return (
      <p className="font-code" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
        No live incident history yet — trigger a swarm run to populate the trend.
      </p>
    )
  }
  const max = Math.max(...trend.map(([, v]) => v), 1)
  const W = 560
  const H = 120
  const bw = W / trend.length

  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" role="img" aria-label="Incidents per day">
      {trend.map(([d, v], i) => {
        const h = (v / max) * (H - 10)
        return (
          <g key={d}>
            <rect
              x={i * bw + 4}
              y={H - h}
              width={bw - 8}
              height={h}
              fill="var(--accent)"
              opacity={0.85}
            />
            {trend.length <= 10 && (
              <text
                x={i * bw + bw / 2}
                y={H + 12}
                textAnchor="middle"
                fontFamily="JetBrains Mono"
                fontSize={7}
                fill="var(--ink-faint)"
              >
                {d.slice(5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function DashboardPage() {
  const { kpis, mix, trend, live } = useOpsMetrics()

  return (
    <Shell>
      <section className="max-w-6xl w-full mx-auto px-4 pt-8 pb-12 flex-1">
        <div className="flex items-end justify-between flex-wrap gap-2 mb-6">
          <div>
            <p className="font-display" style={{ fontSize: 9, color: 'var(--ink-faint)', marginBottom: 8 }}>
              {'> OPS TELEMETRY'}
              <span className="blink">_</span>
            </p>
            <h1 className="font-display" style={{ fontSize: 'clamp(14px, 2.5vw, 20px)' }}>
              MISSION DASHBOARD
            </h1>
          </div>
          <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              className={live ? undefined : 'pulse-soft'}
              style={{
                width: 8,
                height: 8,
                display: 'inline-block',
                backgroundColor: live ? 'var(--success)' : 'var(--warning)',
              }}
            />
            {live ? 'LIVE API DATA' : 'SKETCH MODE — SAMPLE DATA'}
          </span>
        </div>

        {/* KPI ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((k) => {
            const Icon = k.icon
            return (
              <div key={k.label} className="panel panel-flush" style={{ padding: 16 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display" style={{ fontSize: 7, color: 'var(--ink-faint)' }}>
                    {k.label}
                  </span>
                  <Icon size={14} style={{ color: k.color }} />
                </div>
                <div className="font-display" style={{ fontSize: 16, color: k.color }}>
                  {k.value}
                </div>
                <div className="font-code mt-1" style={{ fontSize: 9, color: 'var(--ink-dim)' }}>
                  {k.sub}
                </div>
              </div>
            )
          })}
        </div>

        {/* CHARTS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="panel">
            <p className="panel-title font-display">Priority Mix</p>
            <Donut mix={mix} />
          </div>
          <div className="panel">
            <p className="panel-title font-display">Incidents Per Day (live history)</p>
            <Trend trend={trend} />
          </div>
        </div>

        {/* QUICK LINKS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/" className="btn font-code" style={{ fontSize: 10, textAlign: 'left', padding: 14 }}>
            <span className="font-display block" style={{ fontSize: 8, marginBottom: 4 }}>
              &gt; SWARM CONSOLE
            </span>
            Dispatch the 4-agent swarm against a scenario
          </Link>
          <Link to="/agents" className="btn font-code" style={{ fontSize: 10, textAlign: 'left', padding: 14 }}>
            <span className="font-display block" style={{ fontSize: 8, marginBottom: 4 }}>
              &gt; AGENT LAB
            </span>
            Inspect agent configs and dry-run policies
          </Link>
          <Link to="/audit" className="btn font-code" style={{ fontSize: 10, textAlign: 'left', padding: 14 }}>
            <span className="font-display block" style={{ fontSize: 8, marginBottom: 4 }}>
              &gt; AUDIT TRAIL
            </span>
            Review signed operator approvals and steps
          </Link>
        </div>
      </section>
    </Shell>
  )
}
