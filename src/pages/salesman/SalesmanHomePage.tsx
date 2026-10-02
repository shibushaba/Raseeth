import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Receipt, ShoppingCart, TrendingUp } from 'lucide-react'

import {
  HomeMetricHero,
  HomeSection,
  HomeStatGrid,
} from '@/components/home/HomeUi'
import { getRecentSales, getTodaySalesSummary } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useShopScope } from '@/features/shop/useShopScope'
import { dashboardRangeBounds, formatTime } from '@/lib/datetime'
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
    queryKey: [...queryKeys.sales.recent(5), shopId],
    queryFn: () => getRecentSales(5, shopId),
  })

  const today = todayQuery.data
  const recent = recentQuery.data ?? []
  const topSale = recent[0]

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="space-y-4 overflow-y-auto p-4 pb-8">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-purple-500 p-5 text-white shadow-lg">
          <p className="text-sm font-medium opacity-90">
            Good morning, {firstName}
          </p>
          <h1 className="mt-0.5 text-2xl font-black">{myShop?.name ?? 'Your shop'}</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-80">
            Sales floor
          </p>
        </div>

        <HomeMetricHero
          tone="violet"
          label="Today's sales"
          value={formatMoney(today?.total_amount ?? 0)}
          sub={`${today?.sale_count ?? 0} sale${(today?.sale_count ?? 0) !== 1 ? 's' : ''} · ${today?.units_sold ?? 0} units`}
        />

        <Link
          to="/sales"
          className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-5 text-lg font-extrabold text-white shadow-lg transition-transform active:scale-[0.99]"
        >
          <Plus className="h-6 w-6" aria-hidden />
          New sale
        </Link>

        <HomeStatGrid
          items={[
            {
              to: '/sales',
              label: 'Sales today',
              value: today?.sale_count ?? 0,
              hint: 'Transactions',
              icon: ShoppingCart,
              accent: 'bg-violet-500',
            },
            {
              to: '/sales/history',
              label: 'Units sold',
              value: today?.units_sold ?? 0,
              hint: 'Items rung up',
              icon: Receipt,
              accent: 'bg-indigo-500',
            },
          ]}
        />

        {topSale ? (
          <Link
            to={`/sales/${topSale.id}`}
            className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3.5 active:scale-[0.99]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500 text-white">
              <TrendingUp className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase text-violet-800/70">
                Latest sale
              </p>
              <p className="truncate text-sm font-extrabold text-violet-950">
                {topSale.sale_number}
              </p>
            </div>
            <span className="text-sm font-black text-violet-700">
              {formatMoney(topSale.total_amount)}
            </span>
          </Link>
        ) : null}

        {recent.length > 0 ? (
          <HomeSection
            title="Recent sales"
            subtitle="Your activity today"
            action={{ label: 'View all', to: '/sales' }}
          >
            <ul>
              {recent.map((s) => (
                <li key={s.id} className="border-b border-border last:border-0">
                  <Link
                    to={`/sales/${s.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 active:bg-accent-soft/40"
                  >
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        {s.sale_number}
                      </div>
                      <div className="text-xs text-muted">
                        {formatTime(s.created_at)}
                      </div>
                    </div>
                    <span className="font-black text-accent">
                      {formatMoney(s.total_amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </HomeSection>
        ) : (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-4 py-8 text-center">
            <p className="font-bold text-foreground">No sales yet today</p>
            <p className="mt-1 text-sm text-muted">
              Tap New sale to record your first bill.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
