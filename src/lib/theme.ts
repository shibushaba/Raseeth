export const THEME_STORAGE_KEY = 'raseeth-theme'

export type ThemePreference = 'light' | 'dark'

export function parseThemePreference(value: string | null): ThemePreference | null {
  if (value === 'light' || value === 'dark') return value
  return null
}

export function readStoredTheme(): ThemePreference | null {
  if (typeof window === 'undefined') return null
  return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
}

export function resolveTheme(
  stored: ThemePreference | null,
  prefersDark = false,
): ThemePreference {
  if (stored) return stored
  return prefersDark ? 'dark' : 'light'
}

export function applyThemeToDocument(theme: ThemePreference): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function persistTheme(theme: ThemePreference): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyThemeToDocument(theme)
}

export function getInitialTheme(): ThemePreference {
  const stored = readStoredTheme()
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return resolveTheme(stored, prefersDark)
}
