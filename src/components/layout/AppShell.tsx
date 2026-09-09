import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'

import { SectionNav } from '@/components/layout/portal/SectionNav'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  GlobalSearchDialog,
  GlobalSearchTrigger,
} from '@/features/search/GlobalSearchDialog'
import { SearchProvider } from '@/features/search/SearchContext'
import { homePathFor } from '@/lib/roles'
import { cn } from '@/lib/utils'

function isPortalRoute(pathname: string): boolean {
  return (
    pathname === '/overview' ||
    pathname === '/manage' ||
    pathname === '/sales' ||
    pathname.startsWith('/sales/') ||
    pathname === '/inventory' ||
    pathname.startsWith('/inventory/') ||
    pathname === '/home'
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)

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

  const portalMode = isPortalRoute(location.pathname)

  return (
    <SearchProvider openSearch={openSearch}>
      <div className="flex min-h-dvh flex-col bg-[#F5F3FF] text-foreground dark:bg-background">
        {!portalMode ? (
          <header className="border-b border-violet-100 bg-white/90 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <Link
                to={homePathFor(role)}
                className="text-xl font-black tracking-tight text-violet-700"
              >
                Raseeth
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <GlobalSearchTrigger
                  onOpen={openSearch}
                  triggerRef={searchTriggerRef}
                />
                <Link
                  to="/settings"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-violet-50 hover:text-violet-700"
                  aria-label="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Link>
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
          </header>
        ) : null}

        {portalMode ? <SectionNav role={role} /> : null}

        <main
          className={cn(
            'flex-1',
            portalMode
              ? 'mx-auto w-full max-w-lg'
              : 'mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8',
          )}
        >
          {children}
        </main>

        <GlobalSearchDialog
          open={searchOpen}
          onClose={closeSearch}
          returnFocusRef={searchTriggerRef}
        />
      </div>
    </SearchProvider>
  )
}
