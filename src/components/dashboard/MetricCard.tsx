import { Card, CardBody } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function MetricCard({
  label,
  value,
  loading,
  className,
}: {
  label: string
  value: string
  loading?: boolean
  className?: string
}) {
  return (
    <Card className={cn('min-h-[88px] sm:min-h-[104px]', className)}>
      <CardBody className="flex h-full flex-col justify-center py-4 sm:py-5">
        <p className="text-sm font-medium text-muted sm:eyebrow">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-28" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:mt-2 sm:text-3xl">
            {value}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
