import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Package, Plus } from 'lucide-react'

import { getRecentSales, getTodaySalesSummary } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useShopScope } from '@/features/shop/useShopScope'
import { dashboardRangeBounds } from '@/lib/datetime'
import { formatMoney } from '@/lib/money'

export function SalesmanHomePage() {
  const { profile } = useAuth()
  const { shopId, myShop } = useShopScope()
  const bounds = dashboardRangeBounds('today')
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  const todayQuery = useQuery({
    queryKey: queryKeys.sales.todaySummary(bounds.rangeKey),
    queryFn: () => getTodaySalesSummary(bounds.start, bounds.end),
  })

  const recentQuery = useQuery({
    queryKey: [...queryKeys.sales.recent(3), shopId],
    queryFn: () => getRecentSales(3, shopId),
  })

  const today = todayQuery.data

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-4 pb-2 pt-6">
        <p className="text-sm text-muted">Good morning, {firstName}</p>
        <h1 className="text-2xl font-black text-foreground">
          {myShop?.name ?? 'Your shop'}
        </h1>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl border border-border bg-surface p-5 text-center shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">
            Today&apos;s sales
          </div>
          <div className="mt-2 text-4xl font-black text-accent">
            {formatMoney(today?.total_amount ?? 0)}
          </div>
          <div className="mt-1 text-xs text-muted">
            {today?.sale_count ?? 0} transaction
            {(today?.sale_count ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>

        <Link
          to="/sales"
          className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-5 text-lg font-extrabold text-white shadow-md"
        >
          <Plus className="h-6 w-6" aria-hidden />
          New sale
        </Link>

        <Link
          to="/inventory"
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-accent bg-accent-soft py-3.5 font-extrabold text-accent"
        >
          <Package className="h-5 w-5" aria-hidden />
          Inventory
        </Link>

        {(recentQuery.data ?? []).length > 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-3">
            <div className="mb-2 text-xs font-bold text-muted">Recent activity</div>
            <ul className="space-y-1 text-sm font-semibold text-foreground">
              {(recentQuery.data ?? []).map((s) => (
                <li key={s.id}>
                  <Link to={`/sales/${s.id}`} className="text-accent">
                    {s.sale_number}
                  </Link>
                  {' · '}
                  {formatMoney(s.total_amount)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
