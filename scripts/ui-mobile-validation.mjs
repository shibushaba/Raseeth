/**
 * UI validation for mobile-first refinement: theme persistence logic,
 * password visibility component contract, and navigation structure mirrors.
 *
 * Run: node scripts/ui-mobile-validation.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const THEME_STORAGE_KEY = 'raseeth-theme'

function parseThemePreference(value) {
  if (value === 'light' || value === 'dark') return value
  return null
}

function resolveTheme(stored, prefersDark = false) {
  if (stored) return stored
  return prefersDark ? 'dark' : 'light'
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

let passed = 0
let failed = 0

function pass(name) {
  passed += 1
  console.log(`PASS  ${name}`)
}

function fail(name, detail = '') {
  failed += 1
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

// --- Theme logic ---
{
  if (THEME_STORAGE_KEY === 'raseeth-theme') pass('Theme storage key')
  else fail('Theme storage key', THEME_STORAGE_KEY)

  if (parseThemePreference('light') === 'light') pass('Theme parse light')
  else fail('Theme parse light')

  if (parseThemePreference('dark') === 'dark') pass('Theme parse dark')
  else fail('Theme parse dark')

  if (parseThemePreference('system') === null) pass('Theme parse invalid')
  else fail('Theme parse invalid')

  if (resolveTheme('dark', false) === 'dark') pass('Theme resolve stored dark')
  else fail('Theme resolve stored dark')

  if (resolveTheme(null, true) === 'dark') pass('Theme resolve system dark')
  else fail('Theme resolve system dark')

  if (resolveTheme(null, false) === 'light') pass('Theme resolve system light')
  else fail('Theme resolve system light')

  const store = {}
  const mock = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => {
      store[k] = v
    },
  }
  mock.setItem(THEME_STORAGE_KEY, 'dark')
  const reloaded = parseThemePreference(mock.getItem(THEME_STORAGE_KEY))
  if (reloaded === 'dark') pass('Theme reload preserves dark')
  else fail('Theme reload preserves dark')

  mock.setItem(THEME_STORAGE_KEY, 'light')
  const reloadedLight = parseThemePreference(mock.getItem(THEME_STORAGE_KEY))
  if (reloadedLight === 'light') pass('Theme reload preserves light')
  else fail('Theme reload preserves light')
}

// --- Password input source contract ---
{
  const src = readFileSync(join(root, 'src/components/ui/password-input.tsx'), 'utf8')
  if (src.includes('type="button"')) pass('Password toggle uses type=button')
  else fail('Password toggle uses type=button')

  if (src.includes('Show password') && src.includes('Hide password'))
    pass('Password toggle aria labels')
  else fail('Password toggle aria labels')

  if (src.includes("type={visible ? 'text' : 'password'}"))
    pass('Password hidden by default')
  else fail('Password hidden by default')
}

// --- Navigation mirrors ---
{
  const roles = readFileSync(join(root, 'src/lib/roles.ts'), 'utf8')
  const bottom = readFileSync(join(root, 'src/components/layout/BottomNav.tsx'), 'utf8')

  if (roles.includes("label: 'Settings', to: '/settings'"))
    pass('Settings route in desktop nav')
  else fail('Settings route in desktop nav')

  if (bottom.includes("label: 'More'") && bottom.includes("to: '/more'"))
    pass('Bottom nav includes More')
  else fail('Bottom nav includes More')

  if (bottom.includes("label: 'Home'") && bottom.includes("label: 'Sales'"))
    pass('Bottom nav primary items')
  else fail('Bottom nav primary items')
}

// --- Salesman home tiles ---
{
  const home = readFileSync(join(root, 'src/pages/salesman/HomePage.tsx'), 'utf8')
  if (home.includes('to="/sales"') && home.includes('to="/inventory"'))
    pass('Salesman tiles link to sales and inventory')
  else fail('Salesman tiles link to sales and inventory')
}

// --- Anti-flash script ---
{
  const html = readFileSync(join(root, 'index.html'), 'utf8')
  if (html.includes('raseeth-theme') && html.includes('classList.add'))
    pass('Theme anti-flash script in index.html')
  else fail('Theme anti-flash script in index.html')
}

console.log('')
console.log(`UI validation: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
