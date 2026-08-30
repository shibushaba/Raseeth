import { Card, CardBody } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function MetricCard({
  label,
  value,
  loading,
  className,
  variant = 'default',
}: {
  label: string
  value: string
  loading?: boolean
  className?: string
  variant?: 'default' | 'hero'
}) {
  if (variant === 'hero') {
    return (
      <div className={cn('hero-violet', className)}>
        <p className="text-sm font-semibold opacity-80">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-10 w-32 bg-white/20" />
        ) : (
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">
            {value}
          </p>
        )}
      </div>
    )
  }

  return (
    <Card className={cn('min-h-[88px]', className)}>
      <CardBody className="flex h-full flex-col justify-center py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-28" />
        ) : (
          <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-accent">
            {value}
          </p>
        )}
      </CardBody>
    </Card>
  )
}

export function StatTile({
  label,
  value,
  colorClass,
}: {
  label: string
  value: string | number
  colorClass: string
}) {
  return (
    <div className={cn('stat-tile', colorClass)}>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs font-semibold opacity-90">{label}</div>
    </div>
  )
}
