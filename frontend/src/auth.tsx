import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ShieldCheck, LogOut, Eye, EyeOff } from 'lucide-react'
import { loginUser, registerUser, resetPassword, checkBackendHealth, claimIncidents } from './services/api'
import type { User } from './services/api'

// Public demo operator seeded by the backend (see seedDemoData in backend/src/server.ts)
export const DEMO_EMAIL = 'admin@16bits.io'
export const DEMO_PASSWORD = 'admin123'

const STORAGE_KEY = 'omniops_session'

interface Session {
  token: string
  user: User
}

interface AuthContextValue {
  user: User | null
  token: string | null
  // Opens the sign-in dialog if needed; resolves with a token, or null if the user cancels.
  ensureToken: () => Promise<string | null>
  openLogin: () => void
  logout: () => void
  // Increments on each fresh sign-in so the header can flash a short "signed in" banner
  signInCount: number
  // Replace the session with one the server just issued (e.g. after joining another team)
  adoptSession: (s: { token: string; user: User }) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    // Drop expired tokens early so the UI doesn't show a stale operator
    const payload = JSON.parse(atob(s.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    return s
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [signInCount, setSignInCount] = useState(0)
  const waiters = useRef<Array<(token: string | null) => void>>([])

  const settle = (token: string | null) => {
    waiters.current.forEach((w) => w(token))
    waiters.current = []
  }

  const saveSession = (s: Session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    setSession(s)
    setSignInCount((n) => n + 1)
    setDialogOpen(false)
    settle(s.token)

    // Auto-claim any unassigned/demo incidents worked on in this browser into the operator's workspace
    try {
      const recent = JSON.parse(localStorage.getItem('omniops_recent_incidents') || '[]')
      if (Array.isArray(recent) && recent.length > 0 && s.user?.orgId && s.user.orgId !== 'demo') {
        claimIncidents(recent, s.token).catch(() => {})
      }
    } catch {}
  }

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }, [])

  const ensureToken = useCallback(() => {
    const current = readSession()
    if (current) return Promise.resolve(current.token)
    setSession(null)
    setDialogOpen(true)
    return new Promise<string | null>((resolve) => waiters.current.push(resolve))
  }, [])

  const cancel = () => {
    setDialogOpen(false)
    settle(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        token: session?.token ?? null,
        ensureToken,
        openLogin: () => setDialogOpen(true),
        logout,
        signInCount,
        adoptSession: (s) => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
          setSession(s)
        },
      }}
    >
      {children}
      {dialogOpen && <LoginDialog onSuccess={saveSession} onCancel={cancel} />}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

