import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScrollText, ChevronRight } from 'lucide-react'
import { fetchIncidents, fetchIncidentDetails } from '../services/api'
import { SCENARIOS } from '../services/simulation'
import { Shell, useHealth } from '../components/Shell'
import { useAuth } from '../auth'

/**
 * AUDIT TRAIL — who did what, when.
 * Live mode: walks /api/incidents -> /api/incidents/:id for the agent step log.
 * Sketch mode: renders the scenario library as sample audit entries so the
 * page still demonstrates the governance story offline.
 */

interface Entry {
  id: string
  ts: string
  actor: string
  action: string
  detail: string
  severity: 'INFO' | 'GATE' | 'APPROVAL'
  incidentId?: string
  thought?: string
}

function parseTs(v: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) || v.includes('T') ? v : v.replace(' ', 'T') + 'Z')
}

const SEVERITY_STYLE: Record<Entry['severity'], { color: string; cls: string }> = {
  INFO: { color: 'var(--accent)', cls: 'badge-accent' },
  GATE: { color: 'var(--warning)', cls: 'badge-warning' },
  APPROVAL: { color: 'var(--success)', cls: 'badge-success' },
}

function EntryRow({ e }: { e: Entry }) {
  const [open, setOpen] = useState(false)
  const s = SEVERITY_STYLE[e.severity]
  return (
    <div style={{ borderBottom: '2px solid var(--border-soft)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-center gap-2 font-code"
        style={{ padding: '9px 4px', fontSize: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
        aria-expanded={open}
      >
        <ChevronRight
          size={11}
          style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s', flexShrink: 0 }}
        />
        <span className="badge" style={{ fontSize: 8, flexShrink: 0, borderColor: s.color }}>
          {e.severity}
        </span>
        <span style={{ color: 'var(--ink-faint)', flexShrink: 0 }}>{parseTs(e.ts).toLocaleTimeString()}</span>
        <span style={{ fontWeight: 700, flexShrink: 0 }}>{e.actor}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-dim)' }}>
          {e.action}
        </span>
      </button>
      {open && (
        <div className="font-code" style={{ padding: '0 4px 10px 26px', fontSize: 10, color: 'var(--ink-dim)' }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>{e.detail}</div>
          {e.thought && (
            <div className="mt-1" style={{ color: 'var(--ink-faint)', whiteSpace: 'pre-wrap' }}>
              THOUGHT: {e.thought}
            </div>
          )}
          {e.incidentId && (
            <Link className="link mt-1 inline-block" to={`/incidents/${e.incidentId}`} style={{ fontSize: 10 }}>
              → Open incident {e.incidentId}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default function AuditPage() {
  const health = useHealth()
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[] | null>(null)

  const load = useCallback(async () => {
    const live = health?.status === 'ok'
    if (!live) {
      // Sketch mode: synthesize sample audit entries from the scenario library
      const now = Date.now()
      const sample: Entry[] = SCENARIOS.slice(0, 6).map((s, i) => ({
        id: `sk-${i}`,
        ts: new Date(now - (i + 1) * 3_600_000).toISOString(),
        actor: i % 3 === 0 ? 'Human Operator' : 'VERIFIER',
        action: i % 3 === 0 ? 'APPROVAL_SIGNED' : 'SAFETY_CHECK_PASSED',
        detail:
          i % 3 === 0
            ? `Operator signed off on infrastructure mutation for "${s.title}". Identity committed to the audit trail.`
            : `Actions for "${s.title}" screened against policy CP-7. Destructive patterns: none. ${s.priority === 'CRITICAL' ? 'High-risk path halted for sign-off.' : 'Cleared autonomous path.'}`,
        severity: i % 3 === 0 ? 'APPROVAL' : 'GATE',
        thought: `Sketch-mode sample entry for scenario ${s.key}.`,
      }))
      setEntries(sample)
      return
    }

    try {
      const incs = await fetchIncidents()
      const batches = await Promise.all(
        incs.slice(0, 12).map(async (inc) => {
          try {
            const { logs } = await fetchIncidentDetails(inc.id)
            return (logs as unknown as Array<{
              agent_name: string
              step_number: number
              thought: string | null
              action: string
              created_at: string
            }>).map(
              (l): Entry => ({
                id: `${inc.id}-${l.step_number}`,
                ts: l.created_at,
                actor: l.agent_name,
                action: l.action,
                detail: l.action,
                severity: l.agent_name === 'Human Operator' ? 'APPROVAL' : l.agent_name === 'VERIFIER' ? 'GATE' : 'INFO',
                incidentId: inc.id,
                thought: l.thought || undefined,
              }),
            )
          } catch {
            return []
          }
        }),
      )
      setEntries(
        batches
          .flat()
          .sort((a, b) => parseTs(b.ts).getTime() - parseTs(a.ts).getTime()),
      )
    } catch {
      setEntries([])
    }
  }, [health])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const es = entries ?? []
    return {
      total: es.length,
      approvals: es.filter((e) => e.severity === 'APPROVAL').length,
      gates: es.filter((e) => e.severity === 'GATE').length,
    }
  }, [entries])

  return (
    <Shell>
      <section className="max-w-6xl w-full mx-auto px-4 pt-8 pb-12 flex-1">
        <div className="flex items-end justify-between flex-wrap gap-2 mb-6">
          <div>
            <p className="font-display" style={{ fontSize: 9, color: 'var(--ink-faint)', marginBottom: 8 }}>
              {'> GOVERNANCE & APPROVAL LOG'}
              <span className="blink">_</span>
            </p>
            <h1 className="font-display" style={{ fontSize: 'clamp(14px, 2.5vw, 20px)' }}>
              AUDIT TRAIL
            </h1>
          </div>
          <span className="badge">
            {health?.status === 'ok' ? 'LIVE API DATA' : 'SKETCH MODE — SAMPLE ENTRIES'}
          </span>
        </div>

        {/* stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="panel panel-flush" style={{ padding: 14 }}>
            <div className="font-display" style={{ fontSize: 7, color: 'var(--ink-faint)' }}>ENTRIES</div>
            <div className="font-display" style={{ fontSize: 16, marginTop: 4 }}>{stats.total}</div>
          </div>
          <div className="panel panel-flush" style={{ padding: 14 }}>
            <div className="font-display" style={{ fontSize: 7, color: 'var(--ink-faint)' }}>APPROVALS SIGNED</div>
            <div className="font-display" style={{ fontSize: 16, color: 'var(--success)', marginTop: 4 }}>
              {stats.approvals}
            </div>
          </div>
          <div className="panel panel-flush" style={{ padding: 14 }}>
            <div className="font-display" style={{ fontSize: 7, color: 'var(--ink-faint)' }}>SAFETY GATES</div>
            <div className="font-display" style={{ fontSize: 16, color: 'var(--warning)', marginTop: 4 }}>
              {stats.gates}
            </div>
          </div>
        </div>

        {user && (
          <p className="font-code mb-4" style={{ fontSize: 10, color: 'var(--ink-dim)' }}>
            Session operator: <span style={{ color: 'var(--success)' }}>{user.name}</span> ({user.email}) — approvals
            you sign are recorded with this identity.
          </p>
        )}

        {/* entries */}
        <div className="panel">
          <p className="panel-title font-display">
            <ScrollText size={11} className="inline mr-1 -mt-0.5" />
            Signed Event Log
          </p>
          {entries === null ? (
            <p className="font-code" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>Loading audit trail...</p>
          ) : entries.length === 0 ? (
            <p className="font-code" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
              No audit entries yet. Run the swarm or approve an incident to generate signed events.
            </p>
          ) : (
            <div>
              {entries.map((e) => (
                <EntryRow key={e.id} e={e} />
              ))}
            </div>
          )}
        </div>
      </section>
    </Shell>
  )
}
