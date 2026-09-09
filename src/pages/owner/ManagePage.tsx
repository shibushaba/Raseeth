import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ShoppingCart, Store, User } from 'lucide-react'

import { PortalHeader } from '@/components/layout/portal/PortalHeader'
import { getTeamProfiles } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { logTechnicalError, toUserMessage } from '@/lib/errors'

function roleLabel(role: string): string {
  if (role === 'OWNER') return 'Owner'
  if (role === 'SALESMAN') return 'Salesman'
  return role
}

function RoleIcon({ role }: { role: string }) {
  if (role === 'OWNER') {
    return <Store className="h-4 w-4 text-indigo-700" aria-hidden />
  }
  return <ShoppingCart className="h-4 w-4 text-indigo-700" aria-hidden />
}

export function OwnerManagePage() {
  const { profile, signOut } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Owner'

  const teamQuery = useQuery({
    queryKey: queryKeys.team.profiles,
    queryFn: getTeamProfiles,
  })

  const workers = (teamQuery.data ?? []).filter((p) => p.role === 'SALESMAN')

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <PortalHeader
        tone="indigo"
        subtitle="Owner"
        title={`Hi, ${firstName}`}
        onLogout={() => void signOut()}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-violet-50 px-4 py-3">
            <div>
              <h3 className="font-extrabold text-gray-700">Shop</h3>
              <p className="text-xs text-gray-400">Single-shop pilot</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
              <Store className="h-5 w-5 text-indigo-700" aria-hidden />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-gray-800">Raseeth Shop</div>
              <div className="text-xs text-gray-400">
                {workers.length} worker{workers.length !== 1 ? 's' : ''}
              </div>
            </div>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              Active
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
          <div className="border-b border-violet-50 px-4 py-3">
            <h3 className="font-extrabold text-gray-700">Team</h3>
            <p className="text-xs text-gray-400">
              {teamQuery.data?.length ?? 0} members
            </p>
          </div>

          {teamQuery.isLoading ? (
            <div className="space-y-3 p-4" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-indigo-50" />
              ))}
            </div>
          ) : null}

          {teamQuery.error ? (
            <p className="p-4 text-sm text-red-600" role="alert">
              {(() => {
                logTechnicalError('getTeamProfiles', teamQuery.error)
                return toUserMessage(
                  teamQuery.error,
                  'Unable to load team members.',
                )
              })()}
            </p>
          ) : null}

          {!teamQuery.isLoading && !teamQuery.error ? (
            <div>
              {(teamQuery.data ?? []).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100">
                    <RoleIcon role={member.role} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-gray-800">
                      {member.full_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {roleLabel(member.role)}
                      {member.phone ? ` · ${member.phone}` : ''}
                    </div>
                  </div>
                  {member.id === profile?.id ? (
                    <span className="text-[10px] font-bold text-indigo-600">
                      You
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-xs text-gray-500">
          <div className="mb-1 flex items-center gap-2 font-extrabold text-indigo-700">
            <User className="h-3.5 w-3.5" aria-hidden />
            Adding workers
          </div>
          <p>
            New team members are created in Supabase Auth and assigned a profile
            with the Salesman role. Contact your administrator to add accounts.
          </p>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
            Quick links
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/activity"
              className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-3 text-center text-xs font-bold text-violet-700"
            >
              Activity
            </Link>
            <Link
              to="/messages"
              className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-3 text-center text-xs font-bold text-violet-700"
            >
              Messages
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
