import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { getShops } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useOwnerShopFilter } from '@/features/shop/OwnerShopContext'
import { cn } from '@/lib/utils'

export function ShopSwitcher({ className }: { className?: string }) {
  const { selectedShopId, setSelectedShopId } = useOwnerShopFilter()
  const [open, setOpen] = useState(false)

  const shopsQuery = useQuery({
    queryKey: queryKeys.shops.all,
    queryFn: getShops,
  })

  const shops = shopsQuery.data ?? []
  const label =
    selectedShopId === null
      ? 'All shops'
      : shops.find((s) => s.id === selectedShopId)?.name ?? 'Shop'

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold text-foreground shadow-sm"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close shop menu"
            onClick={() => setOpen(false)}
          />
          <ul
            className="absolute left-0 z-50 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
            role="listbox"
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected={selectedShopId === null}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm font-semibold',
                  selectedShopId === null ? 'bg-accent-soft text-accent' : '',
                )}
                onClick={() => {
                  setSelectedShopId(null)
                  setOpen(false)
                }}
              >
                All shops
              </button>
            </li>
            {shops.map((shop) => (
              <li key={shop.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedShopId === shop.id}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm font-semibold',
                    selectedShopId === shop.id ? 'bg-accent-soft text-accent' : '',
                  )}
                  onClick={() => {
                    setSelectedShopId(shop.id)
                    setOpen(false)
                  }}
                >
                  {shop.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
