import { NavLink, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'

type SectionItem = {
  label: string
  to: string
}

function sectionsFor(role: UserRole): SectionItem[] {
  if (role === 'OWNER') {
    return [
      { label: 'Overview', to: '/overview' },
      { label: 'Sales', to: '/sales' },
      { label: 'Inventory', to: '/inventory' },
      { label: 'Manage', to: '/manage' },
    ]
  }
  return [
    { label: 'Sales', to: '/sales' },
    { label: 'Inventory', to: '/inventory' },
  ]
}

function isSectionActive(pathname: string, to: string): boolean {
  if (to === '/overview') return pathname === '/overview'
  if (to === '/sales') {
    return (
      pathname === '/sales' ||
      pathname.startsWith('/sales/') ||
      pathname === '/home'
    )
  }
  if (to === '/inventory') {
    return pathname === '/inventory' || pathname.startsWith('/inventory/')
  }
  if (to === '/manage') {
    return pathname === '/manage'
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

/** Top-level section switcher — Sales / Inventory / Overview. */
export function SectionNav({ role }: { role: UserRole }) {
  const location = useLocation()
  const items = sectionsFor(role)
  const hide =
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/activity') ||
    location.pathname.startsWith('/messages') ||
    location.pathname.startsWith('/more')

  if (hide) return null

  return (
    <div className="flex items-stretch border-b border-violet-100 bg-white/95 backdrop-blur-sm">
      <nav className="flex flex-1" aria-label="Sections">
        {items.map((item) => {
          const active = isSectionActive(location.pathname, item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex-1 py-2.5 text-center text-xs font-bold transition-colors sm:text-sm',
                active
                  ? 'border-b-2 border-violet-600 text-violet-700'
                  : 'border-b-2 border-transparent text-gray-400',
              )}
              end={item.to === '/overview'}
            >
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      <NavLink
        to="/settings"
        className={cn(
          'flex items-center justify-center px-3 py-2.5',
          location.pathname === '/settings'
            ? 'text-violet-700'
            : 'text-gray-400',
        )}
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </NavLink>
    </div>
  )
}
