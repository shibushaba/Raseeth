import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type HeroTone = 'violet' | 'emerald' | 'owner'

const toneClass: Record<HeroTone, string> = {
  violet: 'bg-accent text-white',
  emerald: 'bg-inventory text-white',
  owner: 'bg-owner text-white',
}

export function PageHero({
  title,
  subtitle,
  tone = 'violet',
  children,
  className,
}: {
  title: string
  subtitle?: string
  tone?: HeroTone
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        '-mx-4 rounded-none px-4 py-5 sm:-mx-6 sm:rounded-2xl sm:px-6',
        toneClass[tone],
        className,
      )}
    >
      {subtitle ? (
        <p className="text-sm font-semibold opacity-80">{subtitle}</p>
      ) : null}
      <h1
        className={cn(
          'text-2xl font-extrabold tracking-tight',
          subtitle ? 'mt-0.5' : '',
        )}
      >
        {title}
      </h1>
      {children}
    </div>
  )
}
