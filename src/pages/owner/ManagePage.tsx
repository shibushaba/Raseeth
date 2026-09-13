import { useQuery } from '@tanstack/react-query'
import { Store } from 'lucide-react'

import { getTeamProfiles } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { logTechnicalError, toUserMessage } from '@/lib/errors'

function roleLabel(role: string): string {
  if (role === 'OWNER') return 'Owner'
  if (role === 'SALESMAN') return 'Salesman'
  return role
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function OwnerManagePage() {
  const { profile } = useAuth()

  const teamQuery = useQuery({
    queryKey: queryKeys.team.profiles,
    queryFn: getTeamProfiles,
  })

  const workers = (teamQuery.data ?? []).filter((p) => p.role === 'SALESMAN')

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pb-2 pt-6">
        <h1 className="text-2xl font-black text-foreground">Team & Shop</h1>
        <p className="text-sm text-muted">Manage your team</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
              <Store className="h-5 w-5 text-accent" aria-hidden />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">Raseeth Shop</div>
              <div className="text-xs text-muted">
                {workers.length} worker{workers.length !== 1 ? 's' : ''}
              </div>
            </div>
            <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[10px] font-bold text-success">
              Active
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-extrabold text-foreground">Team</h3>
            <p className="text-xs text-muted">
              {teamQuery.data?.length ?? 0} members
            </p>
          </div>

          {teamQuery.isLoading ? (
            <div className="space-y-3 p-4" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-accent-soft" />
              ))}
            </div>
          ) : null}

          {teamQuery.error ? (
            <p className="p-4 text-sm text-danger" role="alert">
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
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                    {getInitials(member.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-foreground">
                      {member.full_name}
                    </div>
                    <div className="text-xs text-muted">
                      {roleLabel(member.role)}
                      {member.phone ? ` · ${member.phone}` : ''}
                    </div>
                  </div>
                  {member.id === profile?.id ? (
                    <span className="text-[10px] font-bold text-accent">
                      You
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
