// Shared Postgres connection for the scripts in this folder.
//
// Reads DATABASE_URL (Supabase "Direct connection") and, as a fallback,
// DATABASE_POOLER_URL (Supabase "Session pooler") from .env. The direct host is
// IPv6-only on most networks, so the pooler is tried automatically when the
// direct host is unreachable.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export function loadEnv() {
  try {
    process.loadEnvFile(path.join(projectRoot, '.env'))
  } catch {
    // No .env file; rely on variables already present in the environment.
  }
}

// Supabase passwords often contain characters (# / % ^) that break `new URL`,
// so the connection string is parsed by hand.
export function parseConnectionString(raw) {
  const match = raw
    .trim()
    .match(/^postgres(?:ql)?:\/\/([^:/@]+):(.*)@([^@/:]+):(\d+)\/([^?]+)(?:\?.*)?$/)

  if (!match) {
    throw new Error(
      'Unrecognised connection string. Expected postgresql://user:password@host:port/database',
    )
  }

  const [, user, password, host, port, database] = match

  return { user, password: decodeIfEncoded(password), host, port: Number(port), database }
}

function decodeIfEncoded(value) {
  if (!value.includes('%')) {
    return value
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const UNREACHABLE = /EHOSTUNREACH|ENETUNREACH|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|CONNECT_TIMEOUT/

export async function connect({ verbose = true } = {}) {
  loadEnv()

  const candidates = [
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['DATABASE_POOLER_URL', process.env.DATABASE_POOLER_URL],
  ].filter(([, value]) => Boolean(value))

  if (candidates.length === 0) {
    throw new Error('Set DATABASE_URL (and optionally DATABASE_POOLER_URL) in .env first.')
  }

  for (const [name, raw] of candidates) {
    const config = parseConnectionString(raw)
    const sql = postgres({
      ...config,
      ssl: 'require',
      max: 1,
      connect_timeout: 30,
      // The transaction pooler (port 6543) cannot use prepared statements.
      prepare: config.port !== 6543,
      onnotice: () => {},
    })

    try {
      await sql`select 1`

      if (verbose) {
        console.log(`Connected via ${name} (${config.host})`)
      }

      return sql
    } catch (error) {
      await sql.end({ timeout: 1 }).catch(() => {})

      const reason = `${error?.code ?? ''} ${error?.message ?? ''}`

      if (UNREACHABLE.test(reason)) {
        if (verbose) {
          console.warn(`Could not reach ${config.host} via ${name} (${reason.trim()}).`)
        }

        continue
      }

      throw error
    }
  }

  throw new Error(
    [
      'Could not connect to the database.',
      'If DATABASE_URL points at db.<ref>.supabase.co, your network probably has no IPv6 route to it.',
      'Add DATABASE_POOLER_URL to .env using the "Session pooler" string from Supabase -> Connect.',
    ].join('\n'),
  )
}