type Mode = 'signin' | 'register' | 'reset'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Password input with a show/hide (eye) toggle. Used on every password field in the app.
export function PasswordInput(props: {
  id?: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  placeholder?: string
  ariaLabel?: string
  className?: string
  style?: React.CSSProperties
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        id={props.id}
        type={visible ? 'text' : 'password'}
        className={props.className || 'input'}
        style={{ fontSize: 12, ...props.style, paddingRight: 44 }}
        value={props.value}
        placeholder={props.placeholder}
        aria-label={props.ariaLabel}
        autoComplete={props.autoComplete}
        spellCheck={false}
        autoCapitalize="off"
        onChange={(ev) => props.onChange(ev.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide' : 'Show'}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: 'var(--ink)',
          lineHeight: 0
        }}
      >
        {visible ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
      </button>
    </div>
  )
}

function Field(props: {
  id: string
  label: string
  type: string
  value: string
  autoComplete: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label htmlFor={props.id} className="font-display block mb-1" style={{ fontSize: 8 }}>{props.label}</label>
      {props.type === 'password' ? (
        <PasswordInput id={props.id} value={props.value} autoComplete={props.autoComplete} onChange={props.onChange} />
      ) : (
        <input
          id={props.id}
          type={props.type}
          className="input"
          style={{ fontSize: 12 }}
          value={props.value}
          autoComplete={props.autoComplete}
          onChange={(ev) => props.onChange(ev.target.value)}
        />
      )}
    </div>
  )
}

function LoginDialog({ onSuccess, onCancel }: { onSuccess: (s: Session) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [teamName, setTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [busy, setBusy] = useState(false)
  // Hide the demo button when the backend runs with DEMO_ACCOUNT=off (shown until health says otherwise)
  const [demoEnabled, setDemoEnabled] = useState(true)
  useEffect(() => {
    checkBackendHealth()
      .then((h) => setDemoEnabled(h.demo_account !== false))
      .catch(() => {})
  }, [])
  const [error, setError] = useState<string | null>(null)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
  }

  const run = async (fn: () => Promise<{ token: string; user: User }>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      onSuccess({ token: res.token, user: res.user })
    } catch (err: any) {
      setError(err.message || 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (mode === 'signin') {
      if (!email || !password) return setError('Enter your email and password')
      return run(() => loginUser(email.trim(), password))
    }
    if (mode === 'reset') {
      if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address')
      if (resetCode.trim().length < 6) return setError('Enter the reset code from your team admin')
      if (password.length < 6) return setError('New password must be at least 6 characters')
      if (password !== confirm) return setError('Passwords do not match')
      return run(() => resetPassword(email.trim(), resetCode.trim(), password))
    }
    if (name.trim().length < 2) return setError('Name must be at least 2 characters')
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirm) return setError('Passwords do not match')
    return run(() =>
      registerUser(name.trim(), email.trim(), password, inviteCode.trim() ? { inviteCode: inviteCode.trim() } : { teamName: teamName.trim() || undefined })
    )
  }

  const tabStyle = { fontSize: 8, flex: 1 }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Operator sign-in"
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--overlay)', zIndex: 100 }}
      onClick={onCancel}
    >
      <div
        className="panel w-full relative"
        style={{ maxWidth: 420, maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="font-display absolute" style={{ top: -9, left: 12, fontSize: 9, backgroundColor: 'var(--bg-panel)', padding: '0 7px' }}>
          <ShieldCheck size={11} className="inline mr-1 -mt-0.5" />
          OPERATOR ACCESS
        </p>

        <div className="flex gap-2" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`btn btn-xs font-display ${mode === 'signin' ? 'btn-primary' : ''}`}
            style={tabStyle}
            onClick={() => switchMode('signin')}
          >
            SIGN IN
          </button>
          <button
            type="button"
            className={`btn btn-xs font-display ${mode === 'register' ? 'btn-primary' : ''}`}
            style={tabStyle}
            onClick={() => switchMode('register')}
          >
            CREATE ACCOUNT
          </button>
        </div>

        <p className="font-code" style={{ fontSize: 11, color: 'var(--ink-dim)', marginBottom: 12 }}>
          {mode === 'signin'
            ? 'Approvals and runbook uploads are signed with your operator identity and written to the audit trail.'
            : mode === 'reset'
              ? 'Forgot your password? Ask a team admin for a one-time reset code (Settings > Members > RESET CODE), then set a new password here. If you are the only admin, the server owner can issue one with npm run reset-code.'
              : 'Create a private team (you become its admin) or join one with an invite code.'}
        </p>

        {mode === 'signin' && demoEnabled && (
          <>
            <button
              type="button"
              className="btn btn-success font-display w-full"
              style={{ fontSize: 10 }}
              disabled={busy}
              onClick={() => run(() => loginUser(DEMO_EMAIL, DEMO_PASSWORD))}
            >
              {busy ? 'SIGNING IN...' : 'USE DEMO ACCOUNT'}
            </button>
            <p className="font-code text-center" style={{ fontSize: 10, color: 'var(--ink-faint)', margin: '6px 0 12px' }}>
              {DEMO_EMAIL} / {DEMO_PASSWORD}
            </p>
          </>
        )}

        <form onSubmit={submit} noValidate>
          {mode === 'register' && (
            <Field id="reg-name" label="NAME" type="text" value={name} autoComplete="name" onChange={setName} />
          )}
          <Field id="login-email" label="EMAIL" type="email" value={email} autoComplete="username" onChange={setEmail} />
          {mode === 'reset' && (
            <Field id="reset-code" label="RESET CODE" type="text" value={resetCode} autoComplete="one-time-code" onChange={setResetCode} />
          )}
          <Field
            id="login-password"
            label={mode === 'reset' ? 'NEW PASSWORD' : 'PASSWORD'}
            type="password"
            value={password}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            onChange={setPassword}
          />
          {mode === 'signin' && (
            <div style={{ textAlign: 'right', margin: '-4px 0 8px' }}>
              <button
                type="button"
                className="font-code"
                style={{ fontSize: 10, color: 'var(--accent, #209cee)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => switchMode('reset')}
              >
                Forgot password?
              </button>
            </div>
          )}
          {(mode === 'register' || mode === 'reset') && (
            <Field id="reg-confirm" label={mode === 'reset' ? 'CONFIRM NEW PASSWORD' : 'CONFIRM PASSWORD'} type="password" value={confirm} autoComplete="new-password" onChange={setConfirm} />
          )}
          {mode === 'register' && (
            <>
              <Field id="reg-team" label="TEAM NAME (NEW TEAM)" type="text" value={teamName} autoComplete="organization" onChange={setTeamName} />
              <Field id="reg-invite" label="OR INVITE CODE (JOIN A TEAM)" type="text" value={inviteCode} autoComplete="off" onChange={setInviteCode} />
              <p className="font-code" style={{ fontSize: 10, color: 'var(--ink-faint)', margin: '-2px 0 8px' }}>
                Each team gets its own incidents, runbooks, alert URLs and Slack. Leave both empty to start a team of your own.
              </p>
            </>
          )}
          {error && (
            <p className="font-code" style={{ fontSize: 11, color: 'var(--danger)', margin: '4px 0 8px' }}>
              [ERROR] {error}
            </p>
          )}
          <div className="flex gap-2 justify-end" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-xs font-display" style={{ fontSize: 8 }} onClick={onCancel}>
              CANCEL
            </button>
            <button type="submit" className="btn btn-primary btn-xs font-display" style={{ fontSize: 8 }} disabled={busy}>
              {busy ? 'WORKING...' : mode === 'signin' ? 'SIGN IN' : mode === 'reset' ? 'SET NEW PASSWORD' : 'CREATE ACCOUNT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Header control: [SIGN IN] when signed out. After a fresh sign-in it flashes "SIGNED IN AS <name>"
// for 2 seconds, then collapses to a compact icon; clicking the icon shows the operator and SIGN OUT.
export function AuthBadge() {
  const { user, openLogin, logout, signInCount } = useAuth()
  // The banner shows while the latest sign-in hasn't been dismissed yet
  const [dismissedCount, setDismissedCount] = useState(signInCount)
  const flash = signInCount > 0 && dismissedCount !== signInCount
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!signInCount) return
    const t = setTimeout(() => setDismissedCount(signInCount), 2000)
    return () => clearTimeout(t)
  }, [signInCount])

  useEffect(() => {
    if (!menuOpen) return
    const close = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  if (!user) {
    return (
      <button type="button" className="btn btn-success btn-xs font-display" style={{ fontSize: 9 }} onClick={openLogin}>
        SIGN IN
      </button>
    )
  }

  if (flash) {
    return (
      <span
        className="font-display"
        role="status"
        style={{ fontSize: 8, padding: '6px 8px', border: '3px solid var(--success)', backgroundColor: 'var(--success-soft)', color: 'var(--ink)' }}
      >
        <ShieldCheck size={10} className="inline mr-1" style={{ color: 'var(--success)' }} />
        SIGNED IN AS {user.name.toUpperCase()}
      </span>
    )
  }

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn btn-success btn-xs"
        style={{ fontSize: 9, lineHeight: 1 }}
        title={`Signed in as ${user.name} (${user.email})`}
        aria-label={`Signed in as ${user.name}. Open account menu`}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <ShieldCheck size={12} />
      </button>
      {menuOpen && (
        <div
          className="font-code"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            minWidth: 220,
            backgroundColor: 'var(--bg-panel)',
            border: '3px solid var(--border)',
            boxShadow: '4px 4px 0 var(--shadow-color)',
            padding: 10,
            zIndex: 60,
          }}
        >
          <div className="font-display" style={{ fontSize: 8, color: 'var(--ink-faint)', marginBottom: 4 }}>SIGNED IN AS</div>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--ink)' }}>{user.name}</div>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 4, wordBreak: 'break-all' }}>{user.email}</div>
          <div style={{ fontSize: 10, color: 'var(--ink)', marginBottom: 8 }}>
            TEAM: <b>{user.orgId === 'demo' ? 'Public demo' : user.orgName || 'My team'}</b> · {user.role}
          </div>
          <a
            href="/settings"
            className="btn btn-primary btn-xs font-display w-full"
            style={{ fontSize: 8, marginBottom: 6, display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            TEAM SETTINGS
          </a>
          <button
            type="button"
            className="btn btn-danger btn-xs font-display w-full"
            style={{ fontSize: 8 }}
            onClick={() => {
              setMenuOpen(false)
              logout()
            }}
          >
            <LogOut size={9} className="inline mr-1" />
            SIGN OUT
          </button>
        </div>
      )}
    </span>
  )
}
