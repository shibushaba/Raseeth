import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@/features/auth/AuthProvider'
import { homePathFor } from '@/lib/roles'
import type { UserRole } from '@/types/database'

export function ProtectedRoute() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Profile missing</h1>
        <p className="mt-2 text-sm text-muted">
          Your account has no profile row. Ask an administrator to repair
          public.profiles for this user.
        </p>
      </div>
    )
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function RoleRoute({ allow }: { allow: UserRole[] }) {
  const { role } = useAuth()

  if (!role) return null

  if (!allow.includes(role)) {
    return <Navigate to={homePathFor(role)} replace />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    )
  }

  if (session && role) {
    return <Navigate to={homePathFor(role)} replace />
  }

  return <Outlet />
}
