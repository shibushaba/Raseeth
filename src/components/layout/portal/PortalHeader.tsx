import { Search } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type PortalTone = 'violet' | 'emerald' | 'indigo'

const toneClasses: Record<PortalTone, string> = {
  violet: 'bg-accent',
  emerald: 'bg-success',
  indigo: 'bg-accent',
}

export function PortalHeader({
  tone,
  subtitle,
  title,
  search,
  onSearchChange,
  searchPlaceholder = 'Search products…',
  children,
  onLogout: _onLogout,
}: {
  tone: PortalTone
  subtitle: string
  title: string
  onLogout?: () => void
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('px-4 pb-4 pt-5 text-white', toneClasses[tone])}>
      <div className="mb-3">
        <p className="text-sm font-medium opacity-70">{subtitle}</p>
        <h1 className="truncate text-xl font-black">{title}</h1>
      </div>

      {onSearchChange !== undefined ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl bg-surface py-2.5 pl-9 pr-4 text-sm font-medium text-foreground placeholder-muted outline-none"
          />
        </div>
      ) : null}

      {children}
    </div>
  )
}
