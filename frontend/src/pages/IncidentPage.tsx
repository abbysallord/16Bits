import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShieldCheck, CircleDot, ArrowLeft } from 'lucide-react'
import { approveIncident, fetchIncidentDetails, UnauthorizedError } from '../services/api'
import type { Incident } from '../services/api'
import { useAuth } from '../auth'
import { Shell } from '../components/Shell'

// Deep-linkable incident page: /incidents/:id. Slack notifications link here so on-call can
// review the swarm's plan and approve it without hunting through the console.

interface LogRow {
  agent_name: string
  step_number: number
  thought: string | null
  action: string
  created_at: string
}

// SQLite returns 'YYYY-MM-DD HH:MM:SS' in UTC without a zone; Postgres returns ISO with a zone
function parseTs(v: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) || v.includes('T') ? v : v.replace(' ', 'T') + 'Z')
}

const STATUS_COLOR: Record<string, string> = {
  RESOLVED: 'var(--success)',
  AWAITING_APPROVAL: 'var(--warning)',
  ANALYZING: 'var(--accent)',
  PENDING: 'var(--accent)',
  FAILED: 'var(--danger)',
}

export default function IncidentPage() {
  const { id = '' } = useParams()
  const { ensureToken, logout, user } = useAuth()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [approvedBy, setApprovedBy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchIncidentDetails(id)
      setIncident(data.incident)
      setLogs(data.logs as unknown as LogRow[])
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Could not load incident')
    }
    // Re-load after sign-in/out: incidents are visible only to their own team
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id])

  useEffect(() => {
    load()
  }, [load])

  // Background triage (alert webhooks) may still be running; refresh until it settles
  const status = incident?.status
  useEffect(() => {
    if (status !== 'ANALYZING' && status !== 'PENDING') return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [status, load])

  const approve = async () => {
    if (!incident) return
    setApproving(true)
    try {
      let token = await ensureToken()
      if (!token) return
      try {
        const res = await approveIncident(incident.id, token)
        setApprovedBy(res.authorizedBy)
      } catch (err) {
        if (!(err instanceof UnauthorizedError)) throw err
        logout()
        token = await ensureToken()
        if (!token) return
        const res = await approveIncident(incident.id, token)
        setApprovedBy(res.authorizedBy)
      }
      await load()
    } catch (err: any) {
      alert(`Approval error: ${err.message}`)
      load()
    } finally {
      setApproving(false)
    }
  }

  const humanLog = logs.find((l) => l.agent_name === 'Human Operator')

  return (
    <Shell>
      <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-1">
        <Link to="/" className="link font-code inline-flex items-center" style={{ fontSize: 11 }}>
          <ArrowLeft size={11} className="mr-1" />
          Back to console
        </Link>

        {error && (
          <div className="panel mt-4" style={{ backgroundColor: 'var(--bg-panel)' }}>
            <p className="font-code" style={{ fontSize: 12, color: 'var(--danger)' }}>[ERROR] {error}</p>
            {!user && (
              <button type="button" className="btn btn-success btn-xs font-display mt-2" style={{ fontSize: 9 }} onClick={() => ensureToken()}>
                SIGN IN TO VIEW
              </button>
            )}
          </div>
        )}

        {!incident && !error && <p className="font-code mt-4" style={{ fontSize: 12 }}>Loading incident...</p>}

        {incident && (
          <>
            <div className="panel mt-4">
              <p className="panel-title font-display">INCIDENT</p>
              <h1 className="font-display" style={{ fontSize: 14, lineHeight: 1.6 }}>{incident.title}</h1>
              <div className="flex flex-wrap gap-2 mt-2 font-code" style={{ fontSize: 10 }}>
                <span className="badge">{incident.priority}</span>
                <span className="badge" style={{ borderColor: STATUS_COLOR[incident.status] || 'var(--border)' }}>
                  {incident.status}
                </span>
                <span className="badge" style={{ borderColor: 'var(--border-soft)' }}>{incident.category}</span>
                <span style={{ color: 'var(--ink-faint)' }}>{parseTs(incident.created_at).toLocaleString()}</span>
              </div>
              <p className="font-code mt-3" style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--ink-dim)' }}>
                {incident.description}
              </p>
            </div>

            <div className="panel mt-4">
              <p className="panel-title font-display">REMEDIATION PLAN</p>
              {incident.status === 'AWAITING_APPROVAL' ? (
                <div className="p-3 mb-3" style={{ border: '3px solid var(--warning)', backgroundColor: 'var(--warning-soft)' }}>
                  <div className="font-display" style={{ fontSize: 9 }}>
                    <ShieldCheck size={12} className="inline mr-1" />
                    HUMAN AUTHORIZATION REQUIRED
                  </div>
                  <p className="font-code mt-1" style={{ fontSize: 10, color: 'var(--ink-dim)' }}>
                    Review the plan below. Approval is recorded with your operator identity. OmniOps does not run the commands.
                  </p>
                  <button
                    type="button"
                    onClick={approve}
                    disabled={approving}
                    className="btn btn-warning btn-xs font-display mt-2"
                    style={{ fontSize: 8 }}
                  >
                    {approving ? 'AUTHORIZING...' : 'AUTHORIZE PLAN →'}
                  </button>
                </div>
              ) : incident.status === 'RESOLVED' ? (
                <div
                  className="p-2 mb-3 font-code"
                  style={{ border: '2px solid var(--success)', backgroundColor: 'var(--success-soft)', fontSize: 10 }}
                >
                  <CircleDot size={10} className="inline mr-1" style={{ color: 'var(--success)' }} />
                  {approvedBy
                    ? `Approved by ${approvedBy}`
                    : humanLog
                      ? humanLog.thought
                      : 'Resolved (low-risk plan auto-approved by policy)'}
                </div>
              ) : incident.status === 'FAILED' ? (
                <p className="font-code mb-3" style={{ fontSize: 11, color: 'var(--danger)' }}>
                  Triage failed. Check the backend logs or re-run from the console.
                </p>
              ) : (
                <p className="font-code mb-3" style={{ fontSize: 11, color: 'var(--accent)' }}>
                  Swarm triage in progress... this page refreshes on its own.
                </p>
              )}
              {incident.resolution && (
                <div
                  className="font-code"
                  style={{
                    backgroundColor: 'var(--bg-inset)',
                    border: '2px solid var(--border)',
                    padding: 12,
                    fontSize: 11,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {incident.resolution}
                </div>
              )}
            </div>

            <div className="panel mt-4">
              <p className="panel-title font-display">AUDIT TRAIL ({logs.length})</p>
              {logs.length === 0 && <p className="font-code" style={{ fontSize: 11 }}>No agent steps yet.</p>}
              {logs.map((l, i) => (
                <div
                  key={i}
                  className="font-code"
                  style={{ fontSize: 10, borderBottom: '1px dashed var(--border-soft)', padding: '6px 0' }}
                >
                  <span className="font-bold">{l.step_number}. {l.agent_name}</span>
                  <span style={{ color: 'var(--ink-faint)' }}> · {parseTs(l.created_at).toLocaleTimeString()}</span>
                  <div>{l.action}</div>
                  {l.thought && (
                    <div style={{ color: 'var(--ink-dim)', whiteSpace: 'pre-wrap' }}>
                      {l.thought.length > 400 ? l.thought.slice(0, 400) + '...' : l.thought}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </Shell>
  )
}
