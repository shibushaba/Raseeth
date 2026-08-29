import { useQuery } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, NavLink } from 'react-router-dom'

import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/button'
import { getUnreadMessageCount } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  GlobalSearchDialog,
  GlobalSearchTrigger,
} from '@/features/search/GlobalSearchDialog'
import { SearchProvider } from '@/features/search/SearchContext'
import { desktopNavItemsFor, homePathFor } from '@/lib/roles'
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

  const items = desktopNavItemsFor(role)
  const unread = unreadQuery.data ?? 0
  const primary = items.filter((i) => i.primary)
  const secondary = items.filter((i) => !i.primary)

  return (
    <SearchProvider openSearch={openSearch}>
      <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <Link
            to={homePathFor(role)}
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Raseeth
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <GlobalSearchTrigger
              onOpen={openSearch}
              triggerRef={searchTriggerRef}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
              className="hidden sm:inline-flex"
            >
              Sign out
            </Button>
          </div>
        </div>

        <nav
          className="mx-auto hidden max-w-6xl px-4 pb-3 sm:block sm:px-6"
          aria-label="Primary"
        >
          <div className="flex flex-wrap items-center gap-2">
            {primary.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-primary text-white shadow-sm dark:bg-stone-100 dark:text-stone-900'
                      : 'bg-stone-100 text-foreground hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
            {secondary.map((item) => {
              const isMessages = item.to === '/messages'
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'text-foreground underline decoration-accent decoration-2 underline-offset-4'
                        : 'text-muted hover:text-foreground',
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
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 max-md:pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+1.5rem)] sm:px-6 sm:py-8">
        {children}
      </main>

      <BottomNav role={role} />

      <GlobalSearchDialog
        open={searchOpen}
        onClose={closeSearch}
        returnFocusRef={searchTriggerRef}
      />
    </div>
    </SearchProvider>
  )
}
