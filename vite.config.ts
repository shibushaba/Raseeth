import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

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
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['pwa-icon.svg'],
        manifest: {
          name: 'Raseeth',
          short_name: 'Raseeth',
          description: 'POS and inventory for shops',
          theme_color: '#7c3aed',
          background_color: '#f5f3ff',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          categories: ['business', 'finance', 'productivity'],
          icons: [
            {
              src: '/pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.hostname.endsWith('.supabase.co'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'raseeth-supabase',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 64,
                  maxAgeSeconds: 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
  }
})
