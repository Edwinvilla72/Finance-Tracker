export type BankBalanceSource = 'manual' | 'linked'

export type LinkedBankAccount = {
  plaidAccountId: string
  name: string
  officialName?: string | null
  mask?: string | null
  type: string
  subtype?: string | null
  currentBalance: number
  availableBalance?: number | null
  isoCurrencyCode?: string | null
  institutionName?: string | null
  lastSyncedAt: string
}

export type LinkedBankTransaction = {
  plaidTransactionId: string
  plaidAccountId: string
  accountName: string
  name: string
  merchantName?: string | null
  amount: number
  isoCurrencyCode?: string | null
  pending: boolean
  authorizedDate?: string | null
  postedDate: string
  categoryPrimary?: string | null
  institutionName?: string | null
  lastSyncedAt: string
}

export type BankSyncSnapshot = {
  accounts: LinkedBankAccount[]
  transactions: LinkedBankTransaction[]
  syncedAt: string
}
