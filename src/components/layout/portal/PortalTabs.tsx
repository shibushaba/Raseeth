import { cn } from '@/lib/utils'

export type PortalTab = {
  id: string
  label: string
  badge?: number
}

export type PortalTabTone = 'violet' | 'emerald' | 'indigo'

const activeClasses: Record<PortalTabTone, string> = {
  violet: 'border-violet-600 text-violet-700',
  emerald: 'border-emerald-500 text-emerald-700',
  indigo: 'border-indigo-600 text-indigo-700',
}

export function PortalTabs({
  tabs,
  activeId,
  onChange,
  tone,
  size = 'sm',
}: {
  tabs: PortalTab[]
  activeId: string
  onChange: (id: string) => void
  tone: PortalTabTone
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex border-b border-violet-100 bg-white">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 font-bold transition-colors',
              size === 'md' ? 'text-sm' : 'text-xs',
              active
                ? activeClasses[tone]
                : 'border-transparent text-gray-400',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  active ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500',
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
