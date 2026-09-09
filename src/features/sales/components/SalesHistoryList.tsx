import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt } from 'lucide-react'

import { getSale, getSales } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { OwnerBillSheet } from '@/features/owner/components/OwnerBillSheet'
import { dayGroupLabel, formatTime, localDayBounds } from '@/lib/datetime'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import type { SaleWithSeller } from '@/data/api'

function groupSalesByDay(sales: SaleWithSeller[]) {
  const map = new Map<string, { label: string; items: SaleWithSeller[] }>()
  for (const sale of sales) {
    const dayKey = localDayBounds(new Date(sale.created_at)).dayKey
    const existing = map.get(dayKey)
    if (existing) {
      existing.items.push(sale)
    } else {
      map.set(dayKey, {
        label: dayGroupLabel(sale.created_at),
        items: [sale],
      })
    }
  }
  return Array.from(map.values())
}

export function SalesHistoryList({
  ownerMode = false,
}: {
  ownerMode?: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const salesQuery = useQuery({
    queryKey: queryKeys.sales.list,
    queryFn: getSales,
  })

  const detailQuery = useQuery({
    queryKey: queryKeys.sales.detail(selectedId ?? ''),
    queryFn: () => getSale(selectedId!),
    enabled: ownerMode && Boolean(selectedId),
  })

  if (salesQuery.isLoading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-violet-50" />
        ))}
      </div>
    )
  }

  if (salesQuery.error) {
    logTechnicalError('getSales', salesQuery.error)
    return (
      <p className="p-4 text-sm text-red-600" role="alert">
        {toUserMessage(salesQuery.error, 'Unable to load sales.')}
      </p>
    )
  }

  const sales = salesQuery.data ?? []

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-gray-400">
        <Receipt className="h-8 w-8" aria-hidden />
        <p className="font-semibold">No sales yet</p>
      </div>
    )
  }

  const groups = groupSalesByDay(sales)

  return (
    <>
      <div className="space-y-4 p-4">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-gray-400">
              {group.label}
            </h2>
            <div className="space-y-3">
              {group.items.map((sale) =>
                ownerMode ? (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => setSelectedId(sale.id)}
                    className="w-full rounded-2xl border border-violet-100 bg-white p-4 text-left shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-800">
                          {sale.sale_number}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          {formatTime(sale.created_at)}
                          {sale.created_by_name ? ` · ${sale.created_by_name}` : ''}
                        </div>
                      </div>
                      <div className="font-black text-violet-700">
                        {formatMoney(sale.total_amount)}
                      </div>
                    </div>
                  </button>
                ) : (
                  <Link
                    key={sale.id}
                    to={`/sales/${sale.id}`}
                    className="block rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-800">
                          {sale.sale_number}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          {formatTime(sale.created_at)}
                          {sale.created_by_name ? ` · ${sale.created_by_name}` : ''}
                        </div>
                      </div>
                      <div className="font-black text-violet-700">
                        {formatMoney(sale.total_amount)}
                      </div>
                    </div>
                  </Link>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      {ownerMode && detailQuery.data ? (
        <OwnerBillSheet
          sale={detailQuery.data}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  )
}
