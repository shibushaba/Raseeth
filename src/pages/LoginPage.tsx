import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  LineChart,
  ShoppingCart,
  Store,
  UserCog,
} from 'lucide-react'

import { useAuth } from '@/features/auth/AuthProvider'
import { clearDemoEntryPath, consumeDemoEntryPath } from '@/lib/demo-entry'
import { DEMO_PERSONAS, type DemoPersona } from '@/lib/demo-users'
import { homePathFor } from '@/lib/roles'
import { cn } from '@/lib/utils'

const PERSONA_ICONS = {
  owner: LineChart,
  cashier: ShoppingCart,
  manager: UserCog,
} as const

const TONE_STYLES = {
  indigo: 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100',
  violet: 'border-violet-200 bg-violet-50 hover:bg-violet-100',
  emerald: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
} as const

export function LoginPage() {
  const { signInAsDemo, session, role, loading } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<DemoPersona | null>(null)

  if (!loading && session && role) {
    const from = (location.state as { from?: { pathname?: string } } | null)
      ?.from?.pathname
    const demoEntry = consumeDemoEntryPath()
    return (
      <Navigate to={from ?? demoEntry ?? homePathFor(role)} replace />
    )
  }

  async function pick(persona: DemoPersona) {
    setError(null)
    setSubmitting(persona)
    try {
      await signInAsDemo(persona)
    } catch (err) {
      clearDemoEntryPath()
      const msg =
        err instanceof Error ? err.message : 'Could not sign in.'
      const lower = msg.toLowerCase()
      if (lower.includes('fetch') || lower.includes('network')) {
        setError(
          'Cannot reach Supabase. Check VITE_SUPABASE_URL in .env.local and your internet connection.',
        )
      } else if (
        lower.includes('invalid login') ||
        lower.includes('no account')
      ) {
        setError(
          'Demo user missing or wrong password. In the project folder run: npm run demo:ensure-auth (needs SUPABASE_SERVICE_ROLE_KEY in .env.local).',
        )
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F3FF]">
      <div className="bg-violet-600 px-5 pb-10 pt-14 text-center text-white">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
          <Store className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-black">Raseeth</h1>
        <p className="mt-1 text-sm font-medium opacity-70">
          Retail Management System
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <h2 className="mt-2 text-center text-lg font-extrabold text-gray-700">
          Choose user
        </h2>
        <p className="text-center text-xs font-medium text-gray-400">
          Tap a role to start testing. Sign out anytime to switch.
        </p>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-center text-sm font-semibold text-red-600">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          {DEMO_PERSONAS.map((persona) => {
            const Icon = PERSONA_ICONS[persona.id]
            const busy = submitting === persona.id
            return (
              <button
                key={persona.id}
                type="button"
                disabled={Boolean(submitting)}
                onClick={() => void pick(persona.id)}
                className={cn(
                  'flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left shadow-sm transition-colors active:scale-[0.99] disabled:opacity-60',
                  TONE_STYLES[persona.tone],
                )}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Icon className="h-6 w-6 text-gray-700" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold text-gray-800">
                    {persona.title}
                  </div>
                  <div className="text-xs font-medium text-gray-500">
                    {persona.subtitle}
                  </div>
                </div>
                <span className="text-sm font-bold text-violet-700">
                  {busy ? '…' : '→'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 text-center">
        <p className="text-xs font-medium text-gray-300">
          Shop POS UI · Demo mode
        </p>
      </div>
    </div>
  )
}
