import { Package, ShoppingCart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { ActionTile } from '@/components/dashboard/ActionTile'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { getRecentActivity } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { ActivityPreviewList } from '@/features/activity/components/ActivityFeed'
import { useAuth } from '@/features/auth/AuthProvider'
import { greetingForHour } from '@/lib/datetime'

/** Salesman home — two dominant actions: Sales + Inventory. */
export function SalesmanHomePage() {
  const { user, role } = useAuth()

  const activityQuery = useQuery({
    queryKey: queryKeys.activity.preview(role ?? 'SALESMAN', user?.id ?? ''),
    queryFn: () =>
      getRecentActivity({
        userId: user!.id,
        role: role!,
        limit: 5,
      }),
    enabled: Boolean(user?.id && role),
  })

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-black text-foreground">
          {greetingForHour()}
        </h1>
        <p className="text-sm text-muted">What do you want to do?</p>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4">
        <ActionTile
          to="/sales"
          title="Sales"
          description="Scan, sell, and accept payments"
          icon={ShoppingCart}
          tone="violet"
        />
        <ActionTile
          to="/inventory"
          title="Inventory"
          description="Track stock and manage products"
          icon={Package}
          tone="emerald"
        />
      </div>

      <section className="px-4">
        <SectionHeader title="Recent" actionLabel="View all" actionTo="/activity" />
        {activityQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <ActivityPreviewList
            items={(activityQuery.data ?? []).slice(0, 5)}
            emptyLabel="No sales yet. Your completed sales will appear here."
          />
        )}
      </section>
    </div>
  )
}
