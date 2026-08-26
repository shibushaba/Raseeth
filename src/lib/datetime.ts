import { formatDate } from '@/lib/format'

/** Local calendar day helpers for "today" dashboard windows. */

export function localDayBounds(now = new Date()): {
  start: Date
  end: Date
  dayKey: string
} {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const dayKey = [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, '0'),
    String(start.getDate()).padStart(2, '0'),
  ].join('-')
  return { start, end, dayKey }
}

export type DashboardRangeKey = 'today' | 'yesterday' | '7d' | '30d'

/** Half-open [start, end) local bounds for owner intelligence ranges. */
export function dashboardRangeBounds(
  range: DashboardRangeKey,
  now = new Date(),
): { start: Date; end: Date; rangeKey: DashboardRangeKey } {
  const today = localDayBounds(now)

  if (range === 'today') {
    return { start: today.start, end: today.end, rangeKey: 'today' }
  }

  if (range === 'yesterday') {
    const y = new Date(today.start)
    y.setDate(y.getDate() - 1)
    const bounds = localDayBounds(y)
    return { start: bounds.start, end: bounds.end, rangeKey: 'yesterday' }
  }

  if (range === '7d') {
    const start = new Date(today.start)
    start.setDate(start.getDate() - 6)
    return { start, end: today.end, rangeKey: '7d' }
  }

  const start = new Date(today.start)
  start.setDate(start.getDate() - 29)
  return { start, end: today.end, rangeKey: '30d' }
}

export function greetingForHour(hour = new Date().getHours()): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const timeFmt = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

/** Group label for activity timeline: Today / Yesterday / date. */
export function dayGroupLabel(iso: string, now = new Date()): string {
  const key = localDayBounds(new Date(iso)).dayKey
  const today = localDayBounds(now).dayKey
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = localDayBounds(yesterdayDate).dayKey
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  return formatDate(iso)
}

export function groupByDay<T extends { createdAt: string }>(
  items: T[],
  now = new Date(),
): Array<{ label: string; dayKey: string; items: T[] }> {
  const map = new Map<string, { label: string; items: T[] }>()
  for (const item of items) {
    const dayKey = localDayBounds(new Date(item.createdAt)).dayKey
    const existing = map.get(dayKey)
    if (existing) {
      existing.items.push(item)
    } else {
      map.set(dayKey, {
        label: dayGroupLabel(item.createdAt, now),
        items: [item],
      })
    }
  }
  return Array.from(map.entries()).map(([dayKey, value]) => ({
    dayKey,
    label: value.label,
    items: value.items,
  }))
}
