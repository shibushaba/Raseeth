/**
 * Lightweight checks for inventory/sales helpers (no Supabase required).
 * Run: node scripts/verify-inventory-helpers.mjs
 */

function getStockLevel(quantity) {
  if (quantity <= 0) return 'out'
  if (quantity <= 20) return 'low'
  return 'ok'
}

function toUserMessage(error, fallback = 'Something went wrong. Please try again.') {
  const PATTERNS = [
    [/only salesmen can add stock/i, 'Only a salesman can add stock.'],
    [/only salesmen can create sales/i, 'Only a salesman can create sales.'],
    [/adjustment would result in negative inventory/i, 'This adjustment would make stock negative.'],
    [/row-level security|permission denied|42501/i, 'You do not have permission to perform this action.'],
    [/check constraint|23514/i, 'The values entered are not valid for inventory.'],
  ]
  const raw = error instanceof Error ? error.message : String(error ?? '')
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
    return `₹${remaining.toFixed(2)} remaining.`
  }
  const over = raw.match(/PAYMENT_OVER\|([^|]+)\|([^|]+)/i)
  if (over) {
    const paid = Number(over[1])
    const total = Number(over[2])
    const excess = Math.round((paid - total) * 100) / 100
    return `Payment exceeds sale total by ₹${excess.toFixed(2)}.`
  }
  const excessReturn = raw.match(/RETURN_EXCESS\|(\d+)\|(\d+)/i)
  if (excessReturn) {
    return `Only ${excessReturn[1]} units remain available for return.`
  }
  for (const [match, message] of PATTERNS) {
    if (match.test(raw)) return message
  }
  return fallback
}

const asserts = []
function assert(cond, msg) {
  asserts.push({ ok: Boolean(cond), msg })
}

assert(getStockLevel(120) === 'ok', '120 is normal stock')
assert(getStockLevel(16) === 'low', '16 is low stock')
assert(getStockLevel(0) === 'out', '0 is out of stock')
assert(
  toUserMessage(new Error('Only salesmen can add stock')) ===
    'Only a salesman can add stock.',
  'maps salesman RPC denial',
)
assert(
  toUserMessage(new Error('23514 check constraint violated')) ===
    'The values entered are not valid for inventory.',
  'maps check constraint',
)
assert(
  toUserMessage(new Error('new row violates row-level security policy')) ===
    'You do not have permission to perform this action.',
  'maps RLS denial',
)
assert(
  toUserMessage(new Error('INSUFFICIENT_STOCK|Coca Cola 500ml|8|10')) ===
    'Not enough Coca Cola 500ml in stock. Available: 8. Requested: 10.',
  'maps insufficient stock detail',
)
assert(
  toUserMessage(new Error('Only salesmen can create sales')) ===
    'Only a salesman can create sales.',
  'maps create sale role denial',
)

assert(
  toUserMessage(new Error('PAYMENT_UNDER|500|850')) === '₹350.00 remaining.',
  'maps underpayment remaining',
)
assert(
  toUserMessage(new Error('PAYMENT_OVER|900|850')) ===
    'Payment exceeds sale total by ₹50.00.',
  'maps overpayment excess',
)

assert(
  toUserMessage(new Error('RETURN_EXCESS|7|8')) ===
    'Only 7 units remain available for return.',
  'maps excess return remaining',
)

const failed = asserts.filter((a) => !a.ok)
for (const a of asserts) {
  console.log(`${a.ok ? 'PASS' : 'FAIL'} — ${a.msg}`)
}

if (failed.length) {
  process.exitCode = 1
} else {
  console.log(`\n${asserts.length} checks passed.`)
}
