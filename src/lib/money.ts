/**
 * Money helpers.
 * Database stores NUMERIC(12,2). Supabase returns these as strings.
 * Never use IEEE floats for currency arithmetic in business logic.
 */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Parse a DB numeric / form string into a fixed 2-decimal number for display math. */
export function parseMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/** Format for UI (₹). */
export function formatMoney(value: string | number | null | undefined): string {
  return INR.format(parseMoney(value))
}

/** Line total from unit price × qty using integer paise (minor units). */
export function lineTotal(
  unitPrice: string | number,
  quantity: number,
): number {
  return fromCents(toCents(unitPrice) * quantity)
}

/** Convert rupees to integer paise. */
export function toCents(value: string | number | null | undefined): number {
  return Math.round(parseMoney(value) * 100)
}

/** Convert integer paise to rupees. */
export function fromCents(cents: number): number {
  return cents / 100
}

/** Sum cart lines in paise, return rupees. */
export function sumCartTotal(
  lines: Array<{ unit_price: string | number; quantity: number }>,
): number {
  const cents = lines.reduce(
    (acc, line) => acc + toCents(line.unit_price) * line.quantity,
    0,
  )
  return fromCents(cents)
}

/** Serialize for RPC / inserts as a stable decimal string. */
export function toMoneyString(value: string | number): string {
  return parseMoney(value).toFixed(2)
}
