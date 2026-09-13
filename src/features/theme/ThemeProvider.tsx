import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'

import {
  applyThemeToDocument,
  type ThemePreference,
} from '@/lib/theme'

type ThemeContextValue = {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  applyThemeToDocument('light')

  const value = useMemo(
    () => ({ theme: 'light' as const, setTheme: () => {} }),
    [],
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
  return 'light'
}
