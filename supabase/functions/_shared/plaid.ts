import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const plaidEnv = Deno.env.get('PLAID_ENV') ?? 'sandbox'
const plaidClientId = Deno.env.get('PLAID_CLIENT_ID') ?? ''
const plaidSecret = Deno.env.get('PLAID_SECRET') ?? ''

const plaidBaseUrl =
  plaidEnv === 'production'
    ? 'https://production.plaid.com'
    : plaidEnv === 'development'
      ? 'https://development.plaid.com'
      : 'https://sandbox.plaid.com'

type PlaidItemRow = {
  id: string
  user_id: string
  plaid_item_id: string
  access_token: string
  institution_name?: string | null
  last_transactions_cursor?: string | null
}

type PlaidAccount = {
  account_id: string
  balances: {
    available?: number | null
    current?: number | null
    iso_currency_code?: string | null
  }
  mask?: string | null
  name: string
  official_name?: string | null
  subtype?: string | null
  type: string
}

type PlaidTransaction = {
  account_id: string
  transaction_id: string
  authorized_date?: string | null
  date: string
  name: string
  merchant_name?: string | null
  amount: number
  iso_currency_code?: string | null
  pending: boolean
  personal_finance_category?: {
    primary?: string | null
  } | null
}

export async function plaidRequest<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${plaidBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: plaidClientId,
      secret: plaidSecret,
      ...body,
    }),
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload?.error_message ?? `Plaid request failed for ${path}`)
  }

  return payload as T
}

export async function readBankSnapshot(adminClient: SupabaseClient, userId: string) {
  const [{ data: accounts, error: accountsError }, { data: transactions, error: transactionsError }] =
    await Promise.all([
      adminClient
        .from('plaid_accounts')
        .select(
          'plaid_account_id,name,official_name,mask,type,subtype,current_balance,available_balance,iso_currency_code,institution_name,last_synced_at',
        )
        .eq('user_id', userId)
        .order('institution_name', { ascending: true })
        .order('name', { ascending: true }),
      adminClient
        .from('plaid_transactions')
        .select(
          'plaid_transaction_id,plaid_account_id,account_name,name,merchant_name,amount,iso_currency_code,pending,authorized_date,posted_date,category_primary,institution_name,last_synced_at',
        )
        .eq('user_id', userId)
        .order('posted_date', { ascending: false })
        .limit(100),
    ])

  if (accountsError) {
    throw new Error(accountsError.message)
  }

  if (transactionsError) {
    throw new Error(transactionsError.message)
  }

  return {
    accounts: accounts ?? [],
    transactions: transactions ?? [],
    syncedAt:
      accounts?.[0]?.last_synced_at ??
      transactions?.[0]?.last_synced_at ??
      new Date().toISOString(),
  }
}

export async function syncPlaidItem(
  adminClient: SupabaseClient,
  item: PlaidItemRow,
) {
  const syncedAt = new Date().toISOString()
  const accountsResponse = await plaidRequest<{ accounts: PlaidAccount[] }>('/accounts/get', {
    access_token: item.access_token,
  })

  const accountMap = new Map<string, PlaidAccount>()
  for (const account of accountsResponse.accounts) {
    accountMap.set(account.account_id, account)
  }

  const accountRows = accountsResponse.accounts.map((account) => ({
    user_id: item.user_id,
    plaid_item_id: item.id,
    plaid_account_id: account.account_id,
    name: account.name,
    official_name: account.official_name ?? null,
    mask: account.mask ?? null,
    type: account.type,
    subtype: account.subtype ?? null,
    current_balance: account.balances.current ?? 0,
    available_balance: account.balances.available ?? null,
    iso_currency_code: account.balances.iso_currency_code ?? 'USD',
    institution_name: item.institution_name ?? null,
    raw: account,
    last_synced_at: syncedAt,
    updated_at: syncedAt,
  }))

  if (accountRows.length > 0) {
    const { error } = await adminClient.from('plaid_accounts').upsert(accountRows, {
      onConflict: 'plaid_account_id',
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  let cursor = item.last_transactions_cursor ?? undefined
  let hasMore = true
  const upsertTransactions: PlaidTransaction[] = []
  const removedTransactionIds: string[] = []

  while (hasMore) {
    const syncResponse = await plaidRequest<{
      added: PlaidTransaction[]
      modified: PlaidTransaction[]
      removed: Array<{ transaction_id?: string } | string>
      next_cursor: string
      has_more: boolean
    }>('/transactions/sync', {
      access_token: item.access_token,
      ...(cursor ? { cursor } : { days_requested: 90 }),
    })

    upsertTransactions.push(...syncResponse.added, ...syncResponse.modified)
    removedTransactionIds.push(
      ...syncResponse.removed
        .map((entry) =>
          typeof entry === 'string' ? entry : entry.transaction_id ?? null,
        )
        .filter((entry): entry is string => Boolean(entry)),
    )
    cursor = syncResponse.next_cursor
    hasMore = syncResponse.has_more
  }

  if (upsertTransactions.length > 0) {
    const transactionRows = upsertTransactions.map((transaction) => ({
      user_id: item.user_id,
      plaid_item_id: item.id,
      plaid_account_id: transaction.account_id,
      plaid_transaction_id: transaction.transaction_id,
      account_name: accountMap.get(transaction.account_id)?.name ?? 'Linked account',
      name: transaction.name,
      merchant_name: transaction.merchant_name ?? null,
      amount: transaction.amount,
      iso_currency_code: transaction.iso_currency_code ?? 'USD',
      pending: transaction.pending,
      authorized_date: transaction.authorized_date ?? null,
      posted_date: transaction.date,
      category_primary:
        transaction.personal_finance_category?.primary ?? null,
      institution_name: item.institution_name ?? null,
      raw: transaction,
      last_synced_at: syncedAt,
      updated_at: syncedAt,
    }))

    const { error } = await adminClient.from('plaid_transactions').upsert(transactionRows, {
      onConflict: 'plaid_transaction_id',
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  if (removedTransactionIds.length > 0) {
    const { error } = await adminClient
      .from('plaid_transactions')
      .delete()
      .eq('user_id', item.user_id)
      .in('plaid_transaction_id', removedTransactionIds)

    if (error) {
      throw new Error(error.message)
    }
  }

  const { error: updateError } = await adminClient
    .from('plaid_items')
    .update({
      last_transactions_cursor: cursor ?? null,
      updated_at: syncedAt,
    })
    .eq('id', item.id)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

export async function syncAllPlaidItems(
  adminClient: SupabaseClient,
  userId: string,
) {
  const { data: items, error } = await adminClient
    .from('plaid_items')
    .select('id,user_id,plaid_item_id,access_token,institution_name,last_transactions_cursor')
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  for (const item of (items ?? []) as PlaidItemRow[]) {
    await syncPlaidItem(adminClient, item)
  }
}
