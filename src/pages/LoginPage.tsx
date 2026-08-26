import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/AuthProvider'
import { toUserMessage } from '@/lib/errors'
import { homePathFor } from '@/lib/roles'
import { loginSchema } from '@/validation/schemas'

export function LoginPage() {
  const { signIn, session, role, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
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

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid credentials')
      return
    }

    setSubmitting(true)
    try {
      await signIn(parsed.data.email, parsed.data.password)
    } catch (err) {
      setError(toUserMessage(err, 'Unable to sign in. Check your email and password.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-background px-4">
      <div className="panel mx-auto w-full max-w-sm px-5 py-6">
        <p className="text-xl font-semibold tracking-tight">RASEETH</p>
        <p className="mt-1 text-sm text-muted">Sign in to continue.</p>

        <form className="mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
