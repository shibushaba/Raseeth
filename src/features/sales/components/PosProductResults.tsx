import { formatMoney } from '@/lib/money'
import type { Product } from '@/types/database'
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
      <p className="text-center text-sm font-medium text-muted">
        Search to add products
      </p>
    )
  }

  if (isLoading) {
    return (
      <p className="text-center text-sm font-medium text-muted" aria-busy="true">
        Loading…
      </p>
    )
  }

  if (products.length === 0) {
    return (
      <p className="text-center text-sm font-medium text-muted">
        No products found
      </p>
    )
  }

  const visible = products.slice(0, 8)
  const highlightId = bestMatchId(visible, search)

  return (
    <div className="grid grid-cols-2 gap-3">
      {visible.map((product) => {
        const isOut = product.current_quantity <= 0
        const isBest = product.id === highlightId
        return (
          <button
            key={product.id}
            type="button"
            disabled={isOut}
            onClick={() => !isOut && onAdd(product)}
            className={cn(
              'card flex flex-col p-4 text-left transition-transform active:scale-[0.98]',
              isBest && 'ring-2 ring-accent/40',
              isOut && 'opacity-50',
            )}
          >
            <p className="line-clamp-2 text-sm font-extrabold leading-tight text-foreground">
              {product.name}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted">
              {product.current_quantity} in stock
            </p>
            <p className="mt-2 text-base font-extrabold tabular-nums text-accent">
              {formatMoney(product.retail_price)}
            </p>
            <p className="text-xs font-bold tabular-nums text-danger">
              {formatMoney(product.wholesale_price)}
            </p>
            {!isOut ? (
              <span className="mt-3 w-full rounded-xl bg-accent py-1.5 text-center text-xs font-bold text-white">
                + Add
              </span>
            ) : (
              <span className="mt-3 text-center text-xs font-bold text-danger">
                Out of stock
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
