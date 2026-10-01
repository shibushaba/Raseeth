import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus, Store, UserCog, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import {
  PortalField,
  PortalTextInput,
} from '@/components/ui/portal-field'
import { PasswordInput } from '@/components/ui/password-input'
import {
  assignShopManager,
  createShopWithManager,
  getShops,
  getTeamProfiles,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { createShopWithManagerSchema } from '@/validation/schemas'

function roleLabel(role: string): string {
  if (role === 'OWNER') return 'Owner'
  if (role === 'MANAGER') return 'Manager'
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
  const queryClient = useQueryClient()
  const [addShopOpen, setAddShopOpen] = useState(false)
  const [assignShopId, setAssignShopId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const teamQuery = useQuery({
    queryKey: queryKeys.team.profiles,
    queryFn: getTeamProfiles,
  })

  const shopsQuery = useQuery({
    queryKey: queryKeys.shops.all,
    queryFn: getShops,
  })

  const managerCandidates = (teamQuery.data ?? []).filter(
    (p) => p.role === 'SALESMAN' || p.role === 'MANAGER',
  )
  const assignShop = (shopsQuery.data ?? []).find((s) => s.id === assignShopId)

  const invalidateShops = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.shops.all })

  const createShopMutation = useMutation({
    mutationFn: (input: {
      name: string
      manager_name: string
      manager_phone: string
      manager_password: string
    }) => createShopWithManager(input),
    onSuccess: async () => {
      await invalidateShops()
      setAddShopOpen(false)
      setFormError(null)
    },
    onError: (err) => {
      logTechnicalError('createShop', err)
      setFormError(toUserMessage(err, 'Unable to create shop.'))
    },
  })

  const assignManagerMutation = useMutation({
    mutationFn: ({
      shopId,
      managerId,
    }: {
      shopId: string
      managerId: string | null
    }) => assignShopManager(shopId, managerId),
    onSuccess: async () => {
      await invalidateShops()
      setAssignShopId(null)
      setFormError(null)
    },
    onError: (err) => {
      logTechnicalError('assignShopManager', err)
      setFormError(toUserMessage(err, 'Unable to assign manager.'))
    },
  })

  function onAddShopSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    const fd = new FormData(e.currentTarget)
    const parsed = createShopWithManagerSchema.safeParse({
      name: fd.get('name'),
      manager_name: fd.get('manager_name'),
      manager_phone: fd.get('manager_phone'),
      manager_password: fd.get('manager_password'),
    })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check the form.')
      return
    }
    createShopMutation.mutate(parsed.data)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pb-2 pt-6">
        <h1 className="text-2xl font-black text-foreground">Team & Shop</h1>
        <p className="text-sm text-muted">Manage your team</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="font-extrabold text-foreground">Shops</h3>
              <p className="text-xs text-muted">
                {shopsQuery.data?.length ?? 0} location
                {(shopsQuery.data?.length ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormError(null)
                setAddShopOpen(true)
              }}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add shop
            </button>
          </div>

          {shopsQuery.isLoading ? (
            <div className="space-y-3 p-4" aria-busy="true">
              <div className="h-14 animate-pulse rounded-xl bg-accent-soft" />
            </div>
          ) : null}

          {shopsQuery.error ? (
            <p className="p-4 text-sm text-danger" role="alert">
              {(() => {
                logTechnicalError('getShops', shopsQuery.error)
                return toUserMessage(
                  shopsQuery.error,
                  'Unable to load shops.',
                )
              })()}
            </p>
          ) : null}

          {!shopsQuery.isLoading && !shopsQuery.error ? (
            <div>
              {(shopsQuery.data ?? []).length === 0 ? (
                <p className="p-4 text-sm text-muted">
                  No shops yet. Add your first location.
                </p>
              ) : null}
              {(shopsQuery.data ?? []).map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => {
                    setFormError(null)
                    setAssignShopId(shop.id)
                  }}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-left last:border-0 active:bg-accent-soft/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                    <Store className="h-5 w-5 text-accent" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-foreground">
                      {shop.name}
                    </div>
                    <div className="text-xs text-muted">
                      {shop.worker_count} worker
                      {shop.worker_count !== 1 ? 's' : ''}
                      {shop.manager_name
                        ? ` · Manager: ${shop.manager_name}`
                        : ' · No manager assigned'}
                    </div>
                  </div>
                  {shop.is_active ? (
                    <span className="hidden rounded-full bg-success-soft px-2.5 py-0.5 text-[10px] font-bold text-success sm:inline">
                      Active
                    </span>
                  ) : null}
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted"
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          ) : null}
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
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-accent-soft"
                />
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

      {addShopOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Add shop"
          onClick={() => setAddShopOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-surface px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-foreground">
                Create shop & manager
              </h2>
              <button
                type="button"
                onClick={() => setAddShopOpen(false)}
                className="rounded-full p-2 text-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onAddShopSubmit} className="space-y-4">
              <PortalField label="Shop name">
                <PortalTextInput
                  name="name"
                  placeholder="e.g. Kozhikode Main"
                  required
                />
              </PortalField>
              <p className="text-xs font-bold text-muted">Manager</p>
              <PortalField label="Name">
                <PortalTextInput
                  name="manager_name"
                  placeholder="Ahmed"
                  required
                />
              </PortalField>
              <PortalField label="Mobile number">
                <PortalTextInput
                  name="manager_phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  required
                />
              </PortalField>
              <PortalField label="Password">
                <PasswordInput
                  name="manager_password"
                  placeholder="At least 6 characters"
                  required
                  autoComplete="new-password"
                />
              </PortalField>
              {formError ? (
                <p className="text-sm text-danger" role="alert">{formError}</p>
              ) : null}
              <button
                type="submit"
                disabled={createShopMutation.isPending}
                className="w-full rounded-2xl bg-accent py-3.5 font-extrabold text-white disabled:opacity-60"
              >
                {createShopMutation.isPending
                  ? 'Creating…'
                  : 'Create shop & manager'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {assignShop && assignShopId ? (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Assign shop manager"
          onClick={() => setAssignShopId(null)}
        >
          <div
            className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-5 pb-2 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-extrabold text-foreground">
                    <UserCog className="h-4 w-4 text-accent" aria-hidden />
                    Assign manager
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{assignShop.name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignShopId(null)}
                  className="rounded-full p-2 text-muted"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
              {managerCandidates.length === 0 ? (
                <p className="text-sm text-muted">
                  Add a cashier to your team before assigning a manager.
                </p>
              ) : (
                <ul className="space-y-2">
                  {managerCandidates.map((person) => {
                    const selected = assignShop.manager_id === person.id
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          disabled={assignManagerMutation.isPending}
                          onClick={() =>
                            assignManagerMutation.mutate({
                              shopId: assignShop.id,
                              managerId: person.id,
                            })
                          }
                          className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                            selected
                              ? 'border-accent bg-accent-soft'
                              : 'border-border bg-background'
                          }`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                            {getInitials(person.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-foreground">
                              {person.full_name}
                            </div>
                            <div className="text-xs text-muted">
                              {roleLabel(person.role)}
                              {person.phone ? ` · ${person.phone}` : ''}
                            </div>
                          </div>
                          {selected ? (
                            <span className="text-[10px] font-bold text-accent">
                              Manager
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {assignShop.manager_id ? (
                <button
                  type="button"
                  disabled={assignManagerMutation.isPending}
                  onClick={() =>
                    assignManagerMutation.mutate({
                      shopId: assignShop.id,
                      managerId: null,
                    })
                  }
                  className="mt-4 w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted"
                >
                  Remove manager
                </button>
              ) : null}

              {formError ? (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
