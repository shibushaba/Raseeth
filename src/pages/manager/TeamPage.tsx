import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserPlus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import {
  PortalField,
  PortalTextInput,
} from '@/components/ui/portal-field'
import { addShopSalesman, listMyShopTeam } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useShopScope } from '@/features/shop/useShopScope'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatPhoneDisplay } from '@/lib/phone'
import { addShopSalesmanSchema } from '@/validation/schemas'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ManagerTeamPage() {
  const { profile } = useAuth()
  const { myShop } = useShopScope()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const teamQuery = useQuery({
    queryKey: queryKeys.team.shop(myShop?.id ?? 'mine'),
    queryFn: listMyShopTeam,
    enabled: Boolean(profile),
  })

  const addMutation = useMutation({
    mutationFn: addShopSalesman,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.team.shop(myShop?.id ?? 'mine') })
      await queryClient.invalidateQueries({ queryKey: queryKeys.team.profiles })
      setAddOpen(false)
      setFormError(null)
    },
    onError: (err) => {
      logTechnicalError('addShopSalesman', err)
      setFormError(toUserMessage(err, 'Could not add salesman.'))
    },
  })

  function onAddSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    const fd = new FormData(e.currentTarget)
    const parsed = addShopSalesmanSchema.safeParse({
      full_name: fd.get('full_name'),
      phone: fd.get('phone'),
      password: fd.get('password'),
    })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check the form.')
      return
    }
    addMutation.mutate(parsed.data)
  }

  const members = teamQuery.data ?? []

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pb-2 pt-6">
        <h1 className="text-2xl font-black text-foreground">Shop team</h1>
        <p className="text-sm text-muted">
          {myShop?.name
            ? `Add cashiers to ${myShop.name}`
            : 'Add cashiers to your shop'}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="font-extrabold text-foreground">Salesmen</h3>
              <p className="text-xs text-muted">
                {members.length} on this shop
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormError(null)
                setAddOpen(true)
              }}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add salesman
            </button>
          </div>

          {teamQuery.isLoading ? (
            <div className="space-y-3 p-4" aria-busy="true">
              <div className="h-14 animate-pulse rounded-xl bg-accent-soft" />
            </div>
          ) : null}

          {teamQuery.error ? (
            <p className="p-4 text-sm text-danger" role="alert">
              {toUserMessage(teamQuery.error, 'Unable to load team.')}
            </p>
          ) : null}

          {!teamQuery.isLoading && !teamQuery.error && members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted">
              <UserPlus className="h-8 w-8 text-accent-soft" aria-hidden />
              <p className="text-sm font-semibold">No salesmen yet</p>
              <p className="text-xs">
                Add a cashier so they can sign in with their mobile number.
              </p>
            </div>
          ) : null}

          {!teamQuery.isLoading && !teamQuery.error ? (
            <ul>
              {members.map((member) => (
                <li
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
                      Salesman
                      {member.phone
                        ? ` · ${formatPhoneDisplay(member.phone)}`
                        : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {addOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Add salesman"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-surface px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-foreground">
                Add salesman
              </h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-full p-2 text-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onAddSubmit} className="space-y-4">
              <PortalField label="Full name">
                <PortalTextInput
                  name="full_name"
                  placeholder="e.g. Raj Kumar"
                  required
                />
              </PortalField>
              <PortalField label="Mobile number">
                <PortalTextInput
                  name="phone"
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  required
                />
              </PortalField>
              <PortalField label="Login password">
                <PortalTextInput
                  name="password"
                  type="password"
                  placeholder="At least 6 characters"
                  required
                />
              </PortalField>
              <p className="text-xs text-muted">
                They will sign in on the login screen with this mobile number and
                password.
              </p>
              {formError ? (
                <p className="text-sm text-danger" role="alert">{formError}</p>
              ) : null}
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="w-full rounded-2xl bg-accent py-3.5 font-extrabold text-white disabled:opacity-60"
              >
                {addMutation.isPending ? 'Adding…' : 'Add to shop'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
