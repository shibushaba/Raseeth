import {
  LayoutGrid,
  LineChart,
  Package,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'

type NavDef = {
  label: string
  to: string
  icon: LucideIcon
  isActive?: (pathname: string) => boolean
}

function salesmanNav(): NavDef[] {
  return [
    {
      label: 'Sales',
      to: '/sales',
      icon: ShoppingCart,
      isActive: (p) => p === '/sales' || p.startsWith('/sales/'),
    },
    {
      label: 'Stock',
      to: '/inventory',
      icon: Package,
      isActive: (p) => p === '/inventory' || p.startsWith('/inventory/'),
    },
    {
      label: 'More',
      to: '/more',
      icon: LayoutGrid,
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
    { label: 'Overview', to: '/overview', icon: LineChart },
    {
      label: 'Sales',
      to: '/sales',
      icon: ShoppingCart,
      isActive: (p) => p === '/sales' || p.startsWith('/sales/'),
    },
    {
      label: 'Stock',
      to: '/inventory',
      icon: Package,
      isActive: (p) => p === '/inventory' || p.startsWith('/inventory/'),
    },
    { label: 'Manage', to: '/manage', icon: Users },
  ]
}

export function BottomNav({ role }: { role: UserRole }) {
  const location = useLocation()
  const items = role === 'OWNER' ? ownerNav() : salesmanNav()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-100 bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.isActive
            ? item.isActive(location.pathname)
            : location.pathname === item.to

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex min-h-[52px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold transition-colors',
                active ? 'text-violet-700' : 'font-semibold text-gray-400',
              )}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2.25 : 1.75}
                aria-hidden
              />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
