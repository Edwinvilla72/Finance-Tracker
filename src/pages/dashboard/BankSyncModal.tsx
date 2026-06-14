import { currency } from '../../utils/currency'
import { formatLongDate } from '../../utils/dates'
import type {
  BankBalanceSource,
  LinkedBankAccount,
  LinkedBankTransaction,
} from '../../types/banking'

type BankSyncModalProps = {
  bankBalanceSource: BankBalanceSource
  bankSyncError: string | null
  canUseBankSync: boolean
  closeModal: () => void
  isConnectingBank: boolean
  isSyncingBank: boolean
  linkedAccounts: LinkedBankAccount[]
  linkedCashBalance: number
  linkedTransactions: LinkedBankTransaction[]
  onBankBalanceSourceChange: (value: BankBalanceSource) => void
  onConnectBank: () => void
  onSyncBank: () => void
}

export function BankSyncModal({
  bankBalanceSource,
  bankSyncError,
  canUseBankSync,
  closeModal,
  isConnectingBank,
  isSyncingBank,
  linkedAccounts,
  linkedCashBalance,
  linkedTransactions,
  onBankBalanceSourceChange,
  onConnectBank,
  onSyncBank,
}: BankSyncModalProps) {
  return (
    <>
      <div className="modal-header">
        <div>
          <p className="eyebrow">Linked banking</p>
          <h2>Actual balances and transactions</h2>
        </div>
        <button type="button" className="ghost-button" onClick={closeModal}>
          Close
        </button>
      </div>
      {!canUseBankSync ? (
        <p className="empty-copy modal-intro">
          Bank syncing requires Supabase-authenticated mode because Plaid secrets and access
          tokens must stay on the server. Sign in with Supabase mode before linking USAA or
          any other institution.
        </p>
      ) : (
        <>
          <p className="empty-copy modal-intro">
            Link your bank through Plaid to pull posted transactions and synced account
            balances. USAA-linked data may lag and typically does not include pending
            transactions.
          </p>
          <div className="split-row">
            <button
              type="button"
              onClick={onConnectBank}
              disabled={isConnectingBank || isSyncingBank}
            >
              {isConnectingBank ? 'Connecting...' : linkedAccounts.length > 0 ? 'Link another bank' : 'Connect bank'}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onSyncBank}
              disabled={isConnectingBank || isSyncingBank || linkedAccounts.length === 0}
            >
              {isSyncingBank ? 'Syncing...' : 'Refresh balances'}
            </button>
          </div>
          <div className="status-strip">
            <div>
              <span>Linked cash total</span>
              <strong>{currency.format(linkedCashBalance)}</strong>
            </div>
            <div>
              <span>Balance source</span>
              <strong>{bankBalanceSource === 'linked' ? 'Linked balances' : 'Manual entry'}</strong>
            </div>
          </div>
          <div className="split-row">
            <button
              type="button"
              className={`weekday-chip ${bankBalanceSource === 'manual' ? 'selected' : ''}`}
              onClick={() => onBankBalanceSourceChange('manual')}
            >
              Use manual balance
            </button>
            <button
              type="button"
              className={`weekday-chip ${bankBalanceSource === 'linked' ? 'selected' : ''}`}
              onClick={() => onBankBalanceSourceChange('linked')}
              disabled={linkedAccounts.length === 0}
            >
              Use linked cash
            </button>
          </div>
        </>
      )}
      {bankSyncError ? <p className="empty-copy">{bankSyncError}</p> : null}
      <div className="modal-list compact-list">
        <div>
          <p className="eyebrow">Accounts</p>
        </div>
        {linkedAccounts.length === 0 ? (
          <p className="empty-copy">No linked accounts yet.</p>
        ) : (
          linkedAccounts.map((account) => (
            <div className="modal-list-row" key={account.plaidAccountId}>
              <div>
                <strong>
                  {account.name}
                  {account.mask ? ` ••${account.mask}` : ''}
                </strong>
                <p>
                  {[account.institutionName, account.type, account.subtype]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              </div>
              <div className="row-actions">
                <span>{currency.format(account.currentBalance)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="modal-list debt-ledger-list">
        <div>
          <p className="eyebrow">Recent posted transactions</p>
        </div>
        {linkedTransactions.length === 0 ? (
          <p className="empty-copy">No synced transactions yet.</p>
        ) : (
          linkedTransactions.map((transaction) => (
            <div className="modal-list-row" key={transaction.plaidTransactionId}>
              <div>
                <strong>{transaction.merchantName || transaction.name}</strong>
                <p>
                  {[transaction.accountName, formatLongDate(transaction.postedDate)]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              </div>
              <div className="row-actions">
                <span className={transaction.pending ? '' : 'negative-text'}>
                  {currency.format(transaction.amount)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
