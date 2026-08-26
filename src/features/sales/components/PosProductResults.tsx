import { formatMoney } from '@/lib/money'
import type { Product } from '@/types/database'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function bestMatchId(products: Product[], search: string): string | null {
  if (products.length === 0) return null
  const needle = search.trim().toLowerCase()
  const exact = products.find((p) => p.product_code.toLowerCase() === needle)
  if (exact) return exact.id
  const inStock = products.find((p) => p.current_quantity > 0)
  return (inStock ?? products[0]).id
}

export function PosProductResults({
  products,
  isLoading,
  search,
  onAdd,
}: {
  products: Product[]
  isLoading: boolean
  search: string
  onAdd: (product: Product) => void
}) {
  if (!search.trim()) {
    return (
      <p className="text-sm text-muted">
        Search by product name or Product ID to add items.
      </p>
    )
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted" aria-busy="true">
        Loading products…
      </p>
    )
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted">
        No products found. Try another name or Product ID.
      </p>
    )
  }

  const visible = products.slice(0, 8)
  const highlightId = bestMatchId(visible, search)

  return (
    <div>
      <ul className="panel divide-y divide-border">
        {visible.map((product) => (
          <li
            key={product.id}
            className={cn(
              'flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
              product.id === highlightId && 'bg-neutral-50',
            )}
          >
            <div className="min-w-0">
              <p className="font-medium">
                {product.name}
                {product.id === highlightId ? (
                  <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-muted">
                    Best match
                  </span>
                ) : null}
              </p>
              <p className="font-mono text-xs text-muted">
                {product.product_code}
              </p>
              <p className="mt-1 text-sm text-muted">
                Stock: {product.current_quantity}
                <span className="mx-2 text-border-strong">·</span>
                Retail: {formatMoney(product.retail_price)}
                <span className="mx-2 text-border-strong">·</span>
                Wholesale: {formatMoney(product.wholesale_price)}
              </p>
            </div>
            <Button
              type="button"
              size="md"
              className="shrink-0 self-start sm:self-center"
              disabled={product.current_quantity <= 0}
              aria-label={`Add ${product.name}`}
              onClick={() => onAdd(product)}
            >
              {product.current_quantity <= 0 ? 'Out of stock' : 'Add'}
            </Button>
          </li>
        ))}
      </ul>
      {products.length > 8 ? (
        <p className="mt-2 text-xs text-muted">
          Showing 8 of {products.length}. Refine search for more.
        </p>
      ) : null}
    </div>
  )
}
