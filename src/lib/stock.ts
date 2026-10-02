export type StockLevel = 'out' | 'low' | 'ok'

/** Fallback when minimum_quantity is missing on legacy rows. */
export const LOW_STOCK_THRESHOLD = 20

export function resolveMinimumQuantity(minimumQuantity?: number | null): number {
  if (minimumQuantity === null || minimumQuantity === undefined) {
    return LOW_STOCK_THRESHOLD
  }
  return minimumQuantity
}

export function getStockLevel(
  quantity: number,
  minimumQuantity?: number | null,
): StockLevel {
  if (quantity <= 0) return 'out'
  const min = resolveMinimumQuantity(minimumQuantity)
  if (quantity <= min) return 'low'
  return 'ok'
}

export function productNeedsStockAttention(product: {
  current_quantity: number
  minimum_quantity?: number | null
}): boolean {
  if (product.current_quantity <= 0) return true
  return product.current_quantity <= resolveMinimumQuantity(product.minimum_quantity)
}

/** Single source of truth for low / out counts and alert lists. */
export function partitionStockAlerts<
  T extends { current_quantity: number; minimum_quantity?: number | null },
>(products: T[]): {
  outOfStock: T[]
  lowStock: T[]
  alertProducts: T[]
} {
  const outOfStock = products.filter((p) => p.current_quantity === 0)
  const lowStock = products.filter(
    (p) =>
      p.current_quantity > 0 &&
      getStockLevel(p.current_quantity, p.minimum_quantity) === 'low',
  )
  return {
    outOfStock,
    lowStock,
    alertProducts: [...outOfStock, ...lowStock],
  }
}

export function stockLevelLabel(level: StockLevel): string | null {
  if (level === 'out') return 'Out of stock'
  if (level === 'low') return 'Low stock'
  return null
}
