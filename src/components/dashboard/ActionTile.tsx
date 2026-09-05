import type { IconSvgElement } from '@hugeicons/react'
import { Link } from 'react-router-dom'

import { AppIcon } from '@/components/ui/icon'
import { ArrowRight01Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'

export function ActionTile({
  to,
  title,
  icon,
  tone = 'violet',
  className,
}: {
  to: string
  title: string
  icon: IconSvgElement
  tone?: 'violet' | 'emerald'
  className?: string
}) {
  const toneClass =
    tone === 'emerald'
      ? 'bg-inventory text-white shadow-md active:bg-emerald-600'
      : 'bg-accent text-white shadow-md active:bg-violet-700'

  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-[120px] items-center gap-4 rounded-2xl px-5 py-5 transition-transform active:scale-[0.99]',
        toneClass,
        className,
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <AppIcon icon={icon} size="lg" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-extrabold">{title}</p>
      </div>
      <AppIcon icon={ArrowRight01Icon} size="md" className="opacity-80" />
    </Link>
  )
}
