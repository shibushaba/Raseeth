import { Link, useNavigate } from 'react-router-dom'
import { Activity, LogOut, MessageSquare } from 'lucide-react'

import { ThemeSelector } from '@/components/settings/ThemeSelector'
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
        <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-gray-400">
            Account
          </div>
          <div className="mt-2 text-lg font-extrabold text-gray-800">
            {profile?.full_name ?? 'User'}
          </div>
          <div className="text-sm font-medium text-gray-500">
            {profile?.role === 'OWNER' ? 'Owner' : 'Salesman'}
            {profile?.phone ? ` · ${profile.phone}` : ''}
          </div>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">
            Appearance
          </div>
          <ThemeSelector />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/activity"
            className="flex flex-col items-center gap-2 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
          >
            <Activity className="h-5 w-5 text-violet-600" aria-hidden />
            <span className="text-xs font-bold text-gray-700">Activity</span>
          </Link>
          <Link
            to="/messages"
            className="flex flex-col items-center gap-2 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
          >
            <MessageSquare className="h-5 w-5 text-violet-600" aria-hidden />
            <span className="text-xs font-bold text-gray-700">Messages</span>
          </Link>
        </div>

        {role === 'OWNER' ? (
          <Link
            to="/manage"
            className="block rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-center text-sm font-extrabold text-indigo-700"
          >
            Team & Shop
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-200 py-4 text-sm font-extrabold text-red-600"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  )
}
