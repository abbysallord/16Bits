import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { loginUser, getCurrentUser, clearAuthSession } from '../services/api'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@16bits.io')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const currentUser = getCurrentUser()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await loginUser(email, password)
      navigate('/console')
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    clearAuthSession()
    navigate('/')
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border-4 border-black p-6 sm:p-8 shadow-[8px_8px_0_0_#000]">
        <div className="border-b-2 border-black pb-4 mb-6 text-center">
          <img
            src="/assets/logo-pixel.svg"
            alt="16Bits OmniOps"
            className="w-12 h-12 mx-auto mb-2 rendering-pixelated"
          />
          <h1 className="font-press-start text-sm sm:text-base text-black">
            OPERATOR AUTHENTICATION
          </h1>
          <p className="font-mono text-xs text-neutral-600 mt-1">
            Access the SRE Swarm Console &amp; Authorization Gate
          </p>
        </div>

        {currentUser ? (
          <div className="flex flex-col gap-4 text-center">
            <div className="p-3 border-2 border-black bg-emerald-100 font-mono text-xs text-emerald-900 font-bold">
              [ACTIVE SESSION]: Logged in as {currentUser.name} ({currentUser.email})
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/console')}
                className="flex-1 py-2.5 font-mono text-xs font-bold bg-[#3b82f6] text-white border-2 border-black shadow-[2px_2px_0_0_#000]"
              >
                GO TO CONSOLE
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-2.5 font-mono text-xs font-bold bg-rose-100 text-rose-900 border-2 border-black hover:bg-rose-200"
              >
                LOGOUT
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 border-2 border-black bg-rose-100 font-mono text-xs text-rose-900 font-bold">
                [AUTH ERROR]: {error}
              </div>
            )}

            <div>
              <label className="block font-mono text-xs font-bold text-black mb-1">
                OPERATOR EMAIL:
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 font-mono text-xs border-2 border-black bg-[#f8fafc] text-black focus:outline-none focus:border-[#3b82f6]"
              />
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-black mb-1">
                ACCESS KEY / PASSWORD:
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2.5 font-mono text-xs border-2 border-black bg-[#f8fafc] text-black focus:outline-none focus:border-[#3b82f6]"
              />
            </div>

            {/* Demo Credentials Helper Pill */}
            <div className="p-2.5 bg-neutral-100 border border-black font-mono text-[11px] text-neutral-700">
              <span className="font-bold">[DEMO CREDENTIALS]:</span> Pre-filled with seeded admin account (<code>admin@16bits.io</code> / <code>admin123</code>).
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 py-3 font-mono text-xs font-bold bg-black text-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] hover:bg-neutral-800 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {isLoading ? '[AUTHENTICATING...]' : '[AUTHENTICATE OPERATOR]'}
            </button>

            <div className="text-center font-mono text-xs text-neutral-500 mt-2">
              <Link to="/" className="hover:underline text-black font-bold">
                &larr; Return to Home
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
