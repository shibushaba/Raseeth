import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-stone-200/80 dark:bg-stone-700/60', className)}
      aria-hidden
    />
  )
}
