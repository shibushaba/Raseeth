import { PageHeader } from '@/components/layout/PageHeader'
import { ThemeSelector } from '@/components/settings/ThemeSelector'
import { useAuth } from '@/features/auth/AuthProvider'

export function SettingsPage() {
  const { signOut } = useAuth()

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader title="Settings" description="Appearance and account." />

      <ThemeSelector />

      <div className="border-t border-border pt-6">
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-lg border border-border py-3 text-sm font-medium text-muted hover:bg-stone-50 hover:text-foreground dark:hover:bg-stone-900"
        >
          Log out
        </button>
      </div>
    </div>
  )
}
