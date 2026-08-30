import type {
  PaycheckRule,
  RecurringTransaction,
  ScheduledTransaction,
} from '../../../types/finance'
import { currency } from '../../../utils/currency'
import {
  formatMonthLabel,
  formatShortDate,
  getWeekdayList,
  weekdayOptions,
} from '../../../utils/dates'
import type { ModalView } from '../dashboardTypes'

type PaycheckEstimateSummary = {
  estimatedNetPaycheck: number
  grossPerPaycheck: number
}

type CashFlowPageProps = {
  currentMonth: Date
  essentialMonthlyOutflow: number
  linkedAccountsCount: number
  linkedCashBalance: number
  monthlyIncome: number
  monthlyNet: number
  monthlyOutflow: number
  openModal: (view: Exclude<ModalView, null>) => void
  paycheckEstimate?: PaycheckEstimateSummary | null
  paycheckRules: PaycheckRule[]
  recurringTransactions: RecurringTransaction[]
  removePaycheckRule: (id: number) => void
  removeRecurring: (id: number) => void
  removeScheduled: (id: number) => void
  scheduledTransactions: ScheduledTransaction[]
  todayKey: string
  totalBenefitsPerPaycheck: number
}

function describePaycheckTiming(rule: PaycheckRule) {
  if (rule.frequency === 'monthly') {
    return `Monthly on day ${rule.dayOfMonth}`
  }

  const weekday =
    typeof rule.weekday === 'number' ? weekdayOptions[rule.weekday]?.label : null
  const cadence = rule.frequency === 'weekly' ? 'Weekly' : 'Biweekly'

  return weekday ? `${cadence} on ${weekday}s` : cadence
}

function describeRecurringTiming(transaction: RecurringTransaction) {
  if (transaction.frequency === 'monthly') {
    return `Monthly on day ${transaction.dayOfMonth}`
  }

  return transaction.weekdays?.length
    ? `Weekly on ${getWeekdayList(transaction.weekdays)}`
    : 'Weekly'
}

