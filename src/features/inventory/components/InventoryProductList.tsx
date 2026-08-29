import { Link } from 'react-router-dom'

import { StockQuantity } from '@/features/inventory/components/StockQuantity'
import { formatMoney } from '@/lib/money'
import type { Product } from '@/types/database'

export function InventoryProductList({ products }: { products: Product[] }) {
  return (
    <ul className="card divide-y divide-border overflow-hidden">
      {products.map((product) => (
        <li key={product.id}>
          <Link
            to={`/inventory/${product.id}`}
            className="row-hover flex items-center justify-between gap-4 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{product.name}</p>
              <p className="font-mono text-xs text-muted">
                {product.product_code}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-sm">
              <StockQuantity quantity={product.current_quantity} />
              <span className="hidden tabular-nums text-muted sm:inline">
                {formatMoney(product.retail_price)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
