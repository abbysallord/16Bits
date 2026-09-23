import React, { createContext, useContext, useEffect, useState } from 'react'
import { Palette } from 'lucide-react'

export type ThemeName = 'retro' | 'mission'

export const THEMES: Array<{ id: ThemeName; label: string; hint: string }> = [
  { id: 'retro', label: '8-BIT RETRO', hint: 'NES cartridge aesthetic · pixel fonts · hard shadows' },
  { id: 'mission', label: 'MISSION CTRL', hint: 'Houston flight-control · deep space blue · instrument glow' },
]

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'omniops_theme'

function readStoredTheme(): ThemeName {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'mission' || raw === 'retro' ? raw : 'retro'
  } catch {
    return 'retro'
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => readStoredTheme())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // private mode: theme just won't persist
    }
  }, [theme])

  const value: ThemeContextValue = {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === 'retro' ? 'mission' : 'retro')),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

/** Header control: cycles between the two visual identities. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const next = THEMES.find((t) => t.id !== theme)!
  return (
    <button
      type="button"
      className="btn btn-xs"
      onClick={toggle}
      title={`Switch theme: ${next.hint}`}
      aria-label={`Switch to ${next.label} theme`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Palette size={12} />
      <span className="font-display" style={{ fontSize: 8 }}>
        {next.label}
      </span>
    </button>
  )
}
