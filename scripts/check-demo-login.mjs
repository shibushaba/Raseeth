import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.log('MISSING_VITE_ENV')
  process.exit(1)
}

console.log('supabase_url', url)

const anon = createClient(url, key)

const demos = [
  { phone: '9876500001', password: 'DemoOwner123!' },
  { phone: '9876500002', password: 'DemoSalesman123!' },
  { phone: '9876500003', password: 'DemoManager123!' },
]

for (const demo of demos) {
  const { data: email, error: rpcError } = await anon.rpc(
    'get_email_for_phone_login',
    { p_phone: demo.phone },
  )
  console.log(
    demo.phone,
    'lookup:',
    rpcError?.message ?? (email ? email : 'NO_EMAIL'),
  )
  if (!email) continue
  const { error: signInError } = await anon.auth.signInWithPassword({
    email,
    password: demo.password,
  })
  console.log(demo.phone, 'sign-in:', signInError?.message ?? 'OK')
  if (!signInError) await anon.auth.signOut()
}
