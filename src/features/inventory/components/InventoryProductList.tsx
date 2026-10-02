import { Link } from 'react-router-dom'

import { formatMoney, parseMoney } from '@/lib/money'
import { getStockLevel } from '@/lib/stock'
import type { Product } from '@/types/database'

function StatusPill({ level }: { level: ReturnType<typeof getStockLevel> }) {
  if (level === 'ok') {
    return (
      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
        OK
      </span>
    )
  }
  if (level === 'low') {
    return (
      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
        Low
      </span>
    )
  }
  return (
    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
      Out
    </span>
  )
}

export function InventoryProductList({ products }: { products: Product[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 p-4">
      {products.map((product) => {
        const level = getStockLevel(
          product.current_quantity,
          product.minimum_quantity,
        )
        const profit =
          parseMoney(product.retail_price) - parseMoney(product.wholesale_price)

        return (
          <li key={product.id}>
            <Link
              to={`/inventory/${product.id}`}
              className="flex h-full flex-col rounded-2xl border border-border bg-surface p-3 shadow-sm active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  {product.category ? (
                    <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {product.category}
                    </div>
                  ) : null}
                  <div className="line-clamp-2 text-sm font-extrabold leading-tight text-foreground">
                    {product.name}
                  </div>
                </div>
                <StatusPill level={level} />
              </div>
              <div className="mt-1 text-[10px] font-medium text-muted">
                {product.product_code}
              </div>
              <div className="mt-2 text-base font-black text-accent">
                {formatMoney(product.retail_price)}
              </div>
              <div className="mt-2 flex items-end justify-between gap-1 border-t border-border pt-2 text-[10px]">
                <span className="font-bold text-muted">
                  Stock {product.current_quantity}
                </span>
                <span className="font-extrabold text-success">
                  +{formatMoney(profit)}
                </span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
