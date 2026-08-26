import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/layout/EmptyState'
import { getSales } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { formatDateTime } from '@/lib/format'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'

export function SalesHistoryList() {
  const salesQuery = useQuery({
    queryKey: queryKeys.sales.list,
    queryFn: getSales,
  })

  if (salesQuery.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse bg-neutral-100" />
        ))}
      </div>
    )
  }

  if (salesQuery.error) {
    logTechnicalError('getSales', salesQuery.error)
    return (
      <p className="text-sm text-red-700" role="alert">
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

  return (
    <ul className="divide-y divide-neutral-200">
      {sales.map((sale) => (
        <li key={sale.id}>
          <Link
            to={`/sales/${sale.id}`}
            className="flex flex-col gap-1 py-4 hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div>
              <p className="font-mono text-sm font-medium">{sale.sale_number}</p>
              <p className="text-xs text-neutral-500">
                {formatDateTime(sale.created_at)}
                {sale.created_by_name ? ` · ${sale.created_by_name}` : ''}
              </p>
            </div>
            <p className="tabular-nums text-base font-medium">
              {formatMoney(sale.total_amount)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
