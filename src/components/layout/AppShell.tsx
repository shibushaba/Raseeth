import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'

import { BottomNav } from '@/components/layout/BottomNav'
import { useAuth } from '@/features/auth/AuthProvider'
import { OwnerShopProvider } from '@/features/shop/OwnerShopContext'
import { GlobalSearchDialog } from '@/features/search/GlobalSearchDialog'
import { SearchProvider } from '@/features/search/SearchContext'

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role } = useAuth()
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

  const hideNav = location.pathname === '/login'

  return (
    <OwnerShopProvider>
      <SearchProvider openSearch={openSearch}>
        <div className="flex min-h-dvh flex-col bg-[#F5F3FF] text-foreground">
          <main className="mx-auto w-full max-w-lg flex-1 overflow-y-auto pb-[calc(var(--bottom-nav-height)+1rem+env(safe-area-inset-bottom,0px))]">
            {children}
          </main>

        {!hideNav && <BottomNav role={role} />}

        <GlobalSearchDialog
          open={searchOpen}
          onClose={closeSearch}
          returnFocusRef={searchTriggerRef}
        />
        </div>
      </SearchProvider>
    </OwnerShopProvider>
  )
}
