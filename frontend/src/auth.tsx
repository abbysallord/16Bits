import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ShieldCheck, LogOut } from 'lucide-react'
import { loginUser, registerUser, checkBackendHealth } from './services/api'
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

type Mode = 'signin' | 'register'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Field(props: {
  id: string
  label: string
  type: string
  value: string
  autoComplete: string
  onChange: (v: string) => void
}) {
  return (
    <div className="nes-field" style={{ marginBottom: 8 }}>
      <label htmlFor={props.id} className="font-arcade" style={{ fontSize: 8 }}>{props.label}</label>
      <input
        id={props.id}
        type={props.type}
        className="nes-input font-code"
        style={{ fontSize: 12 }}
        value={props.value}
        autoComplete={props.autoComplete}
        onChange={(ev) => props.onChange(ev.target.value)}
      />
    </div>
  )
}

function LoginDialog({ onSuccess, onCancel }: { onSuccess: (s: Session) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
    if (name.trim().length < 2) return setError('Name must be at least 2 characters')
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirm) return setError('Passwords do not match')
    return run(() => registerUser(name.trim(), email.trim(), password))
  }

  const tabStyle = { fontSize: 8, flex: 1 }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Operator sign-in"
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(33,37,41,0.55)', zIndex: 100 }}
      onClick={onCancel}
    >
      <div
        className="nes-container with-title w-full"
        style={{ backgroundColor: '#fff', maxWidth: 420 }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="title font-arcade" style={{ fontSize: 10 }}>
          <ShieldCheck size={12} className="inline mr-1" />
          OPERATOR ACCESS
        </p>

        <div className="flex gap-2" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`nes-btn nes-btn-xs font-arcade ${mode === 'signin' ? 'is-primary' : ''}`}
            style={tabStyle}
            onClick={() => switchMode('signin')}
          >
            SIGN IN
          </button>
          <button
            type="button"
            className={`nes-btn nes-btn-xs font-arcade ${mode === 'register' ? 'is-primary' : ''}`}
            style={tabStyle}
            onClick={() => switchMode('register')}
          >
            CREATE ACCOUNT
          </button>
        </div>

        <p className="font-code" style={{ fontSize: 11, color: '#4a4a4a', marginBottom: 12 }}>
          {mode === 'signin'
            ? 'Approvals and runbook uploads are signed with your operator identity and written to the audit trail.'
            : 'New accounts get the operator role and can approve incidents and upload runbooks.'}
        </p>

        {mode === 'signin' && demoEnabled && (
          <>
            <button
              type="button"
              className="nes-btn is-success font-arcade w-full"
              style={{ fontSize: 10 }}
              disabled={busy}
              onClick={() => run(() => loginUser(DEMO_EMAIL, DEMO_PASSWORD))}
            >
              {busy ? 'SIGNING IN...' : 'USE DEMO ACCOUNT'}
            </button>
            <p className="font-code text-center" style={{ fontSize: 10, color: '#6b6b6b', margin: '6px 0 12px' }}>
              {DEMO_EMAIL} / {DEMO_PASSWORD}
            </p>
          </>
        )}

        <form onSubmit={submit} noValidate>
          {mode === 'register' && (
            <Field id="reg-name" label="NAME" type="text" value={name} autoComplete="name" onChange={setName} />
          )}
          <Field id="login-email" label="EMAIL" type="email" value={email} autoComplete="username" onChange={setEmail} />
          <Field
            id="login-password"
            label="PASSWORD"
            type="password"
            value={password}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            onChange={setPassword}
          />
          {mode === 'register' && (
            <Field id="reg-confirm" label="CONFIRM PASSWORD" type="password" value={confirm} autoComplete="new-password" onChange={setConfirm} />
          )}
          {error && (
            <p className="font-code" style={{ fontSize: 11, color: '#e76e55', margin: '4px 0 8px' }}>
              [ERROR] {error}
            </p>
          )}
          <div className="flex gap-2 justify-end" style={{ marginTop: 8 }}>
            <button type="button" className="nes-btn nes-btn-xs font-arcade" style={{ fontSize: 8 }} onClick={onCancel}>
              CANCEL
            </button>
            <button type="submit" className="nes-btn is-primary nes-btn-xs font-arcade" style={{ fontSize: 8 }} disabled={busy}>
              {busy ? 'WORKING...' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
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
      <button type="button" className="nes-btn is-success nes-btn-xs font-arcade" style={{ fontSize: 9 }} onClick={openLogin}>
        SIGN IN
      </button>
    )
  }

  if (flash) {
    return (
      <span
        className="font-arcade"
        role="status"
        style={{ fontSize: 8, padding: '6px 8px', border: '3px solid #92cc41', backgroundColor: '#e6f9d8', color: '#212529' }}
      >
        <ShieldCheck size={10} className="inline mr-1" style={{ color: '#4a8a1c' }} />
        SIGNED IN AS {user.name.toUpperCase()}
      </span>
    )
  }

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="nes-btn is-success nes-btn-xs"
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
            backgroundColor: '#fff',
            border: '3px solid #212529',
            boxShadow: '4px 4px 0px rgba(0,0,0,0.3)',
            padding: 10,
            zIndex: 60,
          }}
        >
          <div className="font-arcade" style={{ fontSize: 8, color: '#6b6b6b', marginBottom: 4 }}>SIGNED IN AS</div>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#212529' }}>{user.name}</div>
          <div style={{ fontSize: 10, color: '#6b6b6b', marginBottom: 8, wordBreak: 'break-all' }}>{user.email}</div>
          <button
            type="button"
            className="nes-btn is-error nes-btn-xs font-arcade w-full"
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
