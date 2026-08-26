export type StockLevel = 'out' | 'low' | 'ok'

/** Subtle stock thresholds for list/detail indicators. */
export const LOW_STOCK_THRESHOLD = 20

export function getStockLevel(quantity: number): StockLevel {
  if (quantity <= 0) return 'out'
  if (quantity <= LOW_STOCK_THRESHOLD) return 'low'
  return 'ok'
}

export function stockLevelLabel(level: StockLevel): string | null {
  if (level === 'out') return 'Out of stock'
  if (level === 'low') return 'Low stock'
  return null
}
