/** Shown when VITE_SUPABASE_* were missing at build time. */
export function MissingConfigScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-foreground">
      <div className="panel max-w-md px-6 py-8">
        <p className="text-xl font-semibold tracking-tight">RASEETH</p>
        <p className="mt-4 text-sm font-medium">Configuration missing</p>
        <p className="mt-2 text-sm text-muted">
          This deployment was built without Supabase credentials. In Vercel →
          Project → Settings → Environment Variables, set:
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 font-mono text-sm">
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          Apply to <strong>Production</strong>, then redeploy. Do not add the
          service role key.
        </p>
      </div>
    </div>
  )
}
