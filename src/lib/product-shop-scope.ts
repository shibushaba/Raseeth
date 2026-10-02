/** Shop filter for product queries — one shop, many shops, or all (RLS-scoped). */
export type ProductShopScope = string | readonly string[] | null | undefined

export function productShopScopeKey(scope: ProductShopScope): string {
  if (scope == null) return 'all'
  if (typeof scope === 'string') return scope
  if (scope.length === 0) return 'none'
  return [...scope].sort().join(',')
}

export function productMatchesShopScope(
  productShopId: string | null,
  scope: ProductShopScope,
): boolean {
  if (scope == null) return true
  if (typeof scope === 'string') return productShopId === scope
  if (scope.length === 0) return false
  return productShopId != null && scope.includes(productShopId)
}
