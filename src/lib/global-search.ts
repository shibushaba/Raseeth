import { dayGroupLabel, formatTime } from '@/lib/datetime'

export type SearchResultType = 'PRODUCT' | 'SALE' | 'RETURN'

export type SearchResult = {
  type: SearchResultType
  id: string
  title: string
  subtitle?: string
  meta?: string
  href: string
}

export const GLOBAL_SEARCH_LIMITS = {
  products: 5,
  sales: 5,
  returns: 5,
  fetch: 15,
  recent: 5,
} as const

const RECENT_KEY = 'raseeth.recentSearch'

export type RecentSearchItem = Pick<
  SearchResult,
  'type' | 'id' | 'title' | 'href' | 'subtitle'
>

export function sanitizeSearchTerm(query: string): string {
  return query.trim().replace(/[%_,]/g, '')
}

/** Lower score = higher priority (see Phase 14 ranking). */
export function rankSearchResult(
  result: SearchResult,
  query: string,
): number {
  const q = query.trim().toLowerCase()
  if (!q) return 99

  const title = result.title.toLowerCase()
  const subtitle = (result.subtitle ?? '').toLowerCase()

  if (result.type === 'PRODUCT') {
    if (subtitle === q) return 1 // exact product code
    if (title === q) return 4
    if (subtitle.startsWith(q) || title.startsWith(q)) return 5
    return 6
  }

  if (result.type === 'SALE') {
    if (title === q) return 2
    if (title.startsWith(q)) return 5
    return 6
  }

  // RETURN
  if (title === q) return 3
  if (title.startsWith(q)) return 5
  return 6
}

export function sortSearchResults(
  results: SearchResult[],
  query: string,
): SearchResult[] {
  return [...results].sort((a, b) => {
    const ra = rankSearchResult(a, query)
    const rb = rankSearchResult(b, query)
    if (ra !== rb) return ra - rb
    if (a.type !== b.type) {
      const order = { PRODUCT: 0, SALE: 1, RETURN: 2 }
      return order[a.type] - order[b.type]
    }
    return a.title.localeCompare(b.title)
  })
}

export function groupSearchResults(results: SearchResult[]): Array<{
  type: SearchResultType
  label: string
  items: SearchResult[]
}> {
  const groups: Array<{
    type: SearchResultType
    label: string
    items: SearchResult[]
  }> = [
    { type: 'PRODUCT', label: 'Products', items: [] },
    { type: 'SALE', label: 'Sales', items: [] },
    { type: 'RETURN', label: 'Returns', items: [] },
  ]
  for (const r of results) {
    const g = groups.find((x) => x.type === r.type)
    if (g) g.items.push(r)
  }
  return groups.filter((g) => g.items.length > 0)
}

export function searchWhenLabel(iso: string, now = new Date()): string {
  return `${dayGroupLabel(iso, now)} · ${formatTime(iso)}`
}

export function readRecentSearches(): RecentSearchItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentSearchItem[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.href === 'string' &&
          (item.type === 'PRODUCT' ||
            item.type === 'SALE' ||
            item.type === 'RETURN'),
      )
      .slice(0, GLOBAL_SEARCH_LIMITS.recent)
  } catch {
    return []
  }
}

export function pushRecentSearch(item: RecentSearchItem): RecentSearchItem[] {
  const next: RecentSearchItem[] = [
    {
      type: item.type,
      id: item.id,
      title: item.title,
      href: item.href,
      subtitle: item.subtitle,
    },
    ...readRecentSearches().filter(
      (r) => !(r.type === item.type && r.id === item.id),
    ),
  ].slice(0, GLOBAL_SEARCH_LIMITS.recent)

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      // ignore quota / private mode
    }
  }
  return next
}
