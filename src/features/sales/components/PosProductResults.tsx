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
      <p className="section-hint">
        Search by product name or Product ID to add items.
      </p>
    )
  }

  if (isLoading) {
    return (
      <p className="section-hint" aria-busy="true">
        Loading products…
      </p>
    )
  }

  if (products.length === 0) {
    return (
      <p className="section-hint">
        No products found. Try another name or Product ID.
      </p>
    )
  }

  const visible = products.slice(0, 8)
  const highlightId = bestMatchId(visible, search)

  return (
    <div>
      <ul className="card divide-y divide-border overflow-hidden">
        {visible.map((product) => (
          <li
            key={product.id}
            className={cn(
              'flex items-center justify-between gap-3 px-4 py-3',
              product.id === highlightId && 'bg-accent-soft/40',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{product.name}</p>
                {product.id === highlightId ? (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                    Best match
                  </span>
                ) : null}
              </div>
              <p className="font-mono text-xs text-muted">
                {product.product_code}
              </p>
              <p className="mt-1 text-sm text-muted">
                {formatMoney(product.retail_price)}
                <span className="mx-2 text-border-strong">·</span>
                {product.current_quantity} in stock
              </p>
            </div>
            <Button
              type="button"
              variant="accent"
              size="md"
              className="shrink-0"
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
        <p className="mt-2 section-hint">
          Showing 8 of {products.length}. Refine search for more.
        </p>
      ) : null}
    </div>
  )
}
