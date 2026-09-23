import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getCurrentUser, clearAuthSession, checkBackendHealth } from '../services/api'
import type { User, HealthStatus } from '../services/api'

export const Navbar: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setCurrentUser(getCurrentUser())
    checkBackendHealth().then(setHealth).catch(() => setHealth(null))
  }, [location.pathname])

  const handleLogout = () => {
    clearAuthSession()
    setCurrentUser(null)
    navigate('/')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 bg-white border-b-4 border-black px-4 py-3 shadow-[0_4px_0_0_rgba(0,0,0,0.1)]">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 no-underline text-black hover:opacity-90 transition-opacity">
          <img
            src="/assets/logo-pixel.svg"
            alt="16Bits OmniOps"
            className="w-8 h-8 rendering-pixelated"
          />
          <div className="flex flex-col">
            <span className="font-press-start text-xs tracking-wider text-black">
              16BITS <span className="text-[#3b82f6]">OMNIOPS</span>
            </span>
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-tight">
              Enterprise SRE Swarm
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <Link
            to="/"
            className={`px-3 py-1.5 font-mono text-xs font-bold border-2 border-black transition-all ${
              isActive('/')
                ? 'bg-black text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]'
                : 'bg-neutral-100 text-black hover:bg-neutral-200'
            }`}
          >
            HOME
          </Link>
          <a
            href="/#roi"
            className="px-3 py-1.5 font-mono text-xs font-bold border-2 border-black bg-neutral-100 text-black hover:bg-neutral-200 transition-all"
          >
            BUSINESS ROI
          </a>
          <Link
            to="/console"
            className={`px-3 py-1.5 font-mono text-xs font-bold border-2 border-black transition-all ${
              isActive('/console')
                ? 'bg-[#3b82f6] text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            CONSOLE
          </Link>
          <Link
            to="/docs"
            className={`px-3 py-1.5 font-mono text-xs font-bold border-2 border-black transition-all ${
              isActive('/docs')
                ? 'bg-black text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]'
                : 'bg-neutral-100 text-black hover:bg-neutral-200'
            }`}
          >
            SKILL &amp; DOCS
          </Link>
          <a
            href="/#faq"
            className="hidden md:inline-block px-3 py-1.5 font-mono text-xs font-bold border-2 border-black bg-neutral-100 text-black hover:bg-neutral-200 transition-all"
          >
            FAQ
          </a>
          <a
            href="/#contact"
            className="hidden md:inline-block px-3 py-1.5 font-mono text-xs font-bold border-2 border-black bg-neutral-100 text-black hover:bg-neutral-200 transition-all"
          >
            CONTACT
          </a>
        </nav>

        {/* Right Status / Auth */}
        <div className="flex items-center gap-2">
          {health && (
            <span
              className={`hidden lg:inline-block px-2 py-1 text-[10px] font-mono font-bold border border-black uppercase ${
                health.is_mock
                  ? 'bg-amber-100 text-amber-900 border-amber-500'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-500'
              }`}
            >
              {health.is_mock ? '[MOCK ENGINE]' : `[AI: ${health.ai_provider || 'LIVE'}]`}
            </span>
          )}

          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block font-mono text-xs bg-neutral-100 border border-black px-2 py-1">
                [OPERATOR: {currentUser.name.toUpperCase()}]
              </span>
              <button
                onClick={handleLogout}
                className="px-2.5 py-1 font-mono text-xs font-bold border-2 border-black bg-rose-100 text-rose-800 hover:bg-rose-200 active:translate-y-0.5"
              >
                LOGOUT
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-3 py-1 font-mono text-xs font-bold border-2 border-black bg-emerald-400 text-black hover:bg-emerald-300 shadow-[2px_2px_0_0_#000] active:translate-y-0.5 transition-transform"
            >
              OPERATOR LOGIN
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
