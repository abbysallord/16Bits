import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { ShieldCheck, LogOut } from 'lucide-react'
import { loginUser } from './services/api'
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
  const waiters = useRef<Array<(token: string | null) => void>>([])

  const settle = (token: string | null) => {
    waiters.current.forEach((w) => w(token))
    waiters.current = []
  }

  const saveSession = (s: Session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    setSession(s)
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

function LoginDialog({ onSuccess, onCancel }: { onSuccess: (s: Session) => void; onCancel: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async (e: string, p: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await loginUser(e, p)
      onSuccess({ token: res.token, user: res.user })
    } catch (err: any) {
      setError(err.message || 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

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
          OPERATOR SIGN-IN
        </p>
        <p className="font-code" style={{ fontSize: 11, color: '#4a4a4a', marginBottom: 12 }}>
          Approvals and runbook uploads are signed with your operator identity and written to the audit trail.
        </p>

        <button
          type="button"
          className="nes-btn is-success font-arcade w-full"
          style={{ fontSize: 10 }}
          disabled={busy}
          onClick={() => signIn(DEMO_EMAIL, DEMO_PASSWORD)}
        >
          {busy ? 'SIGNING IN...' : 'USE DEMO ACCOUNT'}
        </button>
        <p className="font-code text-center" style={{ fontSize: 10, color: '#6b6b6b', margin: '6px 0 12px' }}>
          {DEMO_EMAIL} / {DEMO_PASSWORD}
        </p>

        <form
          onSubmit={(ev) => {
            ev.preventDefault()
            if (email && password) signIn(email, password)
          }}
        >
          <div className="nes-field" style={{ marginBottom: 8 }}>
            <label htmlFor="login-email" className="font-arcade" style={{ fontSize: 8 }}>EMAIL</label>
            <input
              id="login-email"
              type="email"
              className="nes-input font-code"
              style={{ fontSize: 12 }}
              value={email}
              autoComplete="username"
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </div>
          <div className="nes-field" style={{ marginBottom: 12 }}>
            <label htmlFor="login-password" className="font-arcade" style={{ fontSize: 8 }}>PASSWORD</label>
            <input
              id="login-password"
              type="password"
              className="nes-input font-code"
              style={{ fontSize: 12 }}
              value={password}
              autoComplete="current-password"
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </div>
          {error && (
            <p className="font-code" style={{ fontSize: 11, color: '#e76e55', marginBottom: 8 }}>
              [ERROR] {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" className="nes-btn nes-btn-xs font-arcade" style={{ fontSize: 8 }} onClick={onCancel}>
              CANCEL
            </button>
            <button
              type="submit"
              className="nes-btn is-primary nes-btn-xs font-arcade"
              style={{ fontSize: 8 }}
              disabled={busy || !email || !password}
            >
              SIGN IN
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Header control: [SIGN IN] when signed out, operator name + sign-out when signed in
export function AuthBadge() {
  const { user, openLogin, logout } = useAuth()
  if (!user) {
    return (
      <button type="button" className="nes-btn is-success nes-btn-xs font-arcade" style={{ fontSize: 9 }} onClick={openLogin}>
        SIGN IN
      </button>
    )
  }
  return (
    <span className="flex items-center gap-1">
      <span className="font-code" style={{ fontSize: 10, color: '#212529' }} title={user.email}>
        <ShieldCheck size={11} className="inline mr-1" style={{ color: '#92cc41' }} />
        {user.name}
      </span>
      <button
        type="button"
        className="nes-btn nes-btn-xs font-arcade"
        style={{ fontSize: 8 }}
        onClick={logout}
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut size={10} />
      </button>
    </span>
  )
}
