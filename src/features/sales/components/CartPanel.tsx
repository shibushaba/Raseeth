import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  type CartItem,
  unitPriceForType,
} from '@/features/sales/cart'
import { formatMoney, lineTotal } from '@/lib/money'
import type { PriceType } from '@/types/database'

export function CartPanel({
  items,
  onQuantityChange,
  onPriceTypeChange,
  onCustomPriceChange,
  onRemove,
}: {
  items: CartItem[]
  onQuantityChange: (productId: string, quantity: number) => void
  onPriceTypeChange: (productId: string, priceType: PriceType) => void
  onCustomPriceChange: (productId: string, unitPrice: number) => void
  onRemove: (productId: string) => void
}) {
  if (items.length === 0) {
    return (
      <p className="border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
        Cart is empty. Search and add a product to start.
      </p>
    )
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const unit = unitPriceForType(item)
        const line = lineTotal(unit, item.quantity)
        const customInvalid =
          item.price_type === 'CUSTOM' && unitPriceForType(item) <= 0

        return (
          <li
            key={item.product_id}
            className="border-b border-neutral-200 pb-4 last:border-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{item.name}</p>
                <p className="font-mono text-xs text-neutral-500">
                  {item.product_code}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="md"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemove(item.product_id)}
              >
                Remove
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <label
                  className="mb-1 block text-xs uppercase tracking-wide text-neutral-500"
                  htmlFor={`qty-${item.product_id}`}
                >
                  Qty
                </label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 w-11 shrink-0 px-0"
                    aria-label={`Decrease ${item.name} quantity`}
                    disabled={item.quantity <= 1}
                    onClick={() =>
                      onQuantityChange(item.product_id, item.quantity - 1)
                    }
                  >
                    −
                  </Button>
                  <Input
                    id={`qty-${item.product_id}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={item.available_stock}
                    step={1}
                    className="min-w-0 text-center"
                    value={item.quantity}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (!Number.isFinite(n)) return
                      onQuantityChange(
                        item.product_id,
                        Math.max(1, Math.floor(n)),
                      )
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 w-11 shrink-0 px-0"
                    aria-label={`Increase ${item.name} quantity`}
                    disabled={item.quantity >= item.available_stock}
                    onClick={() =>
                      onQuantityChange(item.product_id, item.quantity + 1)
                    }
                  >
                    +
                  </Button>
                </div>
              </div>

              <div>
                <label
                  className="mb-1 block text-xs uppercase tracking-wide text-neutral-500"
                  htmlFor={`type-${item.product_id}`}
                >
                  Price type
                </label>
                <Select
                  id={`type-${item.product_id}`}
                  value={item.price_type}
                  onChange={(e) =>
                    onPriceTypeChange(
                      item.product_id,
                      e.target.value as PriceType,
                    )
                  }
                >
                  <option value="RETAIL">
                    Retail {formatMoney(item.retail_price)}
                  </option>
                  <option value="WHOLESALE">
                    Wholesale {formatMoney(item.wholesale_price)}
                  </option>
                  <option value="CUSTOM">Custom…</option>
                </Select>
              </div>

              <div>
                <label
                  className="mb-1 block text-xs uppercase tracking-wide text-neutral-500"
                  htmlFor={`price-${item.product_id}`}
                >
                  Unit price
                </label>
                {item.price_type === 'CUSTOM' ? (
                  <Input
                    id={`price-${item.product_id}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={item.unit_price}
                    aria-invalid={customInvalid}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (!Number.isFinite(n) || n < 0) return
                      onCustomPriceChange(item.product_id, n)
                    }}
                  />
                ) : (
                  <p className="flex h-11 items-center tabular-nums text-sm">
                    {formatMoney(unit)}
                  </p>
                )}
              </div>

              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
                  Line
                </p>
                <p className="flex h-11 items-center tabular-nums text-sm font-medium">
                  {formatMoney(line)}
                </p>
              </div>
            </div>

            {customInvalid ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                Custom price must be greater than zero.
              </p>
            ) : null}

            {item.quantity > item.available_stock ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                Only {item.available_stock} in stock.
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
