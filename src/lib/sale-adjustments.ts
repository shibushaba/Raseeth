import { fromCents, parseMoney, toCents } from '@/lib/money'

export type SaleAdjustmentInput = {
  discountAmount: string
  discountPercent: string
  discountMode: 'amount' | 'percent'
  taxAmount: string
  taxPercent: string
  taxMode: 'amount' | 'percent'
  otherCharges: string
  note: string
}

export const DEFAULT_SALE_ADJUSTMENTS: SaleAdjustmentInput = {
  discountAmount: '',
  discountPercent: '',
  discountMode: 'amount',
  taxAmount: '',
  taxPercent: '18',
  taxMode: 'percent',
  otherCharges: '',
  note: '',
}

export type ResolvedSaleAdjustments = {
  subtotal: number
  discount: number
  tax: number
  other: number
  grandTotal: number
  note: string | null
}

function roundMoney(n: number): number {
  return fromCents(toCents(n))
}

export function resolveSaleAdjustments(
  subtotal: number,
  input: SaleAdjustmentInput,
): ResolvedSaleAdjustments {
  const safeSubtotal = Math.max(0, roundMoney(subtotal))

  let discount = 0
  if (input.discountMode === 'percent') {
    const pct = parseMoney(input.discountPercent || 0)
    discount = roundMoney(safeSubtotal * (Math.min(100, Math.max(0, pct)) / 100))
  } else {
    discount = roundMoney(parseMoney(input.discountAmount || 0))
  }
  discount = Math.min(discount, safeSubtotal)

  const afterDiscount = roundMoney(safeSubtotal - discount)

  let tax = 0
  if (input.taxMode === 'percent') {
    const pct = parseMoney(input.taxPercent || 0)
    tax = roundMoney(afterDiscount * (Math.max(0, pct) / 100))
  } else {
    tax = roundMoney(parseMoney(input.taxAmount || 0))
  }

  const other = roundMoney(parseMoney(input.otherCharges || 0))
  const grandTotal = roundMoney(afterDiscount + tax + other)
  const note = input.note.trim() || null

  return {
    subtotal: safeSubtotal,
    discount,
    tax,
    other,
    grandTotal: Math.max(0, grandTotal),
    note,
  }
}

export function adjustmentsForApi(resolved: ResolvedSaleAdjustments) {
  if (
    resolved.discount === 0 &&
    resolved.tax === 0 &&
    resolved.other === 0 &&
    !resolved.note
  ) {
    return undefined
  }
  return {
    discount_amount: resolved.discount,
    tax_amount: resolved.tax,
    other_charges: resolved.other,
    note: resolved.note,
  }
}
