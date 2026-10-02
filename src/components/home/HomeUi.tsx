import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export function HomeHero({
  greeting,
  title,
  subtitle,
  tone = 'violet',
}: {
  greeting: string
  title: string
  subtitle?: string
  tone?: 'violet' | 'emerald' | 'indigo'
}) {
  const gradient =
    tone === 'emerald'
      ? 'from-emerald-600 to-teal-500'
      : tone === 'indigo'
        ? 'from-indigo-600 to-violet-600'
        : 'from-violet-600 to-purple-500'

  return (
    <div
      className={cn(
        'rounded-3xl bg-gradient-to-br p-5 text-white shadow-lg',
        gradient,
      )}
    >
      <p className="text-sm font-medium opacity-85">{greeting}</p>
      <h1 className="mt-0.5 text-2xl font-black tracking-tight">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-80">
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

export function HomeMetricHero({
  label,
  value,
  sub,
  footer,
  tone = 'violet',
}: {
  label: string
  value: string
  sub?: string
  footer?: ReactNode
  tone?: 'violet' | 'emerald' | 'indigo'
}) {
  const gradient =
    tone === 'emerald'
      ? 'from-emerald-600 to-teal-500'
      : tone === 'indigo'
        ? 'from-indigo-600 to-violet-600'
        : 'from-violet-600 to-purple-500'

  return (
    <div
      className={cn(
        'rounded-3xl bg-gradient-to-br p-5 text-white shadow-lg',
        gradient,
      )}
    >
      <p className="text-xs font-bold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="mt-1 text-4xl font-black tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-sm font-medium opacity-90">{sub}</p> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  )
}

export function HomeStatGrid({
  items,
}: {
  items: {
    to: string
    label: string
    value: string | number
    hint: string
    icon: LucideIcon
    accent: string
  }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.label}
            to={item.to}
            className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition-transform active:scale-[0.98] hover:border-accent/30"
          >
            <div
              className={cn(
                'mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white',
                item.accent,
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="text-2xl font-black tabular-nums text-foreground">
              {item.value}
            </div>
            <div className="text-sm font-bold text-foreground">{item.label}</div>
            <div className="text-[11px] text-muted">{item.hint}</div>
          </Link>
        )
      })}
    </div>
  )
}

export function HomeQuickActions({
  actions,
}: {
  actions: {
    to: string
    label: string
    icon: LucideIcon
    primary?: boolean
  }[]
}) {
  return (
    <div className="grid gap-2">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.label}
            to={action.to}
            className={cn(
              'flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold shadow-md transition-transform active:scale-[0.99]',
              action.primary
                ? 'bg-accent text-white'
                : 'border-2 border-accent bg-accent-soft text-accent',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {action.label}
          </Link>
        )
      })}
    </div>
  )
}

export function HomeSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: { label: string; to: string }
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-extrabold text-foreground">{title}</h2>
          {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
        </div>
        {action ? (
          <Link
            to={action.to}
            className="shrink-0 text-xs font-bold text-accent"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function HomeListRow({
  to,
  title,
  meta,
  trailing,
}: {
  to: string
  title: string
  meta?: string
  trailing?: ReactNode
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 active:bg-accent-soft/40"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-foreground">{title}</div>
        {meta ? <div className="text-xs text-muted">{meta}</div> : null}
      </div>
      {trailing}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
    </Link>
  )
}
