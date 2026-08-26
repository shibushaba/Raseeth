import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (mode === 'production') {
    const url = env.VITE_SUPABASE_URL?.trim()
    const key = env.VITE_SUPABASE_ANON_KEY?.trim()
    if (!url || !key) {
      throw new Error(
        [
          'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
          'Set them in Vercel → Settings → Environment Variables (Production),',
          'then Redeploy. Never add SUPABASE_SERVICE_ROLE_KEY to Vercel.',
        ].join(' '),
      )
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
  }
})
