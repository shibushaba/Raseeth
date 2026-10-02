/** Demo personas for tap-to-login testing (credentials stay server-side). */

export type DemoPersona = 'owner' | 'cashier' | 'manager'

export type DemoPersonaConfig = {
  id: DemoPersona
  title: string
  subtitle: string
  /** Auth email (tap-login fallback when phone lookup is missing). */
  email: string
  phone: string
  password: string
  entryPath: string
  tone: 'indigo' | 'violet' | 'emerald'
}

export const DEMO_PERSONAS: DemoPersonaConfig[] = [
  {
    id: 'owner',
    title: 'Owner',
    subtitle: 'All shops, staff & performance',
    email: 'owner@raseeth.demo',
    phone: '9876500001',
    password: 'DemoOwner123!',
    entryPath: '/overview',
    tone: 'indigo',
  },
  {
    id: 'cashier',
    title: 'Salesman',
    subtitle: 'POS and today sales',
    email: 'salesman@raseeth.demo',
    phone: '9876500002',
    password: 'DemoSalesman123!',
    entryPath: '/home',
    tone: 'violet',
  },
  {
    id: 'manager',
    title: 'Stock manager',
    subtitle: 'Inventory, products & stock for your shop',
    email: 'manager@raseeth.demo',
    phone: '9876500003',
    password: 'DemoManager123!',
    entryPath: '/manager/home',
    tone: 'emerald',
  },
]

export function demoPersonaById(id: DemoPersona): DemoPersonaConfig {
  const found = DEMO_PERSONAS.find((p) => p.id === id)
  if (!found) throw new Error(`Unknown demo persona: ${id}`)
  return found
}
