/**
 * Apply supabase/migrations to the linked remote database.
 *
 * Requires in .env.local (never commit):
 *   VITE_SUPABASE_URL
 *   SUPABASE_DB_PASSWORD   — Database password from Supabase → Project Settings → Database
 *
 * Optional: SUPABASE_DB_URL (full postgres URL overrides password + host build)
 */
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
const PURGE_MIGRATIONS = new Set([
  '20261001100000',
  '20261001110000',
])
const withPurge = process.argv.includes('--with-purge')

function projectRefFromSupabaseUrl(url) {
  return new URL(url).hostname.split('.')[0]
}

function buildDatabaseUrl() {
  if (process.env.SUPABASE_DB_URL?.trim()) {
    return process.env.SUPABASE_DB_URL.trim()
  }
  const password = process.env.SUPABASE_DB_PASSWORD?.trim()
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  if (!password || !supabaseUrl) return null
  const ref = projectRefFromSupabaseUrl(supabaseUrl)
  const host = process.env.SUPABASE_DB_HOST?.trim() || `db.${ref}.supabase.co`
  const port = process.env.SUPABASE_DB_PORT?.trim() || '5432'
  const user = process.env.SUPABASE_DB_USER?.trim() || 'postgres'
  const database = process.env.SUPABASE_DB_NAME?.trim() || 'postgres'
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

function migrationVersion(filename) {
  const base = filename.replace(/\.sql$/, '')
  const match = base.match(/^(\d{14})/)
  return match ? match[1] : base
}

function listMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      version: migrationVersion(f),
      file: path.join(migrationsDir, f),
    }))
}

async function ensureMigrationsTable(sql) {
  await sql`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations
  `
  await sql`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      statements text[],
      name text
    )
  `
}

async function appliedVersions(sql) {
  try {
    const rows = await sql`
      SELECT version FROM supabase_migrations.schema_migrations ORDER BY version
    `
    return new Set(rows.map((r) => r.version))
  } catch {
    return new Set()
  }
}

const dbUrl = buildDatabaseUrl()
if (!dbUrl) {
  console.error(
    [
      'Missing database credentials.',
      'Add SUPABASE_DB_PASSWORD to .env.local (Supabase → Project Settings → Database),',
      'or set SUPABASE_DB_URL to the full postgres connection string.',
      'Then run: npm run db:push',
    ].join('\n'),
  )
  process.exit(1)
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 30 })

try {
  await ensureMigrationsTable(sql)
  const applied = await appliedVersions(sql)
  const files = listMigrationFiles()
  let pending = files.filter((m) => !applied.has(m.version))
  const skippedPurges = pending.filter((m) => PURGE_MIGRATIONS.has(m.version))
  if (!withPurge && skippedPurges.length > 0) {
    pending = pending.filter((m) => !PURGE_MIGRATIONS.has(m.version))
    console.log(
      'Skipping %d purge migration(s) (pass --with-purge to apply): %s',
      skippedPurges.length,
      skippedPurges.map((m) => m.version).join(', '),
    )
  }

  if (pending.length === 0) {
    console.log('Database is up to date (%d migrations).', files.length)
    process.exit(0)
  }

  console.log('Applying %d pending migration(s)…', pending.length)

  for (const migration of pending) {
    const body = fs.readFileSync(migration.file, 'utf8')
    console.log('→ %s', migration.version)
    await sql.begin(async (tx) => {
      await tx.unsafe(body)
      await tx`
        INSERT INTO supabase_migrations.schema_migrations (version, name)
        VALUES (${migration.version}, ${migration.version})
        ON CONFLICT (version) DO NOTHING
      `
    })
  }

  console.log('Done. Applied %d migration(s).', pending.length)
} catch (err) {
  console.error('db:push failed:', err.message ?? err)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
