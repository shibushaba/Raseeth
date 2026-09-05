import type { IconSvgElement } from '@hugeicons/react'
import { NavLink, useLocation } from 'react-router-dom'

import { AppIcon } from '@/components/ui/icon'
import {
  GridViewIcon,
  Home01Icon,
  Package01Icon,
  ShoppingCart01Icon,
} from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'

type NavDef = {
  label: string
  to: string
  icon: IconSvgElement
  isActive?: (pathname: string) => boolean
}

function salesmanNav(): NavDef[] {
  return [
    { label: 'Home', to: '/home', icon: Home01Icon },
    { label: 'Sales', to: '/sales', icon: ShoppingCart01Icon },
    { label: 'Inventory', to: '/inventory', icon: Package01Icon },
    {
      label: 'More',
      to: '/more',
      icon: GridViewIcon,
      isActive: (p) =>
        p.startsWith('/more') ||
        p.startsWith('/activity') ||
        p.startsWith('/messages') ||
        p.startsWith('/settings'),
    },
  ]
}

function ownerNav(): NavDef[] {
  return [
    { label: 'Overview', to: '/overview', icon: Home01Icon },
    { label: 'Sales', to: '/sales', icon: ShoppingCart01Icon },
    { label: 'Inventory', to: '/inventory', icon: Package01Icon },
    {
      label: 'More',
      to: '/more',
      icon: GridViewIcon,
      isActive: (p) =>
        p.startsWith('/more') ||
        p.startsWith('/activity') ||
        p.startsWith('/messages') ||
        p.startsWith('/settings'),
    },
  ]
}

export function BottomNav({ role }: { role: UserRole }) {
  const location = useLocation()
  const items = role === 'OWNER' ? ownerNav() : salesmanNav()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const active = item.isActive
            ? item.isActive(location.pathname)
            : location.pathname === item.to ||
              (item.to !== '/home' &&
                item.to !== '/overview' &&
                location.pathname.startsWith(item.to))

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex min-h-[56px] min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium transition-colors',
                active ? 'font-bold text-accent' : 'font-medium text-muted',
              )}
            >
              <AppIcon
                icon={item.icon}
                size="md"
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
