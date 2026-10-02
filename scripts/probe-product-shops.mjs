import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: products, error } = await admin
  .from('products')
  .select('id, shop_id, name, product_code')
if (error) {
  console.error(error.message)
  process.exit(1)
}

const byShop = new Map()
for (const p of products ?? []) {
  const k = p.shop_id ?? 'null'
  byShop.set(k, (byShop.get(k) ?? 0) + 1)
}
console.log('total products', products?.length ?? 0)
console.log('by shop_id', Object.fromEntries(byShop))

const { data: shops } = await admin.from('shops').select('id, name').order('created_at')
console.log('shops', shops)

const { data: members } = await admin
  .from('shop_members')
  .select('shop_id, profile_id, profiles(full_name, role)')
const salesman = (members ?? []).filter((m) => m.profiles?.role === 'SALESMAN')
console.log('salesman memberships', salesman.length)
