import { getStockLevel, stockLevelLabel } from '@/lib/stock'
import { cn } from '@/lib/utils'

export function StockQuantity({
  quantity,
  className,
  size = 'md',
}: {
  quantity: number
  className?: string
  size?: 'md' | 'lg'
}) {
  const level = getStockLevel(quantity)
  const label = stockLevelLabel(level)

  return (
    <div className={cn('inline-flex flex-col', className)}>
      <span
        className={cn(
          'tabular-nums font-medium',
          size === 'lg' ? 'text-2xl tracking-tight' : 'text-sm',
          level === 'out' && 'text-danger',
          level === 'low' && 'text-warning',
        )}
      >
        {quantity}
      </span>
      {label ? (
        <span
          className={cn(
            'text-xs',
            level === 'out' ? 'text-danger' : 'text-muted',
          )}
        >
          {label}
        </span>
      ) : (
        <span className="text-xs text-muted">In stock</span>
      )}
    </div>
  )
}
