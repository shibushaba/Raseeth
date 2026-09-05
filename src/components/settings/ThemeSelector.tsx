import { useTheme } from '@/features/theme/ThemeProvider'
import type { ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-foreground">Appearance</legend>
      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
              theme === opt.value
                ? 'border-accent bg-accent-soft/40 dark:bg-teal-950/40'
                : 'border-border hover:bg-stone-50 dark:hover:bg-stone-900',
            )}
          >
            <input
              type="radio"
              name="theme"
              value={opt.value}
              checked={theme === opt.value}
              onChange={() => setTheme(opt.value)}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm font-medium">{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
