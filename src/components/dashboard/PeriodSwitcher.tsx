import type { DashboardRangeKey } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const OPTIONS: Array<{ key: DashboardRangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
]

export function PeriodSwitcher({
  value,
  onChange,
}: {
  value: DashboardRangeKey
  onChange: (key: DashboardRangeKey) => void
}) {
  return (
    <div
      className="inset-well inline-flex flex-wrap gap-1 rounded-2xl p-1"
      role="tablist"
      aria-label="Time period"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          role="tab"
          aria-selected={value === opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            'min-h-11 rounded-xl px-4 text-sm font-bold transition-colors',
            value === opt.key
              ? 'bg-surface text-accent shadow-sm'
              : 'text-stone-600 hover:text-foreground dark:text-stone-300 dark:hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
