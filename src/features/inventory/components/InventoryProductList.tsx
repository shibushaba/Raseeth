import { Link } from 'react-router-dom'

import { StockQuantity } from '@/features/inventory/components/StockQuantity'
import { formatMoney } from '@/lib/money'
import type { Product } from '@/types/database'

export function InventoryProductList({ products }: { products: Product[] }) {
  return (
    <>
      <div className="panel hidden overflow-hidden md:block">
        <table className="app-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Stock</th>
              <th className="text-right">Retail</th>
              <th className="text-right">Wholesale</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link
                    to={`/inventory/${product.id}`}
                    className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  >
                    <span className="font-medium group-hover:underline">
                      {product.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-muted">
                      {product.product_code}
                    </span>
                  </Link>
                </td>
                <td>
                  <StockQuantity quantity={product.current_quantity} />
                </td>
                <td className="text-right tabular-nums">
                  {formatMoney(product.retail_price)}
                </td>
                <td className="text-right tabular-nums">
                  {formatMoney(product.wholesale_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="panel divide-y divide-border md:hidden">
        {products.map((product) => (
          <li key={product.id}>
            <Link
              to={`/inventory/${product.id}`}
              className="block px-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{product.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {product.product_code}
                  </p>
                </div>
                <StockQuantity quantity={product.current_quantity} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">Retail</dt>
                  <dd className="tabular-nums">
                    {formatMoney(product.retail_price)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Wholesale</dt>
                  <dd className="tabular-nums">
                    {formatMoney(product.wholesale_price)}
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
