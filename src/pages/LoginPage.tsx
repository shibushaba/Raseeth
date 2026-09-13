import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Store } from 'lucide-react'

import { useAuth } from '@/features/auth/AuthProvider'
import { homePathFor } from '@/lib/roles'
import { loginSchema } from '@/validation/schemas'

export function LoginPage() {
  const { signIn, session, role, loading } = useAuth()
  const location = useLocation()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session && role) {
    const from = (location.state as { from?: { pathname?: string } } | null)
      ?.from?.pathname
    return <Navigate to={from ?? homePathFor(role)} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = loginSchema.safeParse({ phone, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid credentials')
      return
    }

    setSubmitting(true)
    try {
      await signIn(parsed.data.phone, parsed.data.password)
    } catch {
      setError('Mobile number or password is incorrect.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="bg-accent px-5 pb-10 pt-14 text-center text-white">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
          <Store className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-black">Raseeth</h1>
        <p className="mt-1 text-sm font-medium opacity-70">
          Smart Shop Management
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <h2 className="mt-2 text-center text-lg font-extrabold text-foreground">
          Sign In
        </h2>

        {error ? (
          <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-2.5 text-center text-sm font-semibold text-danger">
            {error}
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted"
            >
              Mobile number
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setError(null)
              }}
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground placeholder-muted outline-none transition-colors focus:border-accent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && void onSubmit(e as unknown as FormEvent)}
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground placeholder-muted outline-none transition-colors focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-accent py-4 text-base font-extrabold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="space-y-1 rounded-2xl border border-border bg-accent-soft/40 p-4 text-xs text-muted">
          <div className="mb-2 font-extrabold text-foreground">Demo accounts</div>
          <div className="flex justify-between">
            <span className="font-semibold">Owner</span>
            <span>9876500001 · DemoOwner123!</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Salesman</span>
            <span>9876500002 · DemoSalesman123!</span>
          </div>
        </div>
      </div>
    </div>
  )
}
