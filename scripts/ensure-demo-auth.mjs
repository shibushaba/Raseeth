/**
 * Syncs Supabase Auth passwords and profile phones with README / tap-login demo personas.
 * Creates the demo manager auth user when missing and assigns them to the first shop.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never commit).
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

const DEMO = [
  {
    email: 'owner@raseeth.demo',
    password: 'DemoOwner123!',
    phone: '9876500001',
    role: 'OWNER',
    full_name: 'Demo Owner',
  },
  {
    email: 'salesman@raseeth.demo',
    password: 'DemoSalesman123!',
    phone: '9876500002',
    role: 'SALESMAN',
    full_name: 'Demo Salesman',
  },
  {
    email: 'manager@raseeth.demo',
    password: 'DemoManager123!',
    phone: '9876500003',
    role: 'MANAGER',
    full_name: 'Demo Stock Manager',
  },
]

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
})
if (listError) {
  console.error('listUsers:', listError.message)
  process.exit(1)
}

for (const demo of DEMO) {
  let user = listed.users.find((u) => u.email === demo.email)
  if (!user) {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: demo.email,
        password: demo.password,
        email_confirm: true,
      })
    if (createError) {
      console.error(`createUser ${demo.email}:`, createError.message)
      process.exit(1)
    }
    user = created.user
    console.log(`Created auth user ${demo.email}`)
  }

  const { error: pwError } = await admin.auth.admin.updateUserById(user.id, {
    password: demo.password,
    email_confirm: true,
  })
  if (pwError) {
    console.error(`password ${demo.email}:`, pwError.message)
    process.exit(1)
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: user.id,
      phone: demo.phone,
      role: demo.role,
      full_name: demo.full_name,
    })

  if (profileError) {
    console.error(`profile ${demo.email}:`, profileError.message)
    process.exit(1)
  }

  console.log(`OK ${demo.email} → ${demo.phone} (${demo.role})`)
}

const manager = DEMO.find((d) => d.role === 'MANAGER')
const managerUser = listed.users.find((u) => u.email === manager?.email)
const managerId =
  managerUser?.id ??
  (
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ).data.users.find((u) => u.email === manager?.email)?.id

if (managerId) {
  const { data: shops } = await admin.from('shops').select('id').limit(1)
  const shopId = shops?.[0]?.id
  if (shopId) {
    await admin
      .from('profiles')
      .update({ role: 'MANAGER' })
      .eq('id', managerId)
    await admin.from('shops').update({ manager_id: managerId }).eq('id', shopId)
    await admin.from('shop_members').upsert({
      shop_id: shopId,
      profile_id: managerId,
    })
    const salesman = DEMO.find((d) => d.role === 'SALESMAN')
    const salesmanUser = (
      await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    ).data.users.find((u) => u.email === salesman?.email)
    if (salesmanUser) {
      await admin
        .from('profiles')
        .update({ role: 'SALESMAN' })
        .eq('id', salesmanUser.id)
      const { data: allShops } = await admin.from('shops').select('id')
      for (const row of allShops ?? []) {
        await admin.from('shop_members').upsert({
          shop_id: row.id,
          profile_id: salesmanUser.id,
        })
      }
    }
    console.log('Assigned Demo Manager to first shop; salesman to all shops')
  }
}

const anon = createClient(url, process.env.VITE_SUPABASE_ANON_KEY)
for (const demo of DEMO) {
  const { data: email, error: rpcError } = await anon.rpc(
    'get_email_for_phone_login',
    { p_phone: demo.phone },
  )
  if (rpcError || email !== demo.email) {
    console.error(`RPC check failed for ${demo.phone}`)
    process.exit(1)
  }
  const { error: signInError } = await anon.auth.signInWithPassword({
    email: demo.email,
    password: demo.password,
  })
  if (signInError) {
    console.error(`Sign-in check failed for ${demo.email}:`, signInError.message)
    process.exit(1)
  }
  await anon.auth.signOut()
}

console.log('Demo auth verified (phone RPC + password sign-in).')
