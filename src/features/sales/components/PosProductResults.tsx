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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {visible.map((product) => {
        const isOut = product.current_quantity <= 0
        const isBest = product.id === highlightId
        return (
          <div
            key={product.id}
            className={cn(
              'card flex flex-col p-4',
              isBest && 'ring-2 ring-accent/40',
              isOut && 'opacity-60',
            )}
          >
            <p className="truncate text-sm font-extrabold text-foreground">
              {product.name}
            </p>
            <p className="mt-1 text-xs font-medium text-muted">
              {product.current_quantity} available
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-base font-extrabold text-accent tabular-nums">
                {formatMoney(product.retail_price)}
              </span>
              <Button
                type="button"
                variant="accent"
                size="sm"
                className="shrink-0 px-4"
                disabled={isOut}
                aria-label={`Add ${product.name}`}
                onClick={() => onAdd(product)}
              >
                {isOut ? 'Out' : 'Add'}
              </Button>
            </div>
          </div>
        )
      })}
      {products.length > 8 ? (
        <p className="col-span-full section-hint">
          Showing 8 of {products.length}. Refine search for more.
        </p>
      ) : null}
    </div>
  )
}
