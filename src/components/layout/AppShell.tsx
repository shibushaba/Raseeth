import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { getUnreadMessageCount } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  GlobalSearchDialog,
  GlobalSearchTrigger,
} from '@/features/search/GlobalSearchDialog'
import { homePathFor, navItemsFor } from '@/lib/roles'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)

  const unreadQuery = useQuery({
    queryKey: queryKeys.messages.unreadCount,
    queryFn: getUnreadMessageCount,
    refetchInterval: 30_000,
    enabled: Boolean(profile),
  })

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable

      if (isEditable && e.shiftKey) return

      e.preventDefault()
      setSearchOpen((open) => !open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!role || !profile) return null

  const items = navItemsFor(role)
  const unread = unreadQuery.data ?? 0

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <Link
              to={homePathFor(role)}
              className="text-lg font-semibold tracking-tight text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              RASEETH
            </Link>
            <p className="mt-0.5 truncate text-xs text-muted">
              {profile.full_name} · {role === 'OWNER' ? 'Owner' : 'Salesman'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <GlobalSearchTrigger
              onOpen={openSearch}
              triggerRef={searchTriggerRef}
            />
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>

        <nav
          className="mx-auto flex max-w-5xl gap-0.5 overflow-x-auto border-t border-border px-2 py-1.5 sm:px-4"
          aria-label="Primary"
        >
          {items.map((item) => {
            const isMessages = item.to === '/messages'
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 rounded-sm px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                    isActive
                      ? 'bg-neutral-100 font-medium text-foreground'
                      : 'text-muted hover:bg-neutral-50 hover:text-foreground',
                  )
                }
                aria-label={
                  isMessages && unread > 0
                    ? `${item.label}, ${unread} unread`
                    : item.label
                }
              >
                {isMessages && unread > 0
                  ? `${item.label} (${unread})`
                  : item.label}
              </NavLink>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>

      <GlobalSearchDialog
        open={searchOpen}
        onClose={closeSearch}
        returnFocusRef={searchTriggerRef}
      />
    </div>
  )
}
