import { Link } from 'react-router-dom'

import { formatMoney, parseMoney } from '@/lib/money'
import { getStockLevel } from '@/lib/stock'
import type { Product } from '@/types/database'

function StatusPill({ level }: { level: ReturnType<typeof getStockLevel> }) {
  if (level === 'ok') {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
        In Stock
      </span>
    )
  }
  if (level === 'low') {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
        Low Stock
      </span>
    )
  }
  return (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
      Out of Stock
    </span>
  )
}

export function InventoryProductList({ products }: { products: Product[] }) {
  return (
    <ul className="space-y-3 p-4">
      {products.map((product) => {
        const level = getStockLevel(product.current_quantity)
        const profit =
          parseMoney(product.retail_price) - parseMoney(product.wholesale_price)

        return (
          <li key={product.id}>
            <Link
              to={`/inventory/${product.id}`}
              className="block rounded-2xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {product.category ? (
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {product.category}
                    </div>
                  ) : null}
                  <div className="text-sm font-extrabold text-foreground">
                    {product.name}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {product.product_code} · Stock: {product.current_quantity}
                  </div>
                </div>
                <StatusPill level={level} />
              </div>

              <div className="mt-3 grid grid-cols-3 divide-x divide-border border-t border-border pt-3 text-center">
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted">
                    Wholesale
                  </div>
                  <div className="text-sm font-extrabold text-red-500">
                    {formatMoney(product.wholesale_price)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted">
                    Retail
                  </div>
                  <div className="text-sm font-extrabold text-accent">
                    {formatMoney(product.retail_price)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted">
                    Margin
                  </div>
                  <div className="text-sm font-extrabold text-success">
                    {formatMoney(profit)}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
