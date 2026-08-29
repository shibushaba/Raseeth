import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/layout/EmptyState'
import { Card } from '@/components/ui/card'
import { getSales } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
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

export function SalesHistoryList() {
  const salesQuery = useQuery({
    queryKey: queryKeys.sales.list,
    queryFn: getSales,
  })

  if (salesQuery.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card h-14 animate-pulse bg-stone-50 dark:bg-stone-800/50" />
        ))}
      </div>
    )
  }

  if (salesQuery.error) {
    logTechnicalError('getSales', salesQuery.error)
    return (
      <p className="text-sm text-danger" role="alert">
        {toUserMessage(salesQuery.error, 'Unable to load sales.')}
      </p>
    )
  }

  const sales = salesQuery.data ?? []

  if (sales.length === 0) {
    return (
      <EmptyState
        title="No sales yet."
        description="Completed sales will appear here."
      />
    )
  }

  const groups = groupSalesByDay(sales)

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="eyebrow mb-2">{group.label}</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {group.items.map((sale) => (
                <li key={sale.id}>
                  <Link
                    to={`/sales/${sale.id}`}
                    className="row-hover flex items-center justify-between gap-4 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">
                        {sale.sale_number}
                      </p>
                      <p className="text-xs text-muted">
                        {formatTime(sale.created_at)}
                        {sale.created_by_name
                          ? ` · ${sale.created_by_name}`
                          : ''}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums font-semibold">
                      {formatMoney(sale.total_amount)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  )
}
