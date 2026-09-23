import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Copy, CheckCheck, ArrowLeft } from 'lucide-react'
import { fetchOrg, updateOrg, testOrgSlack, rotateAlertKey, rotateInvite, joinTeam, UnauthorizedError } from '../services/api'
import type { OrgSettings } from '../services/api'
import { useAuth, AuthBadge } from '../auth'

// Team settings: connect the team's own Slack, copy its private alert URLs, invite teammates,
// and optionally bring its own Groq key.

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mb-2">
      <div className="font-arcade" style={{ fontSize: 8, marginBottom: 4 }}>{label}</div>
      <div className="flex gap-2 items-stretch">
        <code className="flex-1 p-2 font-code" style={{ fontSize: 10, border: '2px solid #212529', backgroundColor: '#f8f8f8', wordBreak: 'break-all' }}>
          {value}
        </code>
        <button
          type="button"
          className="nes-btn nes-btn-xs"
          aria-label={`Copy ${label}`}
          onClick={() => {
            navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, token, ensureToken, logout, adoptSession } = useAuth()
  const [org, setOrg] = useState<OrgSettings | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [slackUrl, setSlackUrl] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [joinCode, setJoinCode] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    try {
      const { org } = await fetchOrg(token)
      setOrg(org)
      setName(org.name)
    } catch (err: any) {
      if (err instanceof UnauthorizedError) logout()
      setStatus(`[ERROR] ${err.message}`)
    }
  }, [token, logout])

  useEffect(() => {
    load()
  }, [load])

  const act = async (fn: (t: string) => Promise<{ message: string; org?: OrgSettings }>) => {
    const t = await ensureToken()
    if (!t) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fn(t)
      if (res.org) setOrg(res.org)
      setStatus(`[SUCCESS] ${res.message}`)
    } catch (err: any) {
      if (err instanceof UnauthorizedError) logout()
      setStatus(`[ERROR] ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const box = { backgroundColor: '#fff' }

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
                TEAM SETTINGS
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

        {!user && (
          <div className="nes-container mt-4" style={box}>
            <p className="font-code" style={{ fontSize: 12 }}>Sign in to manage your team.</p>
            <button type="button" className="nes-btn is-success nes-btn-xs font-arcade mt-2" style={{ fontSize: 9 }} onClick={() => ensureToken()}>
              SIGN IN
            </button>
          </div>
        )}

        {status && (
          <div
            className="p-3 mt-4 font-code"
            style={{ fontSize: 11, border: '2px solid #212529', backgroundColor: status.startsWith('[SUCCESS]') ? '#e6f9d8' : '#fdf0d5' }}
          >
            {status}
          </div>
        )}

        {user && org && (
          <>
            <div className="nes-container with-title mt-4" style={box}>
              <p className="title font-arcade" style={{ fontSize: 9 }}>TEAM</p>
              <h1 className="font-arcade" style={{ fontSize: 14, lineHeight: 1.6 }}>{org.name}</h1>
              <p className="font-code" style={{ fontSize: 11, color: '#4a4a4a' }}>
                You are <b>{org.role}</b>.{' '}
                {org.isDemo
                  ? 'This is the shared public demo team: anyone with the demo login sees it, so its settings are read-only. Create your own account to get a private team with its own Slack and alert URLs.'
                  : 'Incidents, uploaded runbooks, alert URLs and Slack posts are private to this team.'}
              </p>
              {org.canEdit && (
                <div className="flex gap-2 mt-3">
                  <input className="nes-input font-code flex-1" style={{ fontSize: 11 }} value={name} onChange={(e) => setName(e.target.value)} aria-label="Team name" />
                  <button type="button" className="nes-btn is-primary nes-btn-xs font-arcade" style={{ fontSize: 8 }} disabled={busy} onClick={() => act((t) => updateOrg(t, { name }))}>
                    RENAME
                  </button>
                </div>
              )}
              {org.members.length > 0 && (
                <div className="mt-3 font-code" style={{ fontSize: 11 }}>
                  <div className="font-arcade" style={{ fontSize: 8, marginBottom: 4 }}>MEMBERS ({org.members.length})</div>
                  {org.members.map((m) => (
                    <div key={`${m.email}-${m.name}`}>
                      {m.name} {m.email ? `(${m.email})` : ''} · {m.role}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="nes-container with-title mt-4" style={box}>
              <p className="title font-arcade" style={{ fontSize: 9 }}>SLACK</p>
              <p className="font-code" style={{ fontSize: 11, color: '#4a4a4a' }}>
                Status:{' '}
                <b style={{ color: org.slack.configured ? '#4a8a1c' : '#e76e55' }}>
                  {org.slack.configured ? (org.slack.source === 'server' ? 'CONNECTED (server demo channel)' : 'CONNECTED') : 'NOT CONNECTED'}
                </b>
                {org.slack.webhookPreview ? ` · ${org.slack.webhookPreview}` : ''}
              </p>
              {org.canEdit ? (
                <>
                  <p className="font-code mt-2" style={{ fontSize: 10, color: '#6b6b6b' }}>
                    In your Slack workspace: api.slack.com/apps → Create app → Incoming Webhooks → On → Add New Webhook → pick a channel → copy the URL here.
                    Every triaged incident is posted there with a Review &amp; approve button.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <input
                      className="nes-input font-code flex-1"
                      style={{ fontSize: 11 }}
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackUrl}
                      onChange={(e) => setSlackUrl(e.target.value)}
                      aria-label="Slack webhook URL"
                    />
                    <button
                      type="button"
                      className="nes-btn is-primary nes-btn-xs font-arcade"
                      style={{ fontSize: 8 }}
                      disabled={busy || !slackUrl.trim()}
                      onClick={() => act(async (t) => { const r = await updateOrg(t, { slackWebhookUrl: slackUrl.trim() }); setSlackUrl(''); return r })}
                    >
                      SAVE
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="nes-btn is-success nes-btn-xs font-arcade" style={{ fontSize: 8 }} disabled={busy || !org.slack.configured} onClick={() => act(testOrgSlack)}>
                      SEND TEST MESSAGE
                    </button>
                    {org.slack.source === 'team' && (
                      <button type="button" className="nes-btn is-error nes-btn-xs font-arcade" style={{ fontSize: 8 }} disabled={busy} onClick={() => act((t) => updateOrg(t, { slackWebhookUrl: '' }))}>
                        DISCONNECT
                      </button>
                    )}
                  </div>
                </>
              ) : (
                !org.isDemo && <p className="font-code mt-2" style={{ fontSize: 10, color: '#6b6b6b' }}>Ask a team admin to connect Slack.</p>
              )}
            </div>

            {org.alertUrls && (
              <div className="nes-container with-title mt-4" style={box}>
                <p className="title font-arcade" style={{ fontSize: 9 }}>ALERT URLS</p>
                <p className="font-code mb-3" style={{ fontSize: 10, color: '#6b6b6b' }}>
                  Point your monitoring at these. The key in the URL is the secret: alerts sent here land only in this team's queue. Treat them like passwords.
                </p>
                <CopyRow label="PROMETHEUS ALERTMANAGER (webhook_configs url)" value={org.alertUrls.alertmanager} />
                <CopyRow label="PAGERDUTY (V3 webhook subscription)" value={org.alertUrls.pagerduty} />
                <CopyRow label="DATADOG (Webhooks integration URL)" value={org.alertUrls.datadog} />
                <CopyRow label="GENERIC JSON / CURL ({title, description, priority})" value={org.alertUrls.generic} />
                {org.canEdit && (
                  <button
                    type="button"
                    className="nes-btn is-warning nes-btn-xs font-arcade mt-2"
                    style={{ fontSize: 8 }}
                    disabled={busy}
                    onClick={() => window.confirm('Issue new alert URLs? The current ones stop working immediately.') && act(rotateAlertKey)}
                  >
                    ROTATE ALERT URLS
                  </button>
                )}
              </div>
            )}

            {org.inviteCode && (
              <div className="nes-container with-title mt-4" style={box}>
                <p className="title font-arcade" style={{ fontSize: 9 }}>INVITE TEAMMATES</p>
                <p className="font-code mb-3" style={{ fontSize: 10, color: '#6b6b6b' }}>
                  Teammates choose CREATE ACCOUNT and paste this code. They join as operators (can approve and upload runbooks).
                </p>
                <CopyRow label="INVITE CODE" value={org.inviteCode} />
                {org.canEdit && (
                  <button type="button" className="nes-btn is-warning nes-btn-xs font-arcade" style={{ fontSize: 8 }} disabled={busy} onClick={() => act(rotateInvite)}>
                    NEW INVITE CODE
                  </button>
                )}
              </div>
            )}

            {org.canEdit && (
              <div className="nes-container with-title mt-4" style={box}>
                <p className="title font-arcade" style={{ fontSize: 9 }}>AI QUOTA (OPTIONAL)</p>
                <p className="font-code" style={{ fontSize: 10, color: '#6b6b6b' }}>
                  Add your team's own free Groq key (console.groq.com/keys) so your agent runs use your quota instead of the shared server key.
                  {org.groq.ownKey ? ` Current: ${org.groq.keyPreview}` : ' Currently using the shared server key.'}
                </p>
                <div className="flex gap-2 mt-2">
                  <input
                    className="nes-input font-code flex-1"
                    style={{ fontSize: 11 }}
                    type="password"
                    placeholder="gsk_..."
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    aria-label="Groq API key"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="nes-btn is-primary nes-btn-xs font-arcade"
                    style={{ fontSize: 8 }}
                    disabled={busy || !groqKey.trim()}
                    onClick={() => act(async (t) => { const r = await updateOrg(t, { groqApiKey: groqKey.trim() }); setGroqKey(''); return r })}
                  >
                    SAVE
                  </button>
                  {org.groq.ownKey && (
                    <button type="button" className="nes-btn is-error nes-btn-xs font-arcade" style={{ fontSize: 8 }} disabled={busy} onClick={() => act((t) => updateOrg(t, { groqApiKey: '' }))}>
                      REMOVE
                    </button>
                  )}
                </div>
              </div>
            )}

            {!org.isDemo && (
              <div className="nes-container with-title mt-4" style={box}>
                <p className="title font-arcade" style={{ fontSize: 9 }}>JOIN ANOTHER TEAM</p>
                <p className="font-code" style={{ fontSize: 10, color: '#6b6b6b' }}>
                  Have an invite code from a teammate? Joining moves your account into their team.
                </p>
                <div className="flex gap-2 mt-2">
                  <input className="nes-input font-code flex-1" style={{ fontSize: 11 }} placeholder="invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} aria-label="Invite code" />
                  <button
                    type="button"
                    className="nes-btn is-primary nes-btn-xs font-arcade"
                    style={{ fontSize: 8 }}
                    disabled={busy || !joinCode.trim()}
                    onClick={() =>
                      act(async (t) => {
                        const r = await joinTeam(t, joinCode.trim())
                        adoptSession({ token: r.token, user: r.user })
                        setJoinCode('')
                        return { message: r.message }
                      })
                    }
                  >
                    JOIN
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
