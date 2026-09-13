import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { PortalBackBar } from '@/components/ui/portal-field'
import { useAuth } from '@/features/auth/AuthProvider'
import { homePathFor } from '@/lib/roles'

export function SettingsPage() {
  const navigate = useNavigate()
  const { signOut, profile, role } = useAuth()

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PortalBackBar
        title="Settings"
        onBack={() => navigate(role ? homePathFor(role) : '/')}
      />

      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">
            Account
          </div>
          <div className="mt-2 text-lg font-extrabold text-foreground">
            {profile?.full_name ?? 'User'}
          </div>
          <div className="text-sm font-medium text-muted">
            {profile?.role === 'OWNER' ? 'Owner' : 'Salesman'}
            {profile?.phone ? ` · ${profile.phone}` : ''}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-danger-soft py-4 text-sm font-extrabold text-danger transition-colors hover:bg-danger-soft"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  )
}
