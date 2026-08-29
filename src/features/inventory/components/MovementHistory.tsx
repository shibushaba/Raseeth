import type { InventoryMovementWithActor } from '@/data/api'
import { formatDateTime, formatSignedQty } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { MovementType } from '@/types/database'
import { cn } from '@/lib/utils'

function movementLabel(type: MovementType): string {
  switch (type) {
    case 'PURCHASE':
      return 'Purchase'
    case 'SALE':
      return 'Sale'
    case 'ADJUSTMENT':
      return 'Stock fix'
    case 'RETURN':
      return 'Return'
  }
}

export function MovementHistory({
  movements,
  isLoading,
  errorMessage,
}: {
  movements: InventoryMovementWithActor[] | undefined
  isLoading: boolean
  errorMessage?: string | null
}) {
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse bg-neutral-100" />
        ))}
      </div>
    )
  }

  if (errorMessage) {
    return <p className="text-sm text-red-700">{errorMessage}</p>
  }

  if (!movements?.length) {
    return (
      <p className="border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-600">
        No inventory activity yet.
      </p>
    )
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-strong text-xs uppercase tracking-wide text-neutral-600">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Type</th>
              <th className="py-2 pr-3 font-medium text-right">Qty</th>
              <th className="py-2 pr-3 font-medium text-right">Cost</th>
              <th className="py-2 pr-3 font-medium">Note</th>
              <th className="py-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b border-neutral-200 align-top">
                <td className="py-3 pr-3 whitespace-nowrap text-neutral-700">
                  {formatDateTime(m.created_at)}
                </td>
                <td className="py-3 pr-3">
                  <MovementTypeLabel type={m.movement_type} />
                </td>
                <td
                  className={cn(
                    'py-3 pr-3 text-right tabular-nums font-medium',
                    m.quantity < 0 && 'text-neutral-700',
                  )}
                >
                  {formatSignedQty(m.quantity)}
                </td>
                <td className="py-3 pr-3 text-right tabular-nums text-neutral-700">
                  {m.unit_cost != null && m.movement_type === 'PURCHASE'
                    ? formatMoney(m.unit_cost)
                    : '—'}
                </td>
                <td className="py-3 pr-3 text-neutral-700">
                  {m.notes ?? '—'}
                </td>
                <td className="py-3 text-neutral-600">
                  {m.created_by_name ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-4 md:hidden">
        {movements.map((m) => (
          <li key={m.id} className="border-b border-neutral-200 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <MovementTypeLabel type={m.movement_type} />
                <p className="mt-1 text-xs text-neutral-500">
                  {formatDateTime(m.created_at)}
                </p>
              </div>
              <p
                className={cn(
                  'tabular-nums text-base font-medium',
                  m.quantity < 0 && 'text-neutral-700',
                )}
              >
                {formatSignedQty(m.quantity)}
              </p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-neutral-500">Cost</dt>
                <dd className="tabular-nums">
                  {m.unit_cost != null && m.movement_type === 'PURCHASE'
                    ? formatMoney(m.unit_cost)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">By</dt>
                <dd>{m.created_by_name ?? '—'}</dd>
              </div>
              {m.notes ? (
                <div className="col-span-2">
                  <dt className="text-xs text-neutral-500">Note</dt>
                  <dd className="text-neutral-700">{m.notes}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}

function MovementTypeLabel({ type }: { type: MovementType }) {
  return (
    <span
      className={cn(
        'text-sm font-medium',
        type === 'ADJUSTMENT' && 'text-neutral-800',
        type === 'SALE' && 'text-neutral-700',
        type === 'PURCHASE' && 'text-black',
      )}
    >
      {movementLabel(type)}
    </span>
  )
}
