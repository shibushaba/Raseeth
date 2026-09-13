import { Package } from 'lucide-react'

import { formatMoney } from '@/lib/money'
import { getStockLevel } from '@/lib/stock'
import type { Product } from '@/types/database'

export function PosProductGrid({
  products,
  isLoading,
  onAdd,
}: {
  products: Product[]
  isLoading: boolean
  onAdd: (product: Product) => void
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 p-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl bg-accent-soft"
          />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 p-8 text-muted">
        <Package className="h-10 w-10" aria-hidden />
        <p className="text-center font-semibold">No products found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {products.map((product) => {
        const isOut = product.current_quantity <= 0
        const stockLevel = getStockLevel(product.current_quantity)
        return (
          <button
            key={product.id}
            type="button"
            onClick={() => !isOut && onAdd(product)}
            disabled={isOut}
            className={`rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition-transform active:scale-95 ${isOut ? 'opacity-50' : ''}`}
          >
            {product.category ? (
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                {product.category}
              </div>
            ) : null}
            <div className="mt-0.5 text-sm font-extrabold leading-tight text-foreground">
              {product.name}
            </div>
            <div className="mt-2 text-base font-black text-accent">
              {formatMoney(product.retail_price)}
            </div>
            <div className="mt-0.5 text-xs font-bold text-red-500">
              {formatMoney(product.wholesale_price)}
            </div>
            <div className="mt-2 flex items-center justify-between">
              {stockLevel !== 'ok' ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    stockLevel === 'out'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {stockLevel === 'out'
                    ? 'Out of stock'
                    : `Low: ${product.current_quantity}`}
                </span>
              ) : (
                <span />
              )}
            </div>
            {!isOut ? (
              <div className="mt-2 w-full rounded-xl bg-accent py-1.5 text-center text-xs font-bold text-white">
                + Add
              </div>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
