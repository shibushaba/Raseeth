import { PageHeader } from '@/components/layout/PageHeader'
import { ThemeSelector } from '@/components/settings/ThemeSelector'
import { useAuth } from '@/features/auth/AuthProvider'

export function SettingsPage() {
  const { signOut } = useAuth()

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader title="Settings" />

      <ThemeSelector />

      <div className="border-t border-border pt-6">
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted hover:bg-accent-soft/30 hover:text-foreground"
        >
          Log out
        </button>
      </div>
    </div>
  )
}
