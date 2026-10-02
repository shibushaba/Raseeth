/**
 * Quick check which RPC signatures exist on the linked Supabase project.
 * Uses service role from .env.local (never commit).
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function rpcProbe(name, args) {
  const { error } = await admin.rpc(name, args)
  if (!error) return 'ok'
  const msg = error.message ?? ''
  if (/could not find the function/i.test(msg) || error.code === 'PGRST202') {
    return 'missing'
  }
  return `err:${msg.slice(0, 80)}`
}

const checks = [
  ['create_product (8-arg)', 'create_product', {
    p_name: 'Probe',
    p_retail_price: 1,
    p_wholesale_price: 1,
    p_initial_quantity: 0,
    p_minimum_quantity: 5,
  }],
  ['get_stock_alert_products', 'get_stock_alert_products', {}],
  ['list_shops', 'list_shops', {}],
  ['get_owner_network_overview', 'get_owner_network_overview', {
    p_range_start: new Date().toISOString(),
    p_range_end: new Date().toISOString(),
  }],
  ['create_shop_with_manager', 'create_shop_with_manager', {
    p_shop_name: 'x',
    p_manager_name: 'x',
    p_manager_phone: '9999999999',
    p_manager_password: 'x',
  }],
]

const { data: cols } = await admin
  .from('products')
  .select('minimum_quantity')
  .limit(1)
console.log(
  'products.minimum_quantity column:',
  cols === null ? 'missing table/column' : 'present',
)

for (const [label, name, args] of checks) {
  const result = await rpcProbe(name, args)
  console.log(`${label}: ${result}`)
}
