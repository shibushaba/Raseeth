import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function SectionHeader({
  title,
  actionLabel,
  actionTo,
  action,
}: {
  title: string
  actionLabel?: string
  actionTo?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="section-label">{title}</h2>
      {action ??
        (actionLabel && actionTo ? (
          <Link
            to={actionTo}
            className="text-sm font-medium text-accent hover:underline"
          >
            {actionLabel}
          </Link>
        ) : null)}
    </div>
  )
}
