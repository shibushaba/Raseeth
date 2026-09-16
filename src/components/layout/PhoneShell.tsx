import type { ReactNode } from 'react'

/** Shop POS–style phone frame for preview and mobile-first layout. */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-200 p-4">
      <div
        className="relative flex w-full max-w-[390px] flex-col overflow-hidden rounded-[44px] bg-[#F5F3FF] shadow-2xl ring-8 ring-gray-800 ring-offset-2"
        style={{ height: 'min(844px, 100dvh - 2rem)' }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-50 flex h-12 items-start justify-between px-8 pt-3"
          aria-hidden
        >
          <span className="text-[11px] font-bold text-white mix-blend-difference">
            9:41
          </span>
          <div className="h-6 w-28 rounded-full bg-gray-900" />
          <span className="text-[11px] font-bold text-white mix-blend-difference">
            ●●●
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
