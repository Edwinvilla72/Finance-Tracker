import type { Dispatch, SetStateAction } from 'react'

import { currency } from '../../utils/currency'
import { formatDateKey, formatLongDate, formatMonthLabel, weekdayLabels } from '../../utils/dates'
import { getSignedAmount } from '../../calculations/cashFlow'
import { getCadenceLabel, getRecommendedPayment } from '../../calculations/debtPayoff'
import type { CalendarOccurrence, DebtPlan, ScheduledTransaction, TransactionType } from '../../types/finance'
import type { ModalView, PageView } from './dashboardTypes'

type NetWorthSummary = {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
}

type PurchaseGoalSummary = {
  title: string
  cost: number
  targetDate: string
}

type ScenarioImpactSummary = {
  sixMonthCash: {
    delta: number
  }
}

type SpendingTrendPoint = {
  category: string
  amount: number
}

type DashboardPageContentProps = {
  activePage: PageView
  activeScenario?: { title: string } | null
  allOccurrences: CalendarOccurrence[]
  balanceDisplayValue: number
  balanceHeroPhase: 'approach' | 'impact' | 'resolve' | null
  calendarDays: Array<Date | null>
  currentCashSourceLabel: string
  currentMonth: Date
  debtPlans: DebtPlan[]
  emergencyFundPlan: {
    currentSavings: number
  }
  emergencyFundProgress: {
    progressPercent: number
    shortfall: number
    targetAmount: number
  }
  essentialMonthlyOutflow: number
  financePlan: {
    targetDate: string
  }
  fiveYearInvestmentProjection: number
  healthLabel: string
  monthlyNet: number
  monthlyProjectionLength: number
  linkedAccountsCount: number
  linkedCashBalance: number
  nearestPurchaseGoal?: PurchaseGoalSummary | null
  netWorthSummary: NetWorthSummary
  nextPaycheck?: CalendarOccurrence | null
  openDay: (dateKey: string) => void
  openModal: (view: Exclude<ModalView, null>) => void
  paycheckEstimate?: {
    estimatedNetPaycheck: number
    grossPerPaycheck: number
  } | null
  paycheckRules: Array<unknown>
  planProjection: number
  primaryRecommendation: string
  projectedBalance: (targetDateKey: string) => number
  purchaseGoals: Array<unknown>
  recurringTransactions: Array<unknown>
  scenarioImpact?: ScenarioImpactSummary | null
  scheduledTransactions: ScheduledTransaction[]
  selectedDateKey: string
  setCurrentMonth: Dispatch<SetStateAction<Date>>
  sixMonthProjection: number
  spendingTrend: SpendingTrendPoint[]
  today: Date
  todayKey: string
  totalBenefitsPerPaycheck: number
  totalDebt: number
  totalInvestmentBalance: number
  totalRetirementPerPaycheck: number
  upcomingTransactions: CalendarOccurrence[]
}

