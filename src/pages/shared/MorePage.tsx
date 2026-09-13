import { Activity, MessageSquare, Search, Settings } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

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
      to: '/activity',
      icon: Activity,
    },
    {
      label: 'Messages',
      to: '/messages',
      icon: MessageSquare,
      badge: unread > 0 ? unread : undefined,
    },
    {
      label: 'Search',
      action: openSearch,
      icon: Search,
    },
    {
      label: 'Settings',
      to: '/settings',
      icon: Settings,
    },
  ]

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-black text-foreground">More</h1>
      </div>

      <ul className="space-y-2 px-4">
        {items.map((item) => {
          const Icon = item.icon
          const inner = (
            <Card className="transition-shadow hover:shadow-md">
              <CardBody className="flex items-center gap-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{item.label}</p>
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

      <div className="px-4">
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-2xl border border-border bg-surface py-3 text-sm font-medium text-muted transition-colors hover:bg-accent-soft/30 hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
