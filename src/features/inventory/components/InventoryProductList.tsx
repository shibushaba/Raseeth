import { Link } from 'react-router-dom'

import { StockQuantity } from '@/features/inventory/components/StockQuantity'
import { formatMoney } from '@/lib/money'
import { getStockLevel, stockLevelLabel } from '@/lib/stock'
import type { Product } from '@/types/database'
import { cn } from '@/lib/utils'

export function InventoryProductList({ products }: { products: Product[] }) {
  return (
    <ul className="card divide-y divide-border overflow-hidden">
      {products.map((product) => {
        const stockLabel = stockLevelLabel(getStockLevel(product.current_quantity))
        return (
        <li key={product.id}>
          <Link
            to={`/inventory/${product.id}`}
            className="row-hover flex items-center justify-between gap-4 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{product.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {product.category ? (
                  <span className="rounded-full bg-inventory-soft px-2 py-0.5 text-[10px] font-bold text-inventory dark:bg-emerald-950 dark:text-emerald-300">
                    {product.category}
                  </span>
                ) : null}
                {stockLabel ? (
                  <span
                    className={cn(
                      'text-[10px] font-bold',
                      stockLabel === 'Out of stock'
                        ? 'text-danger'
                        : 'text-warning',
                    )}
                  >
                    {stockLabel === 'Out of stock' ? 'Out' : 'Low'}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-sm">
              <StockQuantity quantity={product.current_quantity} />
              <span className="font-bold tabular-nums text-accent">
                {formatMoney(product.retail_price)}
              </span>
            </div>
          </Link>
        </li>
        )
      })}
    </ul>
  )
}