export function DashboardPageContent({
  activePage,
  activeScenario,
  allOccurrences,
  balanceDisplayValue,
  balanceHeroPhase,
  calendarDays,
  currentCashSourceLabel,
  currentMonth,
  debtPlans,
  emergencyFundPlan,
  emergencyFundProgress,
  essentialMonthlyOutflow,
  financePlan,
  fiveYearInvestmentProjection,
  healthLabel,
  monthlyNet,
  monthlyProjectionLength,
  linkedAccountsCount,
  linkedCashBalance,
  nearestPurchaseGoal,
  netWorthSummary,
  nextPaycheck,
  openDay,
  openModal,
  paycheckEstimate,
  paycheckRules,
  planProjection,
  primaryRecommendation,
  projectedBalance,
  purchaseGoals,
  recurringTransactions,
  scenarioImpact,
  scheduledTransactions,
  selectedDateKey,
  setCurrentMonth,
  sixMonthProjection,
  spendingTrend,
  today,
  todayKey,
  totalBenefitsPerPaycheck,
  totalDebt,
  totalInvestmentBalance,
  totalRetirementPerPaycheck,
  upcomingTransactions,
}: DashboardPageContentProps) {
  return (
    <section className={`dashboard-layout ${activePage}-page`}>
      {activePage === 'dashboard' ? (
        <section className="cockpit-panel">
          <div className="cockpit-hero">
            <div>
              <p className="eyebrow">Financial cockpit</p>
              <h1>{healthLabel}</h1>
              <p className="hero-copy">{primaryRecommendation}</p>
            </div>
            <button
              type="button"
              className={`balance-hero balance-trigger ${
                balanceHeroPhase ? `balance-hero-${balanceHeroPhase}` : ''
              }`}
              onClick={() => openModal('balanceEdit')}
            >
              <span>Current cash</span>
              <strong>{currency.format(balanceDisplayValue)}</strong>
              <small>{currentCashSourceLabel}</small>
            </button>
          </div>

          <div className="health-grid">
            <button type="button" className="health-card" onClick={() => openModal('paycheck')}>
              <span>Next paycheck</span>
              <strong>
                {nextPaycheck ? `${currency.format(nextPaycheck.amount)}` : 'Not scheduled'}
              </strong>
              <small>
                {nextPaycheck ? formatLongDate(nextPaycheck.date) : 'Add income timing'}
              </small>
            </button>
            <button
              type="button"
              className="health-card"
              onClick={() => openModal('incomeModel')}
            >
              <span>Estimated take-home</span>
              <strong>
                {paycheckEstimate
                  ? currency.format(paycheckEstimate.estimatedNetPaycheck)
                  : 'Not modeled'}
              </strong>
              <small>
                {paycheckEstimate
                  ? `${currency.format(paycheckEstimate.grossPerPaycheck)} gross`
                  : 'Add salary, state, and filing status'}
              </small>
            </button>
            <button
              type="button"
              className="health-card"
              onClick={() => openModal('bankSync')}
            >
              <span>Linked accounts</span>
              <strong>
                {linkedAccountsCount > 0 ? currency.format(linkedCashBalance) : 'Not linked'}
              </strong>
              <small>
                {linkedAccountsCount > 0
                  ? `${linkedAccountsCount} synced account${linkedAccountsCount === 1 ? '' : 's'}`
                  : 'Connect Plaid for posted transactions'}
              </small>
            </button>
            <div className="health-card">
              <span>Monthly surplus</span>
              <strong className={monthlyNet >= 0 ? 'positive-text' : 'negative-text'}>
                {monthlyNet >= 0 ? '+' : '-'}
                {currency.format(Math.abs(monthlyNet))}
              </strong>
              <small>{formatMonthLabel(currentMonth)} cash flow</small>
            </div>
            <button
              type="button"
              className="health-card"
              onClick={() => openModal('essentials')}
            >
              <span>Housing & essentials</span>
              <strong>{currency.format(essentialMonthlyOutflow)}</strong>
              <small>Housing plus your core monthly baseline costs</small>
            </button>
            <button
              type="button"
              className="health-card"
              onClick={() => openModal('benefits')}
            >
              <span>Benefits & retirement</span>
              <strong>
                {currency.format(totalBenefitsPerPaycheck + totalRetirementPerPaycheck)}
              </strong>
              <small>Estimated per paycheck</small>
            </button>
            <button type="button" className="health-card" onClick={() => openModal('debt')}>
              <span>Debt payoff</span>
              <strong>{currency.format(totalDebt)}</strong>
              <small>{debtPlans.length} tracked account{debtPlans.length === 1 ? '' : 's'}</small>
            </button>
            <button
              type="button"
              className="health-card"
              onClick={() => openModal('purchaseGoals')}
            >
              <span>Nearest goal</span>
              <strong>{nearestPurchaseGoal ? nearestPurchaseGoal.title : 'No goals'}</strong>
              <small>
                {nearestPurchaseGoal
                  ? `${currency.format(nearestPurchaseGoal.cost)} by ${formatLongDate(
                      nearestPurchaseGoal.targetDate,
                    )}`
                  : 'Add a purchase or savings goal'}
              </small>
            </button>
            <button
              type="button"
              className="health-card"
              onClick={() => openModal('emergencyFund')}
            >
              <span>Emergency fund</span>
              <strong>{currency.format(emergencyFundPlan.currentSavings)}</strong>
              <small>
                {Math.round(emergencyFundProgress.progressPercent)}% of{' '}
                {currency.format(emergencyFundProgress.targetAmount)} target
              </small>
            </button>
            <button
              type="button"
              className="health-card"
              onClick={() => openModal('investments')}
            >
              <span>Investments</span>
              <strong>{currency.format(totalInvestmentBalance)}</strong>
              <small>{currency.format(fiveYearInvestmentProjection)} projected in 5 years</small>
            </button>
            <button type="button" className="health-card" onClick={() => openModal('netWorth')}>
              <span>Net worth</span>
              <strong>{currency.format(netWorthSummary.netWorth)}</strong>
              <small>
                {currency.format(netWorthSummary.totalAssets)} assets •{' '}
                {currency.format(netWorthSummary.totalLiabilities)} liabilities
              </small>
            </button>
            <button type="button" className="health-card" onClick={() => openModal('scenarios')}>
              <span>Scenario impact</span>
              <strong>
                {scenarioImpact
                  ? `${scenarioImpact.sixMonthCash.delta >= 0 ? '+' : '-'}${currency.format(
                      Math.abs(scenarioImpact.sixMonthCash.delta),
                    )}`
                  : 'No scenario'}
              </strong>
              <small>{activeScenario ? activeScenario.title : 'Compare a what-if change'}</small>
            </button>
            <button type="button" className="health-card" onClick={() => openModal('insights')}>
              <span>Trend views</span>
              <strong>{monthlyProjectionLength} mo</strong>
              <small>Cash, spending, and scenario charts</small>
            </button>
            <button type="button" className="health-card" onClick={() => openModal('plan')}>
              <span>6-month projection</span>
              <strong>{currency.format(sixMonthProjection)}</strong>
              <small>{financePlan.targetDate ? 'Target plan included' : 'No target set'}</small>
            </button>
          </div>

          <div className="quick-actions" aria-label="Planning shortcuts">
            <button type="button" onClick={() => openModal('incomeModel')}>
              Model paycheck
            </button>
            <button type="button" onClick={() => openModal('essentials')}>
              Add rent & bills
            </button>
            <button type="button" onClick={() => openModal('oneTime')}>
              Schedule transaction
            </button>
            <button type="button" onClick={() => openModal('bankSync')}>
              Link bank
            </button>
            <button type="button" onClick={() => openModal('scenarios')}>
              Scenarios
            </button>
          </div>
        </section>
      ) : null}

      {activePage === 'dashboard' || activePage === 'calendar' ? (
        <section className="workspace-grid">
          <section className="calendar-card">
            <div className="calendar-header">
              <div>
                <p className="section-kicker">Calendar</p>
                <h2>Scheduled transactions and payments</h2>
              </div>
              <div className="month-controls">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                    )
                  }
                >
                  Prev
                </button>
                <strong>{formatMonthLabel(currentMonth)}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>

            <div className="weekday-row">
              {weekdayLabels.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="day-cell empty-day" />
                }

                const dateKey = formatDateKey(date)
                const dayItems = allOccurrences.filter((transaction) => transaction.date === dateKey)
                const dayNet = dayItems.reduce(
                  (sum, transaction) => sum + getSignedAmount(transaction.amount, transaction.type),
                  0,
                )
                const dayEndBalance = projectedBalance(dateKey)
                const previewTitles = dayItems
                  .slice(0, 2)
                  .map((item) => item.title)
                  .join(' • ')
                const isSelected = dateKey === selectedDateKey
                const isToday = dateKey === todayKey

                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={`day-cell ${isSelected ? 'selected-day' : ''} ${isToday ? 'today-cell' : ''}`}
                    onClick={() => openDay(dateKey)}
                  >
                    <span className="day-number">{date.getDate()}</span>
                    <div className="indicator-row">
                      {dayItems.slice(0, 4).map((item) => (
                        <span
                          key={item.id}
                          className={`indicator-dot ${item.type as TransactionType}`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <span className={`day-net ${dayNet >= 0 ? 'positive' : 'negative'}`}>
                      {dayItems.length > 0
                        ? `${dayNet >= 0 ? '+' : '-'}${currency.format(Math.abs(dayNet))}`
                        : ''}
                    </span>
                    <span className="day-balance">
                      {dayItems.length > 0 ? `End day: ${currency.format(dayEndBalance)}` : ''}
                    </span>
                    <span className="day-preview">
                      {dayItems.length > 0
                        ? dayItems.length > 2
                          ? `${previewTitles} +${dayItems.length - 2} more`
                          : previewTitles
                        : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="upcoming-card">
            <div className="sidebar-section">
              <div className="sidebar-header">
                <div>
                  <p className="section-kicker">Upcoming</p>
                  <h2>Next scheduled transactions</h2>
                </div>
              </div>

              <div className="upcoming-list">
                {upcomingTransactions.length === 0 ? (
                  <p className="empty-copy">No scheduled transactions yet.</p>
                ) : (
                  upcomingTransactions.map((transaction) => (
                    <button
                      type="button"
                      key={transaction.id}
                      className="upcoming-row"
                      onClick={() => openDay(transaction.date)}
                    >
                      <div>
                        <strong>{transaction.title}</strong>
                        <p>{formatLongDate(transaction.date)}</p>
                      </div>
                      <div className="upcoming-amount">
                        <span
                          className={`day-net ${
                            getSignedAmount(transaction.amount, transaction.type) >= 0
                              ? 'positive'
                              : 'negative'
                          }`}
                        >
                          {getSignedAmount(transaction.amount, transaction.type) >= 0 ? '+' : '-'}
                          {currency.format(transaction.amount)}
                        </span>
                        <p>{transaction.type}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-header">
                <div>
                  <p className="section-kicker">Debt</p>
                  <h2>What you owe</h2>
                </div>
              </div>

              <div className="debt-summary-list">
                {debtPlans.length === 0 ? (
                  <p className="empty-copy">No debts tracked yet.</p>
                ) : (
                  debtPlans.map((debt) => (
                    <div className="debt-summary-row" key={debt.id}>
                      <div>
                        <strong>{debt.title}</strong>
                        <p>Due {formatLongDate(debt.dueDate)}</p>
                      </div>
                      <div className="upcoming-amount">
                        <span className="day-net negative">-{currency.format(debt.balance)}</span>
                        <p>
                          {debt.payoffDate
                            ? `Target ${formatLongDate(debt.payoffDate)}`
                            : 'No payoff target'}
                        </p>
                        {debt.payoffDate && debt.payoffCadence ? (
                          <p>
                            {currency.format(
                              Math.ceil(
                                getRecommendedPayment(
                                  debt.balance,
                                  debt.payoffDate,
                                  debt.payoffCadence,
                                  today,
                                ),
                              ),
                            )}{' '}
                            {getCadenceLabel(debt.payoffCadence)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {activePage === 'cashFlow' ? (
        <section className="page-panel">
          <div className="page-header">
            <div>
              <p className="eyebrow">Cash flow</p>
              <h1>Income, bills, and spending</h1>
              <p className="hero-copy">
                Manage the recurring money movement that feeds the calendar forecast.
              </p>
            </div>
          </div>
          <div className="page-action-grid">
            <button type="button" className="action-card" onClick={() => openModal('incomeModel')}>
              <span>Paycheck model</span>
              <strong>
                {paycheckEstimate
                  ? currency.format(paycheckEstimate.estimatedNetPaycheck)
                  : 'Not modeled'}
              </strong>
              <small>Estimate take-home pay from income, taxes, and deductions.</small>
            </button>
            <button type="button" className="action-card" onClick={() => openModal('paycheck')}>
              <span>Paycheck schedule</span>
              <strong>{paycheckRules.length}</strong>
              <small>Weekly, biweekly, or monthly income events.</small>
            </button>
            <button type="button" className="action-card" onClick={() => openModal('bankSync')}>
              <span>Linked accounts</span>
              <strong>
                {linkedAccountsCount > 0 ? currency.format(linkedCashBalance) : 'Not linked'}
              </strong>
              <small>Sync posted transactions and account balances from your bank.</small>
            </button>
            <button type="button" className="action-card" onClick={() => openModal('essentials')}>
              <span>Housing & essentials</span>
              <strong>{currency.format(essentialMonthlyOutflow)}</strong>
              <small>Housing costs, utilities, groceries, insurance, and core bills.</small>
            </button>
            <button type="button" className="action-card" onClick={() => openModal('oneTime')}>
              <span>Scheduled transactions</span>
              <strong>{scheduledTransactions.length + recurringTransactions.length}</strong>
              <small>Choose one-time or recurring timing for spending, transfers, or pay-ins.</small>
            </button>
            <button type="button" className="action-card" onClick={() => openModal('benefits')}>
              <span>Benefits</span>
              <strong>{currency.format(totalBenefitsPerPaycheck)}</strong>
              <small>Per-paycheck insurance, HSA/FSA, and deductions.</small>
            </button>
          </div>
        </section>
      ) : null}

      {activePage === 'planning' ? (
        <section className="page-panel">
          <div className="page-header">
            <div>
              <p className="eyebrow">Planning</p>
              <h1>Debt, goals, emergency fund, and net worth</h1>
              <p className="hero-copy">
                Longer-term planning tools live here, separate from day-to-day scheduling.
              </p>
            </div>
          </div>
          <div className="page-action-grid">
            <button type="button" className="action-card" onClick={() => openModal('debt')}>
              <span>Debt payoff</span>
              <strong>{currency.format(totalDebt)}</strong>
              <small>APR, minimums, extra payments, and payoff estimates.</small>
            </button>
            <button
              type="button"
              className="action-card"
              onClick={() => openModal('emergencyFund')}
            >
              <span>Emergency fund</span>
              <strong>{Math.round(emergencyFundProgress.progressPercent)}%</strong>
              <small>{currency.format(emergencyFundProgress.shortfall)} left to target.</small>
            </button>
            <button
              type="button"
              className="action-card"
              onClick={() => openModal('purchaseGoals')}
            >
              <span>Purchase goals</span>
              <strong>{purchaseGoals.length}</strong>
              <small>Planned purchases and recommended saving cadence.</small>
            </button>
            <button
              type="button"
              className="action-card"
              onClick={() => openModal('investments')}
            >
              <span>Investments</span>
              <strong>{currency.format(totalInvestmentBalance)}</strong>
              <small>{currency.format(fiveYearInvestmentProjection)} projected in 5 years.</small>
            </button>
            <button type="button" className="action-card" onClick={() => openModal('netWorth')}>
              <span>Net worth</span>
              <strong>{currency.format(netWorthSummary.netWorth)}</strong>
              <small>Assets, liabilities, cash, and investment balances.</small>
            </button>
            <button type="button" className="action-card" onClick={() => openModal('plan')}>
              <span>Financial target</span>
              <strong>
                {financePlan.targetDate ? currency.format(planProjection) : 'No target'}
              </strong>
              <small>Compare your projected balance against a target.</small>
            </button>
          </div>
        </section>
      ) : null}

      {activePage === 'scenarios' ? (
        <section className="page-panel">
          <div className="page-header">
            <div>
              <p className="eyebrow">Scenarios</p>
              <h1>What-if planning</h1>
              <p className="hero-copy">
                Compare your baseline against possible changes before you commit.
              </p>
            </div>
            <button type="button" className="primary-action" onClick={() => openModal('scenarios')}>
              Build scenario
            </button>
          </div>
          <div className="page-action-grid">
            <div className="action-card static-card">
              <span>Active scenario</span>
              <strong>{activeScenario ? activeScenario.title : 'None yet'}</strong>
              <small>Model income, rent, benefits, debt, purchases, and investing.</small>
            </div>
            <div className="action-card static-card">
              <span>6-month cash impact</span>
              <strong
                className={(scenarioImpact?.sixMonthCash.delta ?? 0) >= 0 ? 'positive-text' : 'negative-text'}
              >
                {scenarioImpact
                  ? `${scenarioImpact.sixMonthCash.delta >= 0 ? '+' : '-'}${currency.format(
                      Math.abs(scenarioImpact.sixMonthCash.delta),
                    )}`
                  : '--'}
              </strong>
              <small>Compared with your current baseline.</small>
            </div>
            <button type="button" className="action-card" onClick={() => openModal('insights')}>
              <span>Scenario charts</span>
              <strong>View impact</strong>
              <small>See bars for paycheck, monthly cash, and net worth changes.</small>
            </button>
          </div>
        </section>
      ) : null}

      {activePage === 'insights' ? (
        <section className="page-panel">
          <div className="page-header">
            <div>
              <p className="eyebrow">Insights</p>
              <h1>Trends and overviews</h1>
              <p className="hero-copy">
                Calendar stays primary, but these views make patterns easier to scan.
              </p>
            </div>
            <button type="button" className="primary-action" onClick={() => openModal('insights')}>
              Open charts
            </button>
          </div>
          <div className="page-action-grid">
            <div className="action-card static-card">
              <span>6-month cash</span>
              <strong>{currency.format(sixMonthProjection)}</strong>
              <small>Projected from your current scheduled activity.</small>
            </div>
            <div className="action-card static-card">
              <span>Top spending group</span>
              <strong>{spendingTrend[0]?.category ?? 'None yet'}</strong>
              <small>
                {spendingTrend[0]
                  ? currency.format(spendingTrend[0].amount)
                  : 'Add expenses to see category trends.'}
              </small>
            </div>
            <div className="action-card static-card">
              <span>Net worth</span>
              <strong>{currency.format(netWorthSummary.netWorth)}</strong>
              <small>Assets minus liabilities.</small>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  )
}
