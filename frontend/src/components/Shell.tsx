import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Zap, Clock } from 'lucide-react'
import { checkBackendHealth } from '../services/api'
import type { HealthStatus } from '../services/api'
import { AuthBadge } from '../auth'
import { ThemeToggle } from '../theme'

/** Shared backend health probe — one fetch per page mount. */
export function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  useEffect(() => {
    checkBackendHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])
  return health
}

export function HealthBadge() {
  const health = useHealth()
  const ok = health?.status === 'ok'
  return (
    <span
      className="badge"
      title={ok ? `Backend online · ${health?.database ?? 'unknown db'}` : 'Backend offline — sketch mode active'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <span
        className={ok ? undefined : 'pulse-soft'}
        style={{
          width: 8,
          height: 8,
          display: 'inline-block',
          backgroundColor: ok ? 'var(--success)' : 'var(--warning)',
        }}
      />
      {ok ? 'LIVE API' : 'SKETCH MODE'}
    </span>
  )
}

const NAV = [
  { to: '/', label: 'CONSOLE', end: true },
  { to: '/dashboard', label: 'DASHBOARD' },
  { to: '/agents', label: 'AGENT LAB' },
  { to: '/audit', label: 'AUDIT' },
  { to: '/docs', label: 'DOCS' },
]

/** Sticky header + footer chrome shared by every page. */
export function Shell({ children }: { children: React.ReactNode }) {
  const health = useHealth()

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <header
        className="sticky top-0 z-50"
        style={{ backgroundColor: 'var(--bg)', borderBottom: '3px solid var(--border)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label="OmniOps home"
              className="flex items-center justify-center"
              style={{
                width: 40,
                height: 40,
                backgroundColor: 'var(--ink)',
                color: 'var(--success)',
                boxShadow: '4px 4px 0 var(--shadow-color)',
                textDecoration: 'none',
              }}
            >
              <Zap size={22} strokeWidth={2.5} />
            </Link>
            <div>
              <Link to="/" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                <span className="font-display" style={{ fontSize: 13, fontWeight: 'bold' }}>
                  16Bits OmniOps
                </span>
              </Link>
              <div className="font-code hidden sm:block" style={{ fontSize: 10, marginTop: 2, color: 'var(--ink-dim)' }}>
                AGENTIC AI SWARM · MULTI-AGENT INCIDENT RESPONSE
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <nav className="flex items-center gap-1.5 flex-wrap" aria-label="Primary">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end as boolean | undefined}
                  className={({ isActive }) => `btn btn-xs font-display${isActive ? ' btn-primary' : ''}`}
                  style={{ textDecoration: 'none', fontSize: 8 }}
                >
                  {n.label}
                </NavLink>
              ))}
              <a
                href="https://www.npmjs.com/package/omniops"
                target="_blank"
                rel="noreferrer"
                className="btn btn-xs btn-warning font-display"
                style={{ textDecoration: 'none', fontSize: 8 }}
              >
                NPM
              </a>
            </nav>
            <ThemeToggle />
            <AuthBadge />
          </div>
        </div>
      </header>

      {children}

      <footer
        style={{
          borderTop: '3px solid var(--border)',
          backgroundColor: 'var(--ink)',
          color: 'var(--bg)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="font-display" style={{ fontSize: 9, color: 'var(--success)', marginBottom: 10 }}>
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
            <div className="font-display" style={{ fontSize: 9, color: 'var(--accent)', marginBottom: 10 }}>
              AGENT ROLES
            </div>
            <ul className="font-code" style={{ fontSize: 10, lineHeight: 2 }}>
              <li>- Planner: decompose &amp; plan</li>
              <li>- Investigator: gather telemetry</li>
              <li>- Verifier: safety gate</li>
              <li>- Synthesizer: resolution &amp; comms</li>
            </ul>
          </div>
          <div>
            <div className="font-display" style={{ fontSize: 9, color: 'var(--warning)', marginBottom: 10 }}>
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
        <div className="text-center pb-4 font-code" style={{ fontSize: 9, color: 'var(--ink-dim)' }}>
          16Bits OmniOps · Theme: Agentic AI &amp; Intelligent Systems · Production Release 1.0.0
          <Clock size={9} className="inline ml-1" />
        </div>
      </footer>
    </div>
  )
}
