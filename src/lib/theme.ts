export const THEME_STORAGE_KEY = 'raseeth-theme'

export type ThemePreference = 'light'

export function parseThemePreference(_value: string | null): ThemePreference {
  return 'light'
}

export function readStoredTheme(): ThemePreference {
  return 'light'
}

export function resolveTheme(): ThemePreference {
  return 'light'
}

export function applyThemeToDocument(_theme: ThemePreference): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = 'light'
}

export function persistTheme(theme: ThemePreference): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyThemeToDocument(theme)
}

export function getInitialTheme(): ThemePreference {
  return 'light'
}
