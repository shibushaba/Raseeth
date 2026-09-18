/** Demo personas for tap-to-login testing (credentials stay server-side). */

export type DemoPersona = 'owner' | 'cashier' | 'manager'

export type DemoPersonaConfig = {
  id: DemoPersona
  title: string
  subtitle: string
  phone: string
  password: string
  entryPath: string
  tone: 'indigo' | 'violet' | 'emerald'
}

export const DEMO_PERSONAS: DemoPersonaConfig[] = [
  {
    id: 'owner',
    title: 'Owner',
    subtitle: 'All shops, revenue & managers',
    phone: '9876500001',
    password: 'DemoOwner123!',
    entryPath: '/overview',
    tone: 'indigo',
  },
  {
    id: 'cashier',
    title: 'Cashier',
    subtitle: 'POS & recent sales',
    phone: '9876500002',
    password: 'DemoSalesman123!',
    entryPath: '/sales',
    tone: 'violet',
  },
  {
    id: 'manager',
    title: 'Manager',
    subtitle: 'Run your shop — sales, stock & trends',
    phone: '9876500003',
    password: 'DemoManager123!',
    entryPath: '/overview',
    tone: 'emerald',
  },
]

export function demoPersonaById(id: DemoPersona): DemoPersonaConfig {
  const found = DEMO_PERSONAS.find((p) => p.id === id)
  if (!found) throw new Error(`Unknown demo persona: ${id}`)
  return found
}
