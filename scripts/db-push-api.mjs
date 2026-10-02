/**
 * Apply pending migrations via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN and VITE_SUPABASE_URL in env.
 */
import fs from 'node:fs'
import path from 'node:path'

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
if (!token || !supabaseUrl) {
  console.error('Need SUPABASE_ACCESS_TOKEN and VITE_SUPABASE_URL')
  process.exit(1)
}

const ref = new URL(supabaseUrl).hostname.split('.')[0]
const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
const PURGE = new Set(['20261001100000', '20261001110000'])
const withPurge = process.argv.includes('--with-purge')

async function runQuery(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${res.status} ${text.slice(0, 500)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function migrationVersion(filename) {
  const base = filename.replace(/\.sql$/, '')
  const match = base.match(/^(\d{14})/)
  return match ? match[1] : base
}

function listMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      version: migrationVersion(f),
      file: path.join(migrationsDir, f),
    }))
}

const appliedRows = await runQuery(
  'SELECT version FROM supabase_migrations.schema_migrations',
)
const applied = new Set(
  Array.isArray(appliedRows) ? appliedRows.map((r) => r.version) : [],
)

let pending = listMigrations().filter((m) => !applied.has(m.version))
if (!withPurge) {
  pending = pending.filter((m) => !PURGE.has(m.version))
}

if (pending.length === 0) {
  console.log('Remote database is up to date.')
  process.exit(0)
}

console.log('Applying %d migration(s) via Management API…', pending.length)

for (const migration of pending) {
  const sql = fs.readFileSync(migration.file, 'utf8')
  console.log('→ %s', migration.version)
  const insert = `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${migration.version}', '${migration.version}') ON CONFLICT (version) DO NOTHING;`
  try {
    await runQuery(sql)
    await runQuery(insert)
  } catch (err) {
    console.error('Failed on %s:', migration.version, err.message)
    process.exit(1)
  }
}

console.log('Done.')
