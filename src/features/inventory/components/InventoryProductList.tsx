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
              className="block rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {product.category ? (
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {product.category}
                    </div>
                  ) : null}
                  <div className="text-sm font-extrabold text-gray-800">
                    {product.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {product.product_code} · Stock: {product.current_quantity}
                  </div>
                </div>
                <StatusPill level={level} />
              </div>

              <div className="mt-3 grid grid-cols-3 divide-x divide-violet-50 border-t border-violet-50 pt-3 text-center">
                <div>
                  <div className="text-[10px] font-bold uppercase text-gray-400">
                    Wholesale
                  </div>
                  <div className="text-sm font-extrabold text-red-500">
                    {formatMoney(product.wholesale_price)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-gray-400">
                    Retail
                  </div>
                  <div className="text-sm font-extrabold text-violet-700">
                    {formatMoney(product.retail_price)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-gray-400">
                    Margin
                  </div>
                  <div className="text-sm font-extrabold text-emerald-600">
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
