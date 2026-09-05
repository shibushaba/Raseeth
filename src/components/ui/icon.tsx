import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

import { cn } from '@/lib/utils'

export type AppIconSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeMap: Record<AppIconSize, number> = {
  sm: 18,
  md: 20,
  lg: 24,
  xl: 28,
}

export function AppIcon({
  icon,
  altIcon,
  showAlt,
  size = 'md',
  className,
  strokeWidth = 2,
}: {
  icon: IconSvgElement
  altIcon?: IconSvgElement
  showAlt?: boolean
  size?: AppIconSize | number
  className?: string
  strokeWidth?: number
}) {
  const px = typeof size === 'number' ? size : sizeMap[size]

  return (
    <HugeiconsIcon
      icon={icon}
      altIcon={altIcon}
      showAlt={showAlt}
      size={px}
      strokeWidth={strokeWidth}
      color="currentColor"
      className={cn('shrink-0', className)}
      aria-hidden
    />
  )
}
