import { LogOut, Search } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type PortalTone = 'violet' | 'emerald' | 'indigo'

const toneClasses: Record<PortalTone, string> = {
  violet: 'bg-violet-600',
  emerald: 'bg-emerald-600',
  indigo: 'bg-indigo-700',
}

export function PortalHeader({
  tone,
  subtitle,
  title,
  onLogout,
  search,
  onSearchChange,
  searchPlaceholder = 'Search products…',
  children,
}: {
  tone: PortalTone
  subtitle: string
  title: string
  onLogout: () => void
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('px-4 pb-4 pt-4 text-white sm:pt-5', toneClasses[tone])}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium opacity-70">{subtitle}</p>
          <h1 className="truncate text-xl font-black">{title}</h1>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {onSearchChange !== undefined ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl bg-white py-2.5 pl-9 pr-4 text-sm font-medium text-gray-700 placeholder-gray-400 outline-none"
          />
        </div>
      ) : null}

      {children}
    </div>
  )
}
