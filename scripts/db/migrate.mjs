// Applies every supabase/migrations/*.sql file that has not run yet, in name order.
//
//   npm run db:migrate            apply pending migrations
//   npm run db:migrate -- --dry-run   list pending migrations without applying
//   npm run db:migrate:status     show applied and pending migrations
//
// Each file runs inside one transaction and is recorded in
// app_internal.schema_migrations, a schema the public API cannot see.

import fs from 'node:fs/promises'
import path from 'node:path'
import { connect, projectRoot } from './client.mjs'

const migrationsDir = path.join(projectRoot, 'supabase', 'migrations')
const flags = new Set(process.argv.slice(2))
const dryRun = flags.has('--dry-run')
const statusOnly = flags.has('--status')

const sql = await connect()

try {
  await sql`create schema if not exists app_internal`
  await sql`
    create table if not exists app_internal.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `

  const appliedRows = await sql`select version, applied_at from app_internal.schema_migrations order by version`
  const applied = new Map(appliedRows.map((row) => [row.version, row.applied_at]))
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
  const pending = files.filter((file) => !applied.has(file))

  if (statusOnly) {
    for (const file of files) {
      const appliedAt = applied.get(file)
      console.log(`${appliedAt ? 'applied' : 'pending'}  ${file}${appliedAt ? `  (${appliedAt.toISOString()})` : ''}`)
    }

    const orphaned = [...applied.keys()].filter((version) => !files.includes(version))

    for (const version of orphaned) {
      console.log(`missing  ${version}  (recorded as applied but the file is gone)`)
    }
  } else if (pending.length === 0) {
    console.log(`Nothing to do: all ${files.length} migrations are applied.`)
  } else if (dryRun) {
    console.log(`${pending.length} pending migration(s):`)
    pending.forEach((file) => console.log(`  ${file}`))
  } else {
    for (const file of pending) {
      const contents = await fs.readFile(path.join(migrationsDir, file), 'utf8')
      process.stdout.write(`Applying ${file} ... `)

      await sql.begin(async (tx) => {
        await tx.unsafe(contents)
        await tx`insert into app_internal.schema_migrations (version) values (${file})`
      })

      console.log('done')
    }

    console.log(`Applied ${pending.length} migration(s).`)
  }
} catch (error) {
  console.error('\nMigration failed and was rolled back.')
  console.error(error?.message ?? error)

  if (error?.position) {
    console.error(`(at character ${error.position} of the migration file)`)
  }

  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
