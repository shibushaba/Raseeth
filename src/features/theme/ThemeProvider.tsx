import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  getInitialTheme,
  persistTheme,
  readStoredTheme,
  type ThemePreference,
} from '@/lib/theme'

type ThemeContextValue = {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => getInitialTheme())

  useEffect(() => {
    persistTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    persistTheme(next)
  }, [])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}

/** Read theme without provider (login screen). */
export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext)
}

export function syncThemeFromStorage(): ThemePreference {
  const stored = readStoredTheme()
  const initial = getInitialTheme()
  if (stored) persistTheme(stored)
  else persistTheme(initial)
  return stored ?? initial
}
