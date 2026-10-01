/**
 * Removes all sales, returns, payments, and related inventory movements.
 * Re-syncs product quantities from PURCHASE/ADJUSTMENT movements only.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Run: npm run purge:sales
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

async function deleteSaleReturnMovements() {
  const { error, count } = await admin
    .from('inventory_movements')
    .delete({ count: 'exact' })
    .in('movement_type', ['SALE', 'RETURN'])
  if (error) throw new Error(`inventory_movements: ${error.message}`)
  return count ?? 0
}

async function resyncProductQuantities() {
  const { data: products, error: listError } = await admin
    .from('products')
    .select('id')
  if (listError) throw new Error(listError.message)

  for (const { id } of products ?? []) {
    const { data: movements, error: movError } = await admin
      .from('inventory_movements')
      .select('quantity')
      .eq('product_id', id)
    if (movError) throw new Error(movError.message)

    const qty = (movements ?? []).reduce((sum, row) => sum + row.quantity, 0)
    const { error: updError } = await admin
      .from('products')
      .update({ current_quantity: qty })
      .eq('id', id)
    if (updError) throw new Error(updError.message)
  }
}

// Prefer RPC when deployed (owner-checked, single transaction).
const anon = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { error: signInError } = await anon.auth.signInWithPassword({
  email: 'owner@raseeth.demo',
  password: 'DemoOwner123!',
})

if (!signInError) {
  const { data, error: rpcError } = await anon.rpc('purge_all_sales_data')
  await anon.auth.signOut()
  if (!rpcError) {
    console.log('All sales data removed (RPC).')
    console.log(JSON.stringify(data, null, 2))
    process.exit(0)
  }
}

console.log('RPC unavailable — purging with service role…')

const counts = {
  refunds: await deleteAll('refunds'),
  return_items: await deleteAll('return_items'),
  returns: await deleteAll('returns'),
  payments: await deleteAll('payments'),
  sale_items: await deleteAll('sale_items'),
  sale_return_movements: await deleteSaleReturnMovements(),
  sales: await deleteAll('sales'),
}

await resyncProductQuantities()

console.log('All sales data removed.')
console.log(JSON.stringify(counts, null, 2))
