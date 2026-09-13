import { cn } from '@/lib/utils'

export type PortalTab = {
  id: string
  label: string
  badge?: number
}

export type PortalTabTone = 'violet' | 'emerald' | 'indigo'

export function PortalTabs({
  tabs,
  activeId,
  onChange,
  tone: _tone,
  size = 'sm',
}: {
  tabs: PortalTab[]
  activeId: string
  onChange: (id: string) => void
  tone: PortalTabTone
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex gap-2 border-b border-border bg-surface px-4 py-2">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-4 py-1.5 font-bold transition-all',
              size === 'md' ? 'text-sm' : 'text-xs',
              active
                ? 'bg-accent text-white shadow-sm'
                : 'bg-accent-soft/50 text-muted hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-danger-soft text-danger',
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
