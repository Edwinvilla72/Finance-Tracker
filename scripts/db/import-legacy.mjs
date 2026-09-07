// Copies anything still sitting in the legacy dashboard_states JSON blob into
// the normalized tables. Safe to run repeatedly: only legacy items newer than
// each user's last import are added, and settings rows the new app has already
// written are left alone.
//
//   npm run db:import-legacy
//
// Run it once more right before switching the deployed app to this version, so
// edits made through the old blob-based build carry over.

import { connect } from './client.mjs'

const sql = await connect()

try {
  const rows = await sql`select * from app_internal.import_legacy_dashboard_states()`
  const totals = new Map()

  for (const row of rows) {
    totals.set(row.table_name, (totals.get(row.table_name) ?? 0) + Number(row.rows_written))
  }

  const users = new Set(rows.map((row) => row.imported_user)).size

  if (users === 0) {
    console.log('No legacy dashboard_states rows found; nothing to import.')
  } else {
    console.log(`Checked ${users} user(s). Rows written per table:`)
    console.table(Object.fromEntries(totals))
  }
} finally {
  await sql.end({ timeout: 5 })
}
