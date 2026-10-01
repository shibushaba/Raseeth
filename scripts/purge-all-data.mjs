/**
 * Wipes business data: sales, returns, products, inventory movements, messages.
 * Keeps auth users, profiles, shops, and shop team assignments.
 *
 * Run: npm run purge:data
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function deleteAll(table) {
  const { error, count } = await admin
    .from(table)
    .delete({ count: 'exact' })
    .not('id', 'is', null)
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function deleteAllMovements() {
  const { error, count } = await admin
    .from('inventory_movements')
    .delete({ count: 'exact' })
    .not('id', 'is', null)
  if (error) throw new Error(`inventory_movements: ${error.message}`)
  return count ?? 0
}

async function deleteAllMessages() {
  const { error, count } = await admin
    .from('messages')
    .delete({ count: 'exact' })
    .not('id', 'is', null)
  if (error) throw new Error(`messages: ${error.message}`)
  return count ?? 0
}

console.log('Purging all business data…')

const counts = {
  refunds: await deleteAll('refunds'),
  return_items: await deleteAll('return_items'),
  returns: await deleteAll('returns'),
  payments: await deleteAll('payments'),
  sale_items: await deleteAll('sale_items'),
  sales: await deleteAll('sales'),
  inventory_movements: await deleteAllMovements(),
  products: await deleteAll('products'),
  messages: await deleteAllMessages(),
}

console.log('Done. Catalog and transaction history cleared.')
console.log(JSON.stringify(counts, null, 2))