export function CashFlowPage({
  currentMonth,
  essentialMonthlyOutflow,
  linkedAccountsCount,
  linkedCashBalance,
  monthlyIncome,
  monthlyNet,
  monthlyOutflow,
  openModal,
  paycheckEstimate,
  paycheckRules,
  recurringTransactions,
  removePaycheckRule,
  removeRecurring,
  removeScheduled,
  scheduledTransactions,
  todayKey,
  totalBenefitsPerPaycheck,
}: CashFlowPageProps) {
  const monthLabel = formatMonthLabel(currentMonth)
  const upcomingScheduled = scheduledTransactions
    .filter((transaction) => transaction.date >= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date))

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Cash flow</p>
            <h1>Income, bills, and spending</h1>
            <p className="hero-copy">
              Everything here feeds the calendar forecast, goal feasibility, and
              projections.
            </p>
          </div>
        </div>
        <div className="stat-row stat-row-embedded">
          <div className="stat-card">
            <span>Income · {monthLabel}</span>
            <strong className="positive-text">{currency.format(monthlyIncome)}</strong>
          </div>
          <div className="stat-card">
            <span>Outflow · {monthLabel}</span>
            <strong className="negative-text">{currency.format(monthlyOutflow)}</strong>
          </div>
          <div className="stat-card">
            <span>Net</span>
            <strong className={monthlyNet >= 0 ? 'positive-text' : 'negative-text'}>
              {monthlyNet >= 0 ? '+' : '-'}
              {currency.format(Math.abs(monthlyNet))}
            </strong>
          </div>
          <div className="stat-card">
            <span>Housing & essentials</span>
            <strong>{currency.format(essentialMonthlyOutflow)}</strong>
          </div>
        </div>
      </section>

      <section className="page-grid-2col">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Income</p>
              <h2>Paychecks</h2>
            </div>
            <div className="panel-header-side">
              <button type="button" className="ghost-button" onClick={() => openModal('incomeModel')}>
                Model take-home
              </button>
              <button type="button" className="primary-action" onClick={() => openModal('paycheck')}>
                Add paycheck
              </button>
            </div>
          </div>

          {paycheckEstimate ? (
            <div className="callout">
              Estimated take-home is {currency.format(paycheckEstimate.estimatedNetPaycheck)}{' '}
              per paycheck from {currency.format(paycheckEstimate.grossPerPaycheck)} gross,
              with {currency.format(totalBenefitsPerPaycheck)} in benefit deductions.
            </div>
          ) : (
            <div className="callout">
              Model your salary, state, and filing status to estimate real take-home pay.
            </div>
          )}

          <div className="line-list">
            {paycheckRules.length === 0 ? (
              <p className="empty-copy">No scheduled paychecks yet.</p>
            ) : (
              paycheckRules.map((rule) => (
                <div className="line-item" key={rule.id}>
                  <div>
                    <strong>{rule.title}</strong>
                    <p>{describePaycheckTiming(rule)}</p>
                  </div>
                  <div className="line-item-side">
                    <span className="positive-text">+{currency.format(rule.amount)}</span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removePaycheckRule(rule.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Bank</p>
              <h2>Linked accounts</h2>
            </div>
            <button type="button" className="primary-action" onClick={() => openModal('bankSync')}>
              {linkedAccountsCount > 0 ? 'Manage sync' : 'Link bank'}
            </button>
          </div>
          <div className="callout">
            {linkedAccountsCount > 0
              ? `${linkedAccountsCount} synced account${
                  linkedAccountsCount === 1 ? '' : 's'
                } holding ${currency.format(linkedCashBalance)} in cash.`
              : 'Connect Plaid to pull posted transactions and real balances.'}
          </div>

          <div className="panel-header">
            <div>
              <p className="section-kicker">Benefits</p>
              <h2>Per-paycheck deductions</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => openModal('benefits')}>
              Manage
            </button>
          </div>
          <div className="callout">
            {totalBenefitsPerPaycheck > 0
              ? `${currency.format(totalBenefitsPerPaycheck)} per paycheck goes to insurance, HSA/FSA, and other elections.`
              : 'Add insurance, HSA/FSA, and retirement elections to sharpen the take-home estimate.'}
          </div>
        </section>
      </section>

      <section className="page-grid-2col">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Recurring</p>
              <h2>Bills and subscriptions</h2>
            </div>
            <div className="panel-header-side">
              <button type="button" className="ghost-button" onClick={() => openModal('essentials')}>
                Add rent & bills
              </button>
              <button type="button" className="primary-action" onClick={() => openModal('recurring')}>
                Add recurring
              </button>
            </div>
          </div>
          <div className="line-list">
            {recurringTransactions.length === 0 ? (
              <p className="empty-copy">No recurring transactions yet.</p>
            ) : (
              recurringTransactions.map((transaction) => (
                <div className="line-item" key={transaction.id}>
                  <div>
                    <strong>{transaction.title}</strong>
                    <p>
                      {describeRecurringTiming(transaction)}
                      {transaction.category ? ` · ${transaction.category}` : ''}
                    </p>
                  </div>
                  <div className="line-item-side">
                    <span className="negative-text">
                      -{currency.format(transaction.amount)}
                    </span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeRecurring(transaction.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">One-time</p>
              <h2>Upcoming scheduled transactions</h2>
            </div>
            <button type="button" className="primary-action" onClick={() => openModal('oneTime')}>
              Schedule transaction
            </button>
          </div>
          <div className="line-list">
            {upcomingScheduled.length === 0 ? (
              <p className="empty-copy">Nothing scheduled ahead.</p>
            ) : (
              upcomingScheduled.map((transaction) => (
                <div className="line-item" key={transaction.id}>
                  <div>
                    <strong>{transaction.title}</strong>
                    <p>
                      {formatShortDate(transaction.date)}
                      {transaction.category ? ` · ${transaction.category}` : ''}
                    </p>
                  </div>
                  <div className="line-item-side">
                    <span
                      className={
                        transaction.type === 'income' ? 'positive-text' : 'negative-text'
                      }
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {currency.format(transaction.amount)}
                    </span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeScheduled(transaction.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </>
  )
}
