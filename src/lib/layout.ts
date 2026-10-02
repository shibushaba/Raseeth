/** Space reserved for the fixed bottom tab bar (+ safe area). */
export const BOTTOM_NAV_OFFSET =
  'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))'

export const screenPadAboveBottomNav = {
  paddingBottom: BOTTOM_NAV_OFFSET,
} as const
