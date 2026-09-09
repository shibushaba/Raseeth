import { Activity, MessageSquare, Search, Settings } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/card'
import { getUnreadMessageCount } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { Link } from 'react-router-dom'

import { useGlobalSearch } from '@/features/search/SearchContext'

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
      description: 'Recent sales and stock updates',
      to: '/activity',
      icon: Activity,
    },
    {
      label: 'Messages',
      description:
        unread > 0
          ? `${unread} unread message${unread === 1 ? '' : 's'}`
          : 'Talk with your team',
      to: '/messages',
      icon: MessageSquare,
      badge: unread > 0 ? unread : undefined,
    },
    {
      label: 'Search',
      description: 'Find products, sales, and returns',
      action: openSearch,
      icon: Search,
    },
    {
      label: 'Settings',
      description: 'Appearance and account',
      to: '/settings',
      icon: Settings,
    },
  ]

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="More" description="Activity, messages, and settings." />

      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          const inner = (
            <Card className="transition-shadow hover:shadow-md">
              <CardBody className="flex items-center gap-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent dark:bg-teal-950 dark:text-teal-300">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted">{item.description}</p>
                </div>
                {item.badge ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                    {item.badge}
                  </span>
                ) : (
                  <span className="text-muted">→</span>
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
        className="w-full rounded-lg border border-border py-3 text-sm font-medium text-muted hover:bg-stone-50 hover:text-foreground dark:hover:bg-stone-900"
      >
        Sign out
      </button>
    </div>
  )
}
