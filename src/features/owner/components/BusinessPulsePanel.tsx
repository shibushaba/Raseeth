import { Link } from 'react-router-dom'

import type { BusinessPulse, BusinessSignal } from '@/lib/business-pulse'

function markerFor(type: BusinessSignal['type']): string {
  if (type === 'TOP_PRODUCT' || type === 'INVENTORY_ACTIVITY') return '+'
  return '!'
}

function SignalRow({ signal }: { signal: BusinessSignal }) {
  const body = (
    <div className="flex gap-3">
      <span className="mt-0.5 w-3 shrink-0 text-sm text-muted" aria-hidden>
        {markerFor(signal.type)}
      </span>
      <div className="min-w-0">
        <p className="app-kicker">{signal.title}</p>
        <p className="mt-0.5 text-sm text-foreground">{signal.description}</p>
        {signal.href ? (
          <p className="mt-1 text-xs text-muted">
            {destinationLabel(signal.href)} →
          </p>
        ) : null}
      </div>
    </div>
  )

  if (!signal.href) {
    return <li className="border-b border-border py-3 last:border-0">{body}</li>
  }

  return (
    <li className="border-b border-border last:border-0">
      <Link
        to={signal.href}
        className="block py-3 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {body}
      </Link>
    </li>
  )
}

function destinationLabel(href: string): string {
  if (href.startsWith('/inventory/') && href !== '/inventory') return 'View Product'
  if (href.startsWith('/inventory')) return 'View Inventory'
  if (href.startsWith('/sales')) return 'View Sales'
  if (href.startsWith('/overview')) return 'View Overview'
  if (href.startsWith('/activity')) return 'View Activity'
  return 'View'
}

export function BusinessPulsePanel({
  pulse,
  isLoading,
  errorMessage,
}: {
  pulse: BusinessPulse | undefined
  isLoading: boolean
  errorMessage: string | null
}) {
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-10 animate-pulse bg-neutral-100" />
        <div className="h-10 animate-pulse bg-neutral-100" />
      </div>
    )
  }

  if (errorMessage) {
    return (
      <p className="text-sm text-muted" role="status">
        Business Pulse unavailable.
      </p>
    )
  }

  if (!pulse || pulse.allGood || pulse.signals.length === 0) {
    return (
      <div>
        <p className="app-kicker">All good</p>
        <p className="mt-1 text-sm text-foreground">
          Nothing needs your attention right now.
        </p>
      </div>
    )
  }

  return (
    <ul>
      {pulse.signals.map((signal) => (
        <SignalRow key={signal.id} signal={signal} />
      ))}
    </ul>
  )
}
