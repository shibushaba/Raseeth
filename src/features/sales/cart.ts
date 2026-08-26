import { parseMoney } from '@/lib/money'
import type { PriceType, Product } from '@/types/database'

export type CartItem = {
  product_id: string
  product_code: string
  name: string
  quantity: number
  price_type: PriceType
  /** Display / CUSTOM unit price in rupees */
  unit_price: number
  /** Snapshot of stock when last added/updated — for client UX checks */
  available_stock: number
  retail_price: number
  wholesale_price: number
}

export function unitPriceForType(
  item: Pick<CartItem, 'price_type' | 'unit_price' | 'retail_price' | 'wholesale_price'>,
): number {
  if (item.price_type === 'RETAIL') return item.retail_price
  if (item.price_type === 'WHOLESALE') return item.wholesale_price
  return item.unit_price
}

export function productToCartSeed(product: Product): Omit<CartItem, 'quantity'> {
  return {
    product_id: product.id,
    product_code: product.product_code,
    name: product.name,
    price_type: 'RETAIL',
    unit_price: parseMoney(product.retail_price),
    available_stock: product.current_quantity,
    retail_price: parseMoney(product.retail_price),
    wholesale_price: parseMoney(product.wholesale_price),
  }
}
