import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Receipt } from 'lucide-react'

import { getSales } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { formatTime } from '@/lib/datetime'
import { formatMoney } from '@/lib/money'

export function PosRecentSales() {
  const salesQuery = useQuery({
    queryKey: queryKeys.sales.list,
    queryFn: getSales,
  })

  if (salesQuery.isLoading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-accent-soft" />
        ))}
      </div>
    )
  }

  const sales = (salesQuery.data ?? []).slice(0, 10)

  if (sales.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted">
        <Receipt className="h-8 w-8" aria-hidden />
        <p className="font-semibold">No sales yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {sales.map((sale) => (
        <Link
          key={sale.id}
          to={`/sales/${sale.id}`}
          className="block rounded-2xl border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">
                {sale.sale_number}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {formatTime(sale.created_at)}
                {sale.created_by_name ? ` · ${sale.created_by_name}` : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-accent">
                {formatMoney(sale.total_amount)}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
