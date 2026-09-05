import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { AppIcon } from '@/components/ui/icon'
import { Card, CardBody } from '@/components/ui/card'
import { getUnreadMessageCount } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { useGlobalSearch } from '@/features/search/SearchContext'
import {
  Activity01Icon,
  ArrowRight01Icon,
  Message01Icon,
  Search01Icon,
  Settings01Icon,
} from '@/lib/icons'

export function MorePage() {
  const { signOut } = useAuth()
  const { openSearch } = useGlobalSearch()

  const unreadQuery = useQuery({
    queryKey: queryKeys.messages.unreadCount,
    queryFn: getUnreadMessageCount,
  })

  const unread = unreadQuery.data ?? 0

  const items = [
    {
      label: 'Activity',
      to: '/activity',
      icon: Activity01Icon,
    },
    {
      label: 'Messages',
      to: '/messages',
      icon: Message01Icon,
      badge: unread > 0 ? unread : undefined,
    },
    {
      label: 'Search',
      action: openSearch,
      icon: Search01Icon,
    },
    {
      label: 'Settings',
      to: '/settings',
      icon: Settings01Icon,
    },
  ]

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="More" />

      <ul className="space-y-2">
        {items.map((item) => {
          const inner = (
            <Card className="transition-shadow hover:shadow-md">
              <CardBody className="flex items-center gap-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent dark:bg-violet-950 dark:text-violet-300">
                  <AppIcon icon={item.icon} size="md" />
                </div>
                <p className="min-w-0 flex-1 font-bold text-foreground">
                  {item.label}
                </p>
                {item.badge ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                    {item.badge}
                  </span>
                ) : (
                  <AppIcon icon={ArrowRight01Icon} size="sm" className="text-muted" />
                )}
              </CardBody>
            </Card>
          )

          if (item.action) {
            return (
              <li key={item.label}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={item.action}
                >
                  {inner}
                </button>
              </li>
            )
          }

          return (
            <li key={item.label}>
              <Link to={item.to!} className="block">
                {inner}
              </Link>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={() => void signOut()}
        className="w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted hover:bg-accent-soft/30 hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  )
}
