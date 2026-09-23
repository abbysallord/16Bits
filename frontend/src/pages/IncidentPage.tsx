import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Zap, ShieldCheck, CircleDot, ArrowLeft } from 'lucide-react'
import { approveIncident, fetchIncidentDetails, UnauthorizedError } from '../services/api'
import type { Incident } from '../services/api'
import { useAuth, AuthBadge } from '../auth'

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
  RESOLVED: '#92cc41',
  AWAITING_APPROVAL: '#f7d51d',
  ANALYZING: '#209cee',
  PENDING: '#209cee',
  FAILED: '#e76e55',
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8f8f8' }}>
      <header className="sticky top-0 z-50" style={{ backgroundColor: '#f8f8f8', borderBottom: '4px solid #212529' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center justify-center"
              style={{ width: 40, height: 40, backgroundColor: '#212529', color: '#92cc41', boxShadow: '4px 4px 0px rgba(0,0,0,0.4)', textDecoration: 'none' }}
            >
              <Zap size={22} strokeWidth={2.5} />
            </Link>
            <div>
              <Link to="/" style={{ textDecoration: 'none', color: '#212529' }}>
                <span className="font-arcade" style={{ fontSize: 13, fontWeight: 'bold' }}>16Bits OmniOps</span>
              </Link>
              <div className="font-code text-neutral-600 hidden sm:block" style={{ fontSize: 10, marginTop: 2 }}>
                INCIDENT REVIEW
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="nes-btn nes-btn-xs font-arcade" style={{ textDecoration: 'none', fontSize: 9 }}>CONSOLE</Link>
            <Link to="/docs" className="nes-btn nes-btn-xs font-arcade" style={{ textDecoration: 'none', fontSize: 9 }}>DOCS</Link>
            <AuthBadge />
          </div>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-4 py-8">
        <Link to="/" className="font-code" style={{ fontSize: 11, color: '#209cee' }}>
          <ArrowLeft size={11} className="inline mr-1" />
          Back to console
        </Link>

        {error && (
          <div className="nes-container mt-4" style={{ backgroundColor: '#fff' }}>
            <p className="font-code" style={{ fontSize: 12, color: '#e76e55' }}>[ERROR] {error}</p>
            {!user && (
              <button type="button" className="nes-btn is-success nes-btn-xs font-arcade mt-2" style={{ fontSize: 9 }} onClick={() => ensureToken()}>
                SIGN IN TO VIEW
              </button>
            )}
          </div>
        )}

        {!incident && !error && <p className="font-code mt-4" style={{ fontSize: 12 }}>Loading incident...</p>}

        {incident && (
          <>
            <div className="nes-container with-title mt-4" style={{ backgroundColor: '#fff' }}>
              <p className="title font-arcade" style={{ fontSize: 9 }}>INCIDENT</p>
              <h1 className="font-arcade" style={{ fontSize: 14, lineHeight: 1.6 }}>{incident.title}</h1>
              <div className="flex flex-wrap gap-2 mt-2 font-code" style={{ fontSize: 10 }}>
                <span className="px-2 py-1" style={{ border: '2px solid #212529' }}>{incident.priority}</span>
                <span className="px-2 py-1" style={{ border: `2px solid ${STATUS_COLOR[incident.status] || '#212529'}` }}>{incident.status}</span>
                <span className="px-2 py-1" style={{ border: '2px solid #d3d3d3' }}>{incident.category}</span>
                <span className="px-2 py-1 text-neutral-500">{parseTs(incident.created_at).toLocaleString()}</span>
              </div>
              <p className="font-code mt-3" style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: '#4a4a4a' }}>{incident.description}</p>
            </div>

            <div className="nes-container with-title mt-4" style={{ backgroundColor: '#fff' }}>
              <p className="title font-arcade" style={{ fontSize: 9 }}>REMEDIATION PLAN</p>
              {incident.status === 'AWAITING_APPROVAL' ? (
                <div className="p-3 mb-3" style={{ border: '3px solid #f7d51d', backgroundColor: '#fdf6d8' }}>
                  <div className="font-arcade" style={{ fontSize: 9, color: '#8a7500' }}>
                    <ShieldCheck size={12} className="inline mr-1" />
                    HUMAN AUTHORIZATION REQUIRED
                  </div>
                  <p className="font-code mt-1" style={{ fontSize: 10, color: '#5c5000' }}>
                    Review the plan below. Approval is recorded with your operator identity. OmniOps does not run the commands.
                  </p>
                  <button type="button" onClick={approve} disabled={approving} className="nes-btn is-warning nes-btn-xs font-arcade mt-2" style={{ fontSize: 8 }}>
                    {approving ? 'AUTHORIZING...' : 'AUTHORIZE PLAN →'}
                  </button>
                </div>
              ) : incident.status === 'RESOLVED' ? (
                <div className="p-2 mb-3 font-code" style={{ border: '2px solid #92cc41', backgroundColor: '#e6f9d8', fontSize: 10 }}>
                  <CircleDot size={10} className="inline mr-1" style={{ color: '#92cc41' }} />
                  {approvedBy
                    ? `Approved by ${approvedBy}`
                    : humanLog
                      ? humanLog.thought
                      : 'Resolved (low-risk plan auto-approved by policy)'}
                </div>
              ) : incident.status === 'FAILED' ? (
                <p className="font-code mb-3" style={{ fontSize: 11, color: '#e76e55' }}>Triage failed. Check the backend logs or re-run from the console.</p>
              ) : (
                <p className="font-code mb-3" style={{ fontSize: 11, color: '#209cee' }}>Swarm triage in progress... this page refreshes on its own.</p>
              )}
              {incident.resolution && (
                <div className="font-code" style={{ backgroundColor: '#f8f8f8', border: '2px solid #212529', padding: 12, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {incident.resolution}
                </div>
              )}
            </div>

            <div className="nes-container with-title mt-4" style={{ backgroundColor: '#fff' }}>
              <p className="title font-arcade" style={{ fontSize: 9 }}>AUDIT TRAIL ({logs.length})</p>
              {logs.length === 0 && <p className="font-code" style={{ fontSize: 11 }}>No agent steps yet.</p>}
              {logs.map((l, i) => (
                <div key={i} className="font-code" style={{ fontSize: 10, borderBottom: '1px dashed #d3d3d3', padding: '6px 0' }}>
                  <span className="font-bold">{l.step_number}. {l.agent_name}</span>
                  <span className="text-neutral-500"> · {parseTs(l.created_at).toLocaleTimeString()}</span>
                  <div>{l.action}</div>
                  {l.thought && <div className="text-neutral-500" style={{ whiteSpace: 'pre-wrap' }}>{l.thought.length > 400 ? l.thought.slice(0, 400) + '...' : l.thought}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
