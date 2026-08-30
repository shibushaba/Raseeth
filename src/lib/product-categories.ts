/** Common retail categories for product creation and filtering. */
export const PRODUCT_CATEGORY_PRESETS = [
  'Groceries',
  'Beverages',
  'Snacks',
  'Personal Care',
  'Household',
  'Electronics',
  'Stationery',
  'Other',
] as const

export function uniqueCategories(
  products: Array<{ category: string | null }>,
): string[] {
  const fromProducts = products
    .map((p) => p.category?.trim())
    .filter((c): c is string => Boolean(c))
  const merged = new Set([...PRODUCT_CATEGORY_PRESETS, ...fromProducts])
  return [...merged].sort((a, b) => a.localeCompare(b))
}
