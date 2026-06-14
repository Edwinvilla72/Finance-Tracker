import { supabase } from '../lib/supabase'
import type {
  BankSyncSnapshot,
  LinkedBankAccount,
  LinkedBankTransaction,
} from '../types/banking'

const PLAID_ACCOUNTS_TABLE = 'plaid_accounts'
const PLAID_TRANSACTIONS_TABLE = 'plaid_transactions'
const PLAID_SCRIPT_ID = 'plaid-link-script'
const PLAID_SCRIPT_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'

function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured for bank syncing.')
  }

  return supabase
}

function mapAccount(row: Record<string, unknown>): LinkedBankAccount {
  return {
    plaidAccountId: String(row.plaid_account_id),
    name: String(row.name),
    officialName:
      typeof row.official_name === 'string' ? row.official_name : null,
    mask: typeof row.mask === 'string' ? row.mask : null,
    type: String(row.type),
    subtype: typeof row.subtype === 'string' ? row.subtype : null,
    currentBalance: Number(row.current_balance ?? 0),
    availableBalance:
      typeof row.available_balance === 'number'
        ? row.available_balance
        : row.available_balance === null || row.available_balance === undefined
          ? null
          : Number(row.available_balance),
    isoCurrencyCode:
      typeof row.iso_currency_code === 'string' ? row.iso_currency_code : null,
    institutionName:
      typeof row.institution_name === 'string' ? row.institution_name : null,
    lastSyncedAt: String(row.last_synced_at ?? new Date().toISOString()),
  }
}

function mapTransaction(row: Record<string, unknown>): LinkedBankTransaction {
  return {
    plaidTransactionId: String(row.plaid_transaction_id),
    plaidAccountId: String(row.plaid_account_id),
    accountName: String(row.account_name ?? 'Linked account'),
    name: String(row.name),
    merchantName:
      typeof row.merchant_name === 'string' ? row.merchant_name : null,
    amount: Number(row.amount ?? 0),
    isoCurrencyCode:
      typeof row.iso_currency_code === 'string' ? row.iso_currency_code : null,
    pending: Boolean(row.pending),
    authorizedDate:
      typeof row.authorized_date === 'string' ? row.authorized_date : null,
    postedDate: String(row.posted_date),
    categoryPrimary:
      typeof row.category_primary === 'string' ? row.category_primary : null,
    institutionName:
      typeof row.institution_name === 'string' ? row.institution_name : null,
    lastSyncedAt: String(row.last_synced_at ?? new Date().toISOString()),
  }
}

export async function loadBankSnapshot(): Promise<BankSyncSnapshot> {
  const client = assertSupabase()

  const [{ data: accounts, error: accountsError }, { data: transactions, error: transactionsError }] =
    await Promise.all([
      client
        .from(PLAID_ACCOUNTS_TABLE)
        .select('*')
        .order('institution_name', { ascending: true })
        .order('name', { ascending: true }),
      client
        .from(PLAID_TRANSACTIONS_TABLE)
        .select('*')
        .order('posted_date', { ascending: false })
        .limit(100),
    ])

  if (accountsError) {
    throw accountsError
  }

  if (transactionsError) {
    throw transactionsError
  }

  const mappedAccounts = (accounts ?? []).map((row) =>
    mapAccount(row as Record<string, unknown>),
  )
  const mappedTransactions = (transactions ?? []).map((row) =>
    mapTransaction(row as Record<string, unknown>),
  )
  const syncedAt =
    mappedAccounts[0]?.lastSyncedAt ??
    mappedTransactions[0]?.lastSyncedAt ??
    new Date().toISOString()

  return {
    accounts: mappedAccounts,
    transactions: mappedTransactions,
    syncedAt,
  }
}

export async function createPlaidLinkToken() {
  const client = assertSupabase()
  const { data, error } = await client.functions.invoke('plaid-create-link-token')

  if (error) {
    throw error
  }

  return data as { linkToken: string; expiration: string }
}

export async function exchangePlaidPublicToken(
  publicToken: string,
  institution?: { institution_id?: string | null; name?: string | null } | null,
) {
  const client = assertSupabase()
  const { data, error } = await client.functions.invoke('plaid-exchange-public-token', {
    body: {
      publicToken,
      institution,
    },
  })

  if (error) {
    throw error
  }

  return data as BankSyncSnapshot
}

export async function syncBankSnapshot() {
  const client = assertSupabase()
  const { data, error } = await client.functions.invoke('plaid-sync')

  if (error) {
    throw error
  }

  return data as BankSyncSnapshot
}

export async function loadPlaidLinkScript() {
  if (window.Plaid) {
    return window.Plaid
  }

  const existing = document.getElementById(PLAID_SCRIPT_ID) as HTMLScriptElement | null

  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Plaid Link.')), {
        once: true,
      })
    })

    if (!window.Plaid) {
      throw new Error('Plaid Link failed to initialize.')
    }

    return window.Plaid
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = PLAID_SCRIPT_ID
    script.src = PLAID_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Plaid Link.'))
    document.head.appendChild(script)
  })

  if (!window.Plaid) {
    throw new Error('Plaid Link failed to initialize.')
  }

  return window.Plaid
}
