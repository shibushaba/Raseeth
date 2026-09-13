import {
  Home,
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
    { label: 'Home', to: '/home', icon: Home },
    {
      label: 'Sales',
      to: '/sales',
      icon: ShoppingCart,
      isActive: (p) => p === '/sales' || p.startsWith('/sales/'),
    },
    {
      label: 'Inventory',
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
    { label: 'Dashboard', to: '/overview', icon: LineChart },
    {
      label: 'Sales',
      to: '/sales',
      icon: ShoppingCart,
      isActive: (p) => p === '/sales' || p.startsWith('/sales/'),
    },
    {
      label: 'Inventory',
      to: '/inventory',
      icon: Package,
      isActive: (p) => p === '/inventory' || p.startsWith('/inventory/'),
    },
    { label: 'Team', to: '/manage', icon: Users },
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

export function BottomNav({ role }: { role: UserRole }) {
  const location = useLocation()
  const items = role === 'OWNER' ? ownerNav() : salesmanNav()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-lg px-3 pb-2">
        <div className="flex items-stretch justify-around rounded-2xl border border-border/40 bg-surface/85 px-1 py-1 shadow-lg backdrop-blur-xl">
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
                  'relative flex min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-all duration-200',
                  active
                    ? 'text-accent'
                    : 'text-muted hover:text-foreground',
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-xl bg-accent-soft/60" />
                )}
                <Icon
                  className={cn(
                    'relative z-10 h-5 w-5 transition-transform',
                    active && 'scale-110',
                  )}
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden
                />
                <span
                  className={cn(
                    'relative z-10 text-[10px] leading-tight',
                    active ? 'font-bold' : 'font-medium',
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
