import { getStockLevel } from '@/lib/stock'
import type { Product } from '@/types/database'

export type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'

export type ProductSortKey =
  | 'name_asc'
  | 'name_desc'
  | 'stock_high'
  | 'stock_low'
  | 'price_high'
  | 'price_low'

export const STOCK_FILTER_LABELS: Record<StockFilter, string> = {
  all: 'All products',
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
}

export const SORT_LABELS: Record<ProductSortKey, string> = {
  name_asc: 'Name A–Z',
  name_desc: 'Name Z–A',
  stock_high: 'Stock high to low',
  stock_low: 'Stock low to high',
  price_high: 'Price high to low',
  price_low: 'Price low to high',
}

export function filterProductsByStock(
  products: Product[],
  filter: StockFilter,
): Product[] {
  if (filter === 'all') return products
  return products.filter((p) => {
    const level = getStockLevel(p.current_quantity)
    if (filter === 'in_stock') return level === 'ok'
    if (filter === 'low_stock') return level === 'low'
    return level === 'out'
  })
}

export function filterProductsByCategory(
  products: Product[],
  category: string | null,
): Product[] {
  if (!category) return products
  const needle = category.toLowerCase()
  return products.filter((p) => p.category?.toLowerCase() === needle)
}

export function sortProducts(
  products: Product[],
  sortKey: ProductSortKey,
): Product[] {
  const sorted = [...products]
  sorted.sort((a, b) => {
    switch (sortKey) {
      case 'name_desc':
        return b.name.localeCompare(a.name)
      case 'stock_high':
        return b.current_quantity - a.current_quantity
      case 'stock_low':
        return a.current_quantity - b.current_quantity
      case 'price_high':
        return Number(b.retail_price) - Number(a.retail_price)
      case 'price_low':
        return Number(a.retail_price) - Number(b.retail_price)
      case 'name_asc':
      default:
        return a.name.localeCompare(b.name)
    }
  })
  return sorted
}

export function applyProductFilters(
  products: Product[],
  options: {
    category: string | null
    stockFilter: StockFilter
    sortKey: ProductSortKey
  },
): Product[] {
  let result = filterProductsByCategory(products, options.category)
  result = filterProductsByStock(result, options.stockFilter)
  return sortProducts(result, options.sortKey)
}
