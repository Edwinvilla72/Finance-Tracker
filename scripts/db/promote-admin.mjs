// Grants or removes the admin role for an account.
//
//   npm run db:promote-admin -- someone@example.com
//   npm run db:promote-admin -- someone@example.com --demote
//   npm run db:promote-admin -- --list
//
// The role column is not writable through the public API, so this script (or
// the Supabase SQL editor) is the only way to change it.

import { connect } from './client.mjs'

const args = process.argv.slice(2)
const listOnly = args.includes('--list')
const demote = args.includes('--demote')
const email = args.find((arg) => !arg.startsWith('--'))

if (!listOnly && !email) {
  console.error('Usage: npm run db:promote-admin -- <email> [--demote] | --list')
  process.exit(1)
}

const sql = await connect()

try {
  if (listOnly) {
    const rows = await sql`select email, role, created_at from public.profiles order by role, email`
    console.table(rows.map((row) => ({ email: row.email, role: row.role })))
  } else {
    const role = demote ? 'user' : 'admin'

    // Upsert from auth.users so an account whose profile row is missing still works.
    const rows = await sql`
      insert into public.profiles (id, email, role)
      select u.id, u.email, ${role}
      from auth.users u
      where lower(u.email) = lower(${email})
      on conflict (id) do update set role = excluded.role
      returning email, role
    `

    if (rows.length === 0) {
      console.error(`No account found for ${email}. The person needs to sign up first.`)
      process.exitCode = 1
    } else {
      console.log(`${rows[0].email} is now ${rows[0].role === 'admin' ? 'an admin' : 'a regular user'}.`)
    }
  }
} finally {
  await sql.end({ timeout: 5 })
}
