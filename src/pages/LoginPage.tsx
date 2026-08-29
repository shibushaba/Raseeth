import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { useAuth } from '@/features/auth/AuthProvider'
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
    } catch {
      setError('Email or password is incorrect.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-background px-4">
      <Card className="mx-auto w-full max-w-sm">
        <CardBody className="py-8">
          <div className="text-center">
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              RASEETH
            </p>
            <p className="mt-2 text-sm text-muted">
              Your business, simply managed.
            </p>
          </div>

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
              <PasswordInput
                id="password"
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

            <Button
              type="submit"
              variant="accent"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
