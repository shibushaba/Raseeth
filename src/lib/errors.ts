/** Maps Supabase / Postgres / RPC failures to short user-facing copy. */

const PATTERNS: Array<{ match: RegExp; message: string }> = [
  {
    match: /invalid login credentials|invalid credentials|email not confirmed/i,
    message: 'Unable to sign in. Check your email and password.',
  },
  {
    match: /only owners can view business summary/i,
    message: 'Only the owner can view business performance.',
  },
  {
    match: /only owners can view product profitability/i,
    message: 'Only the owner can view product profitability.',
  },
  {
    match: /only salesmen can create products/i,
    message: 'Only a salesman can create products.',
  },
  {
    match: /only salesmen can add stock/i,
    message: 'Only a salesman can add stock.',
  },
  {
    match: /only salesmen can adjust stock/i,
    message: 'Only a salesman can adjust stock.',
  },
  {
    match: /only salesmen can create sales/i,
    message: 'Only a salesman can create sales.',
  },
  {
    match: /sale cart cannot be empty/i,
    message: 'Add at least one product to the cart.',
  },
  {
    match: /sale quantity must be positive/i,
    message: 'Quantity must be greater than zero.',
  },
  {
    match: /unit price cannot be negative/i,
    message: 'Price cannot be negative.',
  },
  {
    match: /invalid custom unit price/i,
    message: 'Enter a valid custom price.',
  },
  {
    match: /duplicate products in cart/i,
    message: 'Each product can only appear once in the cart.',
  },
  {
    match: /product name is required/i,
    message: 'Product name is required.',
  },
  {
    match: /prices cannot be negative/i,
    message: 'Prices cannot be negative.',
  },
  {
    match: /initial quantity cannot be negative/i,
    message: 'Initial quantity cannot be negative.',
  },
  {
    match: /stock quantity must be positive/i,
    message: 'Enter a quantity greater than zero.',
  },
  {
    match: /unit cost cannot be negative/i,
    message: 'Purchase price cannot be negative.',
  },
  {
    match: /adjustment quantity cannot be zero/i,
    message: 'Adjustment quantity cannot be zero.',
  },
  {
    match: /adjustment reason is required/i,
    message: 'Please provide a reason for the adjustment.',
  },
  {
    match: /adjustment would result in negative inventory/i,
    message: 'This adjustment would make stock negative.',
  },
  {
    match: /insufficient inventory|INSUFFICIENT_STOCK/i,
    message: 'Not enough stock to complete this sale.',
  },
  {
    match: /product not found/i,
    message: 'That product could not be found.',
  },
  {
    match: /row-level security|permission denied|42501/i,
    message: "You don't have permission to perform this action.",
  },
  {
    match: /check constraint|23514/i,
    message: 'The values entered are not valid.',
  },
  {
    match: /unique|23505/i,
    message: 'A record with that identifier already exists.',
  },
  {
    match: /sale item has no inventory cost/i,
    message: 'This sale has no cost snapshot and cannot be returned yet.',
  },
  {
    match: /only salesmen can create returns/i,
    message: 'Only a salesman can process returns.',
  },
  {
    match: /return must include at least one item/i,
    message: 'Select at least one item to return.',
  },
  {
    match: /return quantity must be positive/i,
    message: 'Return quantity must be greater than zero.',
  },
  {
    match: /invalid refund method/i,
    message: 'Choose a valid refund method.',
  },
  {
    match: /sale item not found/i,
    message: 'That sale item could not be found.',
  },
  {
    match: /sale not found/i,
    message: 'That sale could not be found.',
  },
  {
    match: /all return items must belong to the same sale/i,
    message: 'Return items must belong to the same sale.',
  },
  {
    match: /payment amount must be greater than zero/i,
    message: 'Payment amount must be greater than zero.',
  },
  {
    match: /at least one payment is required/i,
    message: 'Add at least one payment method.',
  },
  {
    match: /invalid payment method/i,
    message: 'Choose a valid payment method.',
  },
  {
    match: /custom unit price must be greater than zero/i,
    message: 'Custom price must be greater than zero.',
  },
  {
    match: /only read status can be updated/i,
    message: "You don't have permission to change that message.",
  },
  {
    match: /message cannot be empty/i,
    message: 'Please enter a valid message.',
  },
  {
    match: /message is too long/i,
    message: 'Message is too long. Keep it under 2000 characters.',
  },
  {
    match: /no recipient available/i,
    message: 'No recipient is available to receive this message.',
  },
  {
    match: /not authorized/i,
    message: "You don't have permission to do that.",
  },
  {
    match: /permission denied for table messages/i,
    message: "You don't have permission to send this message.",
  },
  {
    match: /network|fetch/i,
    message: 'Network error. Check your connection and try again.',
  },
]

export function toUserMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''

  if (!raw) return fallback

  const stock = raw.match(/INSUFFICIENT_STOCK\|([^|]+)\|(\d+)\|(\d+)/i)
  if (stock) {
    const [, name, available, requested] = stock
    return `Not enough ${name} in stock. Available: ${available}. Requested: ${requested}.`
  }

  const under = raw.match(/PAYMENT_UNDER\|([^|]+)\|([^|]+)/i)
  if (under) {
    const paid = Number(under[1])
    const total = Number(under[2])
    const remaining = Math.round((total - paid) * 100) / 100
    return `Payment total must equal sale total. ₹${remaining.toFixed(2)} remaining.`
  }

  const over = raw.match(/PAYMENT_OVER\|([^|]+)\|([^|]+)/i)
  if (over) {
    const paid = Number(over[1])
    const total = Number(over[2])
    const excess = Math.round((paid - total) * 100) / 100
    return `Payment total must equal sale total. Excess ₹${excess.toFixed(2)}.`
  }

  const excessReturn = raw.match(/RETURN_EXCESS\|(\d+)\|(\d+)/i)
  if (excessReturn) {
    const available = excessReturn[1]
    return `Only ${available} units remain available for return.`
  }

  if (/COST_UNAVAILABLE/i.test(raw)) {
    return 'This sale has no cost snapshot and cannot be returned yet.'
  }

  for (const { match, message } of PATTERNS) {
    if (match.test(raw)) return message
  }

  if (/^[A-Z0-9_]{5,}$/i.test(raw.trim()) || /\d{5}/.test(raw)) {
    return fallback
  }

  if (raw.length > 160) return fallback

  return raw
}

export function logTechnicalError(context: string, error: unknown): void {
  console.error(`[raseeth:${context}]`, error)
}
