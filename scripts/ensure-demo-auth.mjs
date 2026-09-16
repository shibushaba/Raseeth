/**
 * Syncs Supabase Auth passwords and profile phones with README / tap-login demo personas.
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
  const user = listed.users.find((u) => u.email === demo.email)
  if (!user) {
    console.error(`Missing auth user ${demo.email} — create in Supabase Dashboard first.`)
    process.exit(1)
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
    .update({
      phone: demo.phone,
      role: demo.role,
      full_name: demo.full_name,
    })
    .eq('id', user.id)

  if (profileError) {
    console.error(`profile ${demo.email}:`, profileError.message)
    process.exit(1)
  }

  console.log(`OK ${demo.email} → ${demo.phone}`)
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
