import { registerSW } from 'virtual:pwa-register'

/** Auto-update when a new build is deployed; reload on next navigation. */
export function registerPwaServiceWorker() {
  if (!import.meta.env.PROD) return

  registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('[Raseeth] App ready to work offline.')
    },
    onRegisteredSW(_url, registration) {
      if (registration) {
        setInterval(
          () => {
            registration.update().catch(() => {})
          },
          60 * 60 * 1000,
        )
      }
    },
  })
}
