/**
 * Write supabase/bundles/apply-feature-migrations.sql for manual SQL Editor runs.
 * Excludes data-purge migrations.
 */
import fs from 'node:fs'
import path from 'node:path'

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
const outDir = path.join(process.cwd(), 'supabase', 'bundles')
const include = [
  '20261002120000_shop_isolation_rls.sql',
  '20261002130000_owner_network_scope.sql',
  '20261002200000_stock_manager_role_split.sql',
  '20261002210000_product_minimum_quantity.sql',
  '20261002220000_product_shop_sale_fix.sql',
]

const parts = [
  '-- Raseeth feature migrations (safe bundle — no data purges)',
  '-- Run in Supabase Dashboard → SQL → New query',
  '-- Then: npm run demo:ensure-auth',
  '',
]

for (const name of include) {
  const file = path.join(migrationsDir, name)
  if (!fs.existsSync(file)) {
    console.error('Missing migration:', name)
    process.exit(1)
  }
  const version = name.replace(/\.sql$/, '')
  parts.push(`-- ========== ${name} ==========`)
  parts.push(fs.readFileSync(file, 'utf8').trim())
  parts.push('')
  parts.push(
    `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version}', '${version}') ON CONFLICT (version) DO NOTHING;`,
  )
  parts.push('')
}

fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'apply-feature-migrations.sql')
fs.writeFileSync(outFile, parts.join('\n'))
console.log('Wrote %s (%d KB)', outFile, Math.round(fs.statSync(outFile).size / 1024))
