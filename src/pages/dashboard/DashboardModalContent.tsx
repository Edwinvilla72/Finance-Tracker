import type {
  Dispatch,
  FormEventHandler,
  SetStateAction,
} from 'react'
import { useState } from 'react'

import { currency } from '../../utils/currency'
import {
  formatLongDate,
  getWeekdayList,
  parseDateKey,
  weekdayOptions,
} from '../../utils/dates'
import {
  getSignedAmount,
} from '../../calculations/cashFlow'
import type {
  BankBalanceSource,
  LinkedBankAccount,
  LinkedBankTransaction,
} from '../../types/banking'
import {
  estimateDebtAmortization,
  getCadenceLabel,
  getMonthlyAmountNeeded,
  getRecommendedPayment,
} from '../../calculations/debtPayoff'
import { TAX_YEAR } from '../../calculations/taxes'
import type {
  BenefitElection,
  CalendarOccurrence,
  DebtPlan,
  EmergencyFundPlan,
  FinancialProfile,
  FinancePlan,
  InvestmentAccount,
  NetWorthItem,
  PaycheckRule,
  PurchaseGoal,
  RecurringTransaction,
  RetirementContribution,
  ScenarioPlan,
  ScheduledTransaction,
  TransactionType,
} from '../../types/finance'
import type { ModalView } from './dashboardTypes'
import { BankSyncModal } from './BankSyncModal'

type DayForm = {
  title: string
  amount: string
  type: TransactionType
}

type OneTimeForm = {
  title: string
  amount: string
  date: string
  type: TransactionType
  category: string
}

type RecurringForm = {
  title: string
  amount: string
  frequency: 'monthly' | 'weekly'
  dayOfMonth: string
  weekdays: number[]
  type: Exclude<TransactionType, 'income'>
  startDate: string
  endDate: string
}

type EssentialExpenseForm = {
  rent: string
  rentDueDay: string
  utilities: string
  water: string
  electricity: string
  phone: string
  internet: string
  insurance: string
  subscriptions: string
  groceries: string
  transportation: string
  dueDay: string
}

type PaycheckForm = {
  title: string
  amount: string
  frequency: PaycheckRule['frequency']
  dayOfMonth: string
  weekday: string
  startDate: string
}

type IncomeModelForm = {
  name: string
  type: FinancialProfile['incomeSources'][number]['type']
  amount: string
  hoursPerWeek: string
  payFrequency: FinancialProfile['incomeSources'][number]['payFrequency']
  state: string
  filingStatus: FinancialProfile['filingStatus']
}

type BenefitForm = {
  name: string
  type: BenefitElection['type']
  amountPerPaycheck: string
  taxTreatment: BenefitElection['taxTreatment']
}

type RetirementForm = {
  accountType: RetirementContribution['accountType']
  contributionMode: RetirementContribution['contributionMode']
  contributionValue: string
  employerMatchPercent: string
  employerMatchLimitPercent: string
}

type DebtForm = {
  title: string
  balance: string
  minimumDue: string
  dueDate: string
  payoffDate: string
  payoffCadence: 'weekly' | 'biweekly' | 'monthly'
  payoffMode: 'amount' | 'percent'
  payoffValue: string
  apr: string
  extraPayment: string
}

type EmergencyFundForm = {
  currentSavings: string
  monthlyEssentialExpenses: string
  targetMonths: string
}

type InvestmentForm = {
  title: string
  accountType: InvestmentAccount['accountType']
  balance: string
  monthlyContribution: string
  annualReturnRate: string
}

type NetWorthForm = {
  title: string
  balance: string
  kind: NetWorthItem['kind']
  category: NetWorthItem['category']
}

type ScenarioForm = {
  title: string
  incomeChangePercent: string
  rentChange: string
  benefitChangePerPaycheck: string
  retirementContributionChangePercent: string
  extraDebtPayment: string
  oneTimePurchase: string
  investmentContributionChange: string
}

type PurchaseGoalForm = {
  title: string
  cost: string
  targetDate: string
  savingsCadence: 'weekly' | 'biweekly' | 'monthly'
}

type PaycheckEstimate = {
  grossPerPaycheck: number
  estimatedNetPaycheck: number
  estimatedTaxPerPaycheck: number
}

type ScenarioComparison = {
  baseline: number
  scenario: number
  delta: number
  percentChange: number
}

type ScenarioImpact = {
  netPaycheck: ScenarioComparison
  monthlyNet: ScenarioComparison
  sixMonthCash: ScenarioComparison
  totalDebt: ScenarioComparison
  netWorth: ScenarioComparison
  investmentFiveYearValue: ScenarioComparison
}

type NetWorthSummary = {
  totalAssets: number
  netWorth: number
}

type EmergencyFundProgress = {
  targetAmount: number
  shortfall: number
  progressPercent: number
}

type DashboardModalContentProps = {
  activeModal: ModalView
  activeScenario: ScenarioPlan | null
  balanceDraft: string
  bankBalanceSource: BankBalanceSource
  bankSyncError: string | null
  benefitForm: BenefitForm
  canUseBankSync: boolean
  closeModal: () => void
  dayForm: DayForm
  debtCustomPayment: number
  debtForm: DebtForm
  debtPlanCount: number
  debtPlans: DebtPlan[]
  debtProjectedRemaining: number
  debtRecommendedPayment: number
  emergencyFundForm: EmergencyFundForm
  emergencyFundPlan: EmergencyFundPlan
  emergencyFundProgress: EmergencyFundProgress
  essentialExpenseForm: EssentialExpenseForm
  financePlan: FinancePlan
  financialProfile: FinancialProfile
  fiveYearInvestmentProjection: number
  getPurchaseGoalProjection: (goal: PurchaseGoal) => {
    recommendedPerCadence: number
    afterPurchase: number
  }
  handleAddBenefit: FormEventHandler<HTMLFormElement>
  handleAddDayTransaction: FormEventHandler<HTMLFormElement>
  handleAddDebt: FormEventHandler<HTMLFormElement>
  handleAddEssentialExpenses: FormEventHandler<HTMLFormElement>
  handleAddInvestment: FormEventHandler<HTMLFormElement>
  handleAddNetWorthItem: FormEventHandler<HTMLFormElement>
  handleAddOneTimeTransaction: FormEventHandler<HTMLFormElement>
  handleAddPaycheck: FormEventHandler<HTMLFormElement>
  handleAddPurchaseGoal: FormEventHandler<HTMLFormElement>
  handleAddRecurring: FormEventHandler<HTMLFormElement>
  handleSaveBalance: FormEventHandler<HTMLFormElement>
  handleSaveEmergencyFund: FormEventHandler<HTMLFormElement>
  handleSaveIncomeModel: FormEventHandler<HTMLFormElement>
  handleSaveRetirementContribution: FormEventHandler<HTMLFormElement>
  handleSaveScenario: FormEventHandler<HTMLFormElement>
  handleBankBalanceSourceChange: (value: BankBalanceSource) => void
  handleConnectBank: () => void
  handleSyncBank: () => void
  handleUseNetPaycheck: () => void
  incomeModelForm: IncomeModelForm
  investmentAccounts: InvestmentAccount[]
  investmentForm: InvestmentForm
  estimatedPaycheckDate: string
  isConnectingBank: boolean
  isSyncingBank: boolean
  linkedAccounts: LinkedBankAccount[]
  linkedCashBalance: number
  linkedTransactions: LinkedBankTransaction[]
  netWorthForm: NetWorthForm
  netWorthItems: NetWorthItem[]
  netWorthSummary: NetWorthSummary
  oneTimeForm: OneTimeForm
  paycheckEstimate: PaycheckEstimate | null
  paycheckForm: PaycheckForm
  paycheckRules: PaycheckRule[]
  planGap: number
  planProjection: number
  primaryIncome?: FinancialProfile['incomeSources'][number]
  purchaseGoalForm: PurchaseGoalForm
  purchaseGoals: PurchaseGoal[]
  recurringForm: RecurringForm
  recurringTransactions: RecurringTransaction[]
  removeOccurrence: (item: CalendarOccurrence) => void
  retirementForm: RetirementForm
  scenarioForm: ScenarioForm
  scenarioImpact: ScenarioImpact | null
  scenarioPlans: ScenarioPlan[]
  scheduledTransactions: ScheduledTransaction[]
  selectedDateKey: string
  selectedDayBalance: number
  selectedDayTransactions: CalendarOccurrence[]
  setBalanceDraft: Dispatch<SetStateAction<string>>
  setBenefitForm: Dispatch<SetStateAction<BenefitForm>>
  setDebtForm: Dispatch<SetStateAction<DebtForm>>
  setDebtPlans: Dispatch<SetStateAction<DebtPlan[]>>
  setEmergencyFundForm: Dispatch<SetStateAction<EmergencyFundForm>>
  setEssentialExpenseForm: Dispatch<SetStateAction<EssentialExpenseForm>>
  setFinancePlan: Dispatch<SetStateAction<FinancePlan>>
  setFinancialProfile: Dispatch<SetStateAction<FinancialProfile>>
  setDayForm: Dispatch<SetStateAction<DayForm>>
  setIncomeModelForm: Dispatch<SetStateAction<IncomeModelForm>>
  setInvestmentAccounts: Dispatch<SetStateAction<InvestmentAccount[]>>
  setInvestmentForm: Dispatch<SetStateAction<InvestmentForm>>
  setNetWorthForm: Dispatch<SetStateAction<NetWorthForm>>
  setNetWorthItems: Dispatch<SetStateAction<NetWorthItem[]>>
  setOneTimeForm: Dispatch<SetStateAction<OneTimeForm>>
  setEstimatedPaycheckDate: Dispatch<SetStateAction<string>>
  setPaycheckForm: Dispatch<SetStateAction<PaycheckForm>>
  setPaycheckRules: Dispatch<SetStateAction<PaycheckRule[]>>
  setPurchaseGoalForm: Dispatch<SetStateAction<PurchaseGoalForm>>
  setPurchaseGoals: Dispatch<SetStateAction<PurchaseGoal[]>>
  setRecurringForm: Dispatch<SetStateAction<RecurringForm>>
  setRecurringTransactions: Dispatch<SetStateAction<RecurringTransaction[]>>
  setRetirementForm: Dispatch<SetStateAction<RetirementForm>>
  setScenarioForm: Dispatch<SetStateAction<ScenarioForm>>
  setScenarioPlans: Dispatch<SetStateAction<ScenarioPlan[]>>
  setScheduledTransactions: Dispatch<SetStateAction<ScheduledTransaction[]>>
  today: Date
  totalBenefitsPerPaycheck: number
  totalInvestmentBalance: number
  totalRetirementPerPaycheck: number
}

export function DashboardModalContent(props: DashboardModalContentProps) {
  const {
    activeModal,
    activeScenario,
    balanceDraft,
    bankBalanceSource,
    bankSyncError,
    benefitForm,
    canUseBankSync,
    closeModal,
    dayForm,
    debtCustomPayment,
    debtForm,
    debtPlanCount,
    debtPlans,
    debtProjectedRemaining,
    debtRecommendedPayment,
    emergencyFundForm,
    emergencyFundPlan,
    emergencyFundProgress,
    essentialExpenseForm,
    financePlan,
    financialProfile,
    fiveYearInvestmentProjection,
    getPurchaseGoalProjection,
    handleAddBenefit,
    handleAddDayTransaction,
    handleAddDebt,
    handleAddEssentialExpenses,
    handleAddInvestment,
    handleAddNetWorthItem,
    handleAddOneTimeTransaction,
    handleAddPaycheck,
    handleAddPurchaseGoal,
    handleAddRecurring,
    handleSaveBalance,
    handleSaveEmergencyFund,
    handleSaveIncomeModel,
    handleSaveRetirementContribution,
    handleSaveScenario,
    handleBankBalanceSourceChange,
    handleConnectBank,
    handleSyncBank,
    handleUseNetPaycheck,
    incomeModelForm,
    investmentAccounts,
    investmentForm,
    estimatedPaycheckDate,
    isConnectingBank,
    isSyncingBank,
    linkedAccounts,
    linkedCashBalance,
    linkedTransactions,
    netWorthForm,
    netWorthItems,
    netWorthSummary,
    oneTimeForm,
    paycheckEstimate,
    paycheckForm,
    paycheckRules,
    planGap,
    planProjection,
    primaryIncome,
    purchaseGoalForm,
    purchaseGoals,
    recurringForm,
    recurringTransactions,
    removeOccurrence,
    retirementForm,
    scenarioForm,
    scenarioImpact,
    scenarioPlans,
    scheduledTransactions,
    selectedDateKey,
    selectedDayBalance,
    selectedDayTransactions,
    setBalanceDraft,
    setBenefitForm,
    setDayForm,
    setDebtForm,
    setDebtPlans,
    setEmergencyFundForm,
    setEssentialExpenseForm,
    setFinancePlan,
    setFinancialProfile,
    setIncomeModelForm,
    setInvestmentAccounts,
    setInvestmentForm,
    setNetWorthForm,
    setNetWorthItems,
    setOneTimeForm,
    setEstimatedPaycheckDate,
    setPaycheckForm,
    setPaycheckRules,
    setPurchaseGoalForm,
    setPurchaseGoals,
    setRecurringForm,
    setRecurringTransactions,
    setRetirementForm,
    setScenarioForm,
    setScenarioPlans,
    setScheduledTransactions,
    today,
    totalBenefitsPerPaycheck,
    totalInvestmentBalance,
    totalRetirementPerPaycheck,
  } = props
  const [transactionScheduleMode, setTransactionScheduleMode] = useState<
    'oneTime' | 'recurring'
  >(activeModal === 'recurring' ? 'recurring' : 'oneTime')
  const [paycheckEntryMode, setPaycheckEntryMode] = useState<'simple' | 'taxes'>(
    activeModal === 'incomeModel' ? 'taxes' : 'simple',
  )
  const [lastScheduleModal, setLastScheduleModal] = useState(activeModal)

  // Reset the mode toggles when the modal view changes while mounted,
  // adjusting state during render instead of inside an effect.
  if (activeModal !== lastScheduleModal) {
    setLastScheduleModal(activeModal)

    if (activeModal === 'oneTime' || activeModal === 'recurring') {
      setTransactionScheduleMode(activeModal === 'recurring' ? 'recurring' : 'oneTime')
    }

    if (activeModal === 'paycheck' || activeModal === 'incomeModel') {
      setPaycheckEntryMode(activeModal === 'incomeModel' ? 'taxes' : 'simple')
    }
  }

  if (activeModal === 'bankSync') {
    return (
      <BankSyncModal
        bankBalanceSource={bankBalanceSource}
        bankSyncError={bankSyncError}
        canUseBankSync={canUseBankSync}
        closeModal={closeModal}
        isConnectingBank={isConnectingBank}
        isSyncingBank={isSyncingBank}
        linkedAccounts={linkedAccounts}
        linkedCashBalance={linkedCashBalance}
        linkedTransactions={linkedTransactions}
        onBankBalanceSourceChange={handleBankBalanceSourceChange}
        onConnectBank={handleConnectBank}
        onSyncBank={handleSyncBank}
      />
    )
  }

    if (activeModal === 'balanceEdit') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Balance</p>
              <h2>Update available balance</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleSaveBalance}>
            <label className="field-stack">
              <span>Available balance</span>
              <div className="money-input-row">
                <strong>$</strong>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={balanceDraft}
                  onChange={(event) => setBalanceDraft(event.target.value)}
                />
              </div>
            </label>
            <button type="submit">Save balance</button>
          </form>
        </>
      )
    }

    if (activeModal === 'day') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Selected day</p>
              <h2>{formatLongDate(selectedDateKey)}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <div className="status-strip">
            <div>
              <span>Projected money</span>
              <strong>{currency.format(selectedDayBalance)}</strong>
            </div>
            <div>
              <span>Scheduled items</span>
              <strong>{selectedDayTransactions.length}</strong>
            </div>
          </div>
          <form className="stack-form" onSubmit={handleAddDayTransaction}>
            <input
              type="text"
              placeholder="Scheduled transaction" required
              value={dayForm.title}
              onChange={(event) =>
                setDayForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Amount" required
                value={dayForm.amount}
                onChange={(event) =>
                  setDayForm((current) => ({ ...current, amount: event.target.value }))
                }
              />
              <select
                value={dayForm.type}
                onChange={(event) =>
                  setDayForm((current) => ({
                    ...current,
                    type: event.target.value as TransactionType,
                  }))
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
                <option value="debt">Debt payment</option>
              </select>
            </div>
            <button type="submit">Add to this day</button>
          </form>
          <div className="modal-list">
            {selectedDayTransactions.length === 0 ? (
              <p className="empty-copy">No transactions scheduled for this day yet.</p>
            ) : (
              selectedDayTransactions.map((item) => (
                <div className="modal-list-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.category ? `${item.type} • ${item.category}` : item.type}</p>
                  </div>
                  <div className="row-actions">
                    <span>{currency.format(item.amount)}</span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeOccurrence(item)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )
    }

    if (activeModal === 'oneTime' || activeModal === 'recurring') {
      const isRecurring = transactionScheduleMode === 'recurring'

      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Transactions</p>
              <h2>Schedule transactions</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <div className="split-row">
            <button
              type="button"
              className={`weekday-chip ${!isRecurring ? 'selected' : ''}`}
              onClick={() => setTransactionScheduleMode('oneTime')}
            >
              One-time
            </button>
            <button
              type="button"
              className={`weekday-chip ${isRecurring ? 'selected' : ''}`}
              onClick={() => setTransactionScheduleMode('recurring')}
            >
              Recurring
            </button>
          </div>
          <p className="empty-copy modal-intro">
            {isRecurring
              ? 'Create repeating transactions that should keep showing up on the calendar.'
              : 'Create a one-time transaction for a specific date without making it repeat.'}
          </p>
          {isRecurring ? (
            <>
              <form className="stack-form" onSubmit={handleAddRecurring}>
                <input
                  type="text"
                  placeholder="Name" required
                  value={recurringForm.title}
                  onChange={(event) =>
                    setRecurringForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
                <select
                  value={recurringForm.frequency}
                  onChange={(event) =>
                    setRecurringForm((current) => ({
                      ...current,
                      frequency: event.target.value as 'monthly' | 'weekly',
                    }))
                  }
                >
                  <option value="monthly">Monthly on a date</option>
                  <option value="weekly">Weekly on weekdays</option>
                </select>
                <div className="split-row">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount" required
                    value={recurringForm.amount}
                    onChange={(event) =>
                      setRecurringForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                  {recurringForm.frequency === 'monthly' ? (
                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Day of month" required
                      value={recurringForm.dayOfMonth}
                      onChange={(event) =>
                        setRecurringForm((current) => ({
                          ...current,
                          dayOfMonth: event.target.value,
                        }))
                      }
                    />
                  ) : (
                    <div className="weekday-picker">
                      {weekdayOptions.map((option) => {
                        const selected = recurringForm.weekdays.includes(option.value)

                        return (
                          <button
                            type="button"
                            key={option.value}
                            className={`weekday-chip ${selected ? 'selected' : ''}`}
                            onClick={() =>
                              setRecurringForm((current) => ({
                                ...current,
                                weekdays: current.weekdays.includes(option.value)
                                  ? current.weekdays.filter((day) => day !== option.value)
                                  : [...current.weekdays, option.value].sort((a, b) => a - b),
                              }))
                            }
                          >
                            {option.label.slice(0, 3)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                {recurringForm.frequency === 'weekly' &&
                recurringForm.weekdays.length === 0 ? (
                  <p className="empty-copy">Pick at least one weekday above.</p>
                ) : null}
                <select
                  value={recurringForm.type}
                  onChange={(event) =>
                    setRecurringForm((current) => ({
                      ...current,
                      type: event.target.value as Exclude<TransactionType, 'income'>,
                    }))
                  }
                >
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                  <option value="debt">Debt payment</option>
                </select>
                <label className="field-stack">
                  <span>Start date (optional)</span>
                  <input
                    type="date"
                    value={recurringForm.startDate}
                    onChange={(event) =>
                      setRecurringForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field-stack">
                  <span>End date (optional)</span>
                  <input
                    type="date"
                    value={recurringForm.endDate}
                    onChange={(event) =>
                      setRecurringForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <button type="submit">Add recurring transaction</button>
              </form>
              <div className="modal-list compact-list">
                {recurringTransactions.length === 0 ? (
                  <p className="empty-copy">No recurring transactions yet.</p>
                ) : (
                  recurringTransactions.map((item) => (
                    <div className="modal-list-row" key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <p>
                          {item.frequency === 'monthly' && item.dayOfMonth
                            ? `${item.type} on day ${item.dayOfMonth}`
                            : item.frequency === 'weekly' && item.weekdays?.length
                              ? `${item.type} on ${getWeekdayList(item.weekdays)}`
                              : item.type}
                          {item.startDate ? ` from ${formatLongDate(item.startDate)}` : ''}
                          {item.endDate ? ` until ${formatLongDate(item.endDate)}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setRecurringTransactions((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <form className="stack-form" onSubmit={handleAddOneTimeTransaction}>
                <input
                  type="text"
                  placeholder="Transaction name" required
                  value={oneTimeForm.title}
                  onChange={(event) =>
                    setOneTimeForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
                <div className="split-row">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount" required
                    value={oneTimeForm.amount}
                    onChange={(event) =>
                      setOneTimeForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="date"
                    required
                    value={oneTimeForm.date}
                    onChange={(event) =>
                      setOneTimeForm((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="split-row">
                  <select
                    value={oneTimeForm.type}
                    onChange={(event) =>
                      setOneTimeForm((current) => ({
                        ...current,
                        type: event.target.value as TransactionType,
                      }))
                    }
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer</option>
                    <option value="debt">Debt payment</option>
                  </select>
                  <select
                    value={oneTimeForm.category}
                    onChange={(event) =>
                      setOneTimeForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Dates">Dates</option>
                    <option value="Food">Food</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Transport">Transport</option>
                    <option value="Health">Health</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <button type="submit">Add one-time transaction</button>
              </form>
              <div className="modal-list debt-ledger-list">
                {scheduledTransactions.length === 0 ? (
                  <p className="empty-copy">
                    Add one-time payments here for irregular spending and non-recurring costs.
                  </p>
                ) : (
                  scheduledTransactions
                    .slice()
                    .sort((left, right) => left.date.localeCompare(right.date))
                    .map((transaction) => (
                      <div className="modal-list-row" key={transaction.id}>
                        <div>
                          <strong>{transaction.title}</strong>
                          <p>
                            {transaction.category
                              ? `${transaction.category} • ${formatLongDate(transaction.date)}`
                              : formatLongDate(transaction.date)}
                          </p>
                        </div>
                        <div className="row-actions">
                          <span
                            className={`day-net ${
                              getSignedAmount(transaction.amount, transaction.type) >= 0
                                ? 'positive'
                                : 'negative'
                            }`}
                          >
                            {getSignedAmount(transaction.amount, transaction.type) >= 0
                              ? '+'
                              : '-'}
                            {currency.format(transaction.amount)}
                          </span>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() =>
                              setScheduledTransactions((current) =>
                                current.filter((entry) => entry.id !== transaction.id),
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </>
      )
    }

    if (activeModal === 'paycheck' || activeModal === 'incomeModel') {
      const usesTaxEstimate = paycheckEntryMode === 'taxes'
      const canUseEstimateAsPaycheck =
        primaryIncome?.payFrequency === 'weekly' ||
        primaryIncome?.payFrequency === 'biweekly' ||
        primaryIncome?.payFrequency === 'monthly'

      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Income</p>
              <h2>Paychecks</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <div className="split-row">
            <button
              type="button"
              className={`weekday-chip ${!usesTaxEstimate ? 'selected' : ''}`}
              onClick={() => setPaycheckEntryMode('simple')}
            >
              Quick add
            </button>
            <button
              type="button"
              className={`weekday-chip ${usesTaxEstimate ? 'selected' : ''}`}
              onClick={() => setPaycheckEntryMode('taxes')}
            >
              Salary & taxes
            </button>
          </div>
          <p className="empty-copy modal-intro">
            {usesTaxEstimate
              ? `Estimate take-home pay from salary, state, filing status, benefits, and retirement, then schedule the net amount as a paycheck. Estimates use ${TAX_YEAR} federal tax rules and are not tax advice.`
              : 'Add the amount that reaches your account and how often it arrives.'}
          </p>
          {usesTaxEstimate ? null : (
          <form className="stack-form" onSubmit={handleAddPaycheck}>
            <input
              type="text"
              placeholder="Paycheck label" required
              value={paycheckForm.title}
              onChange={(event) =>
                setPaycheckForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
            <select
              value={paycheckForm.frequency}
              onChange={(event) =>
                setPaycheckForm((current) => ({
                  ...current,
                  frequency: event.target.value as PaycheckRule['frequency'],
                }))
              }
            >
              <option value="monthly">Monthly on a date</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
            </select>
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Amount" required
                value={paycheckForm.amount}
                onChange={(event) =>
                  setPaycheckForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
              />
              {paycheckForm.frequency === 'monthly' ? (
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Day of month" required
                  value={paycheckForm.dayOfMonth}
                  onChange={(event) =>
                    setPaycheckForm((current) => ({
                      ...current,
                      dayOfMonth: event.target.value,
                    }))
                  }
                />
              ) : (
                <select
                  value={paycheckForm.weekday}
                  onChange={(event) =>
                    setPaycheckForm((current) => ({
                      ...current,
                      weekday: event.target.value,
                    }))
                  }
                >
                  {weekdayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {paycheckForm.frequency !== 'monthly' ? (
              <label className="field-stack">
                <span>First paycheck date</span>
                <input
                  type="date"
                  required
                  value={paycheckForm.startDate}
                  onChange={(event) =>
                    setPaycheckForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                      weekday: String(parseDateKey(event.target.value).getDay()),
                    }))
                  }
                />
              </label>
            ) : null}
            <button type="submit">Add paycheck</button>
          </form>
          )}
          {usesTaxEstimate ? (
            <>
          <form className="stack-form" onSubmit={handleSaveIncomeModel}>
            <input
              type="text"
              placeholder="Income name" required
              value={incomeModelForm.name}
              onChange={(event) =>
                setIncomeModelForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
            <div className="split-row">
              <label className="field-stack">
                <span>Income type</span>
                <select
                  value={incomeModelForm.type}
                  onChange={(event) =>
                    setIncomeModelForm((current) => ({
                      ...current,
                      type: event.target.value as typeof incomeModelForm.type,
                    }))
                  }
                >
                  <option value="salary">Salary</option>
                  <option value="hourly">Hourly</option>
                  <option value="contract">Contract</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field-stack">
                <span>{incomeModelForm.type === 'hourly' ? 'Hourly rate' : 'Annual amount'}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0" required
                  value={incomeModelForm.amount}
                  onChange={(event) =>
                    setIncomeModelForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="split-row">
              <label className="field-stack">
                <span>Hours per week</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={incomeModelForm.type !== 'hourly'}
                  value={incomeModelForm.hoursPerWeek}
                  onChange={(event) =>
                    setIncomeModelForm((current) => ({
                      ...current,
                      hoursPerWeek: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field-stack">
                <span>Pay frequency</span>
                <select
                  value={incomeModelForm.payFrequency}
                  onChange={(event) =>
                    setIncomeModelForm((current) => ({
                      ...current,
                      payFrequency: event.target.value as typeof incomeModelForm.payFrequency,
                    }))
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="semimonthly">Semimonthly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
            </div>
            <div className="split-row">
              <label className="field-stack">
                <span>State</span>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="FL"
                  value={incomeModelForm.state}
                  onChange={(event) =>
                    setIncomeModelForm((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field-stack">
                <span>Filing status</span>
                <select
                  value={incomeModelForm.filingStatus}
                  onChange={(event) =>
                    setIncomeModelForm((current) => ({
                      ...current,
                      filingStatus: event.target.value as typeof incomeModelForm.filingStatus,
                    }))
                  }
                >
                  <option value="single">Single</option>
                  <option value="married_joint">Married filing jointly</option>
                  <option value="married_separate">Married filing separately</option>
                  <option value="head_of_household">Head of household</option>
                </select>
              </label>
            </div>
            <button type="submit">Save income model</button>
          </form>

          <div className="status-strip estimate-strip">
            <div>
              <span>Gross per paycheck</span>
              <strong>
                {paycheckEstimate ? currency.format(paycheckEstimate.grossPerPaycheck) : '--'}
              </strong>
            </div>
            <div>
              <span>Estimated net paycheck</span>
              <strong>
                {paycheckEstimate
                  ? currency.format(paycheckEstimate.estimatedNetPaycheck)
                  : '--'}
              </strong>
            </div>
          </div>
          <div className="estimate-breakdown">
            <div>
              <span>Taxes per paycheck</span>
              <strong>
                {paycheckEstimate
                  ? currency.format(paycheckEstimate.estimatedTaxPerPaycheck)
                  : '--'}
              </strong>
            </div>
            <div>
              <span>Benefits per paycheck</span>
              <strong>{currency.format(totalBenefitsPerPaycheck)}</strong>
            </div>
            <div>
              <span>Retirement per paycheck</span>
              <strong>{currency.format(totalRetirementPerPaycheck)}</strong>
            </div>
          </div>
          {canUseEstimateAsPaycheck ? (
            <label className="field-stack">
              <span>
                {primaryIncome?.payFrequency === 'monthly'
                  ? 'Paycheck date'
                  : 'First paycheck date'}
              </span>
              <input
                type="date"
                value={estimatedPaycheckDate}
                onChange={(event) => setEstimatedPaycheckDate(event.target.value)}
              />
            </label>
          ) : null}
          {paycheckEstimate ? (
            <button
              type="button"
              className="ghost-button full-width-action"
              disabled={!canUseEstimateAsPaycheck}
              onClick={handleUseNetPaycheck}
            >
              Use estimated net pay as paycheck rule
            </button>
          ) : null}
          {!canUseEstimateAsPaycheck && paycheckEstimate ? (
            <p className="empty-copy">
              Semimonthly scheduling is modeled for pay estimates, but paycheck
              calendar rules currently support weekly, biweekly, and monthly timing.
            </p>
          ) : null}
            </>
          ) : null}
          <div className="modal-list compact-list">
            {paycheckRules.length === 0 ? (
              <p className="empty-copy">No scheduled paychecks yet.</p>
            ) : (
              paycheckRules.map((item) => (
                <div className="modal-list-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.frequency === 'monthly' && item.dayOfMonth
                        ? `Monthly on day ${item.dayOfMonth}`
                        : item.frequency === 'weekly' && typeof item.weekday === 'number'
                          ? `Weekly on ${weekdayOptions[item.weekday].label}`
                          : item.frequency === 'biweekly' &&
                            typeof item.weekday === 'number'
                            ? `Biweekly on ${weekdayOptions[item.weekday].label}`
                            : ''}
                    </p>
                  </div>
                  <div className="row-actions">
                    <span className="day-net positive">
                      +{currency.format(item.amount)}
                    </span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setPaycheckRules((current) =>
                          current.filter((entry) => entry.id !== item.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )
    }

    if (activeModal === 'benefits') {
      const retirementContribution = financialProfile.retirementContributions[0]

      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Benefits</p>
              <h2>Deductions and retirement</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <p className="empty-copy modal-intro">
            Add per-paycheck deductions for health plans, insurance, HSA/FSA, and
            other benefits. Pre-tax items reduce the taxable income estimate.
          </p>
          <form className="stack-form" onSubmit={handleAddBenefit}>
            <input
              type="text"
              placeholder="Benefit name" required
              value={benefitForm.name}
              onChange={(event) =>
                setBenefitForm((current) => ({ ...current, name: event.target.value }))
              }
            />
            <div className="split-row">
              <label className="field-stack">
                <span>Benefit type</span>
                <select
                  value={benefitForm.type}
                  onChange={(event) =>
                    setBenefitForm((current) => ({
                      ...current,
                      type: event.target.value as BenefitElection['type'],
                    }))
                  }
                >
                  <option value="health">Health insurance</option>
                  <option value="dental">Dental</option>
                  <option value="vision">Vision</option>
                  <option value="life">Life insurance</option>
                  <option value="disability">Disability insurance</option>
                  <option value="accident">Accident insurance</option>
                  <option value="critical_illness">Critical illness</option>
                  <option value="hospital_indemnity">Hospital indemnity</option>
                  <option value="hsa">HSA</option>
                  <option value="fsa">FSA</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field-stack">
                <span>Amount per paycheck</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0" required
                  value={benefitForm.amountPerPaycheck}
                  onChange={(event) =>
                    setBenefitForm((current) => ({
                      ...current,
                      amountPerPaycheck: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <select
              value={benefitForm.taxTreatment}
              onChange={(event) =>
                setBenefitForm((current) => ({
                  ...current,
                  taxTreatment: event.target.value as BenefitElection['taxTreatment'],
                }))
              }
            >
              <option value="pre_tax">Pre-tax deduction</option>
              <option value="post_tax">Post-tax deduction</option>
            </select>
            <button type="submit">Add benefit deduction</button>
          </form>

          <form className="stack-form retirement-form" onSubmit={handleSaveRetirementContribution}>
            <div className="modal-header compact-modal-header">
              <div>
                <p className="eyebrow">Retirement</p>
                <h2>Contribution plan</h2>
              </div>
            </div>
            <div className="split-row">
              <label className="field-stack">
                <span>Account</span>
                <select
                  value={retirementForm.accountType}
                  onChange={(event) =>
                    setRetirementForm((current) => ({
                      ...current,
                      accountType: event.target.value as RetirementContribution['accountType'],
                    }))
                  }
                >
                  <option value="traditional_401k">Traditional 401(k)</option>
                  <option value="roth_401k">Roth 401(k)</option>
                  <option value="traditional_ira">Traditional IRA</option>
                  <option value="roth_ira">Roth IRA</option>
                </select>
              </label>
              <label className="field-stack">
                <span>Contribution type</span>
                <select
                  value={retirementForm.contributionMode}
                  onChange={(event) =>
                    setRetirementForm((current) => ({
                      ...current,
                      contributionMode:
                        event.target.value as RetirementContribution['contributionMode'],
                    }))
                  }
                >
                  <option value="percent">% of paycheck</option>
                  <option value="amount">Fixed amount</option>
                </select>
              </label>
            </div>
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={retirementForm.contributionMode === 'percent' ? 'e.g. 6' : 'e.g. 150'} required
                value={retirementForm.contributionValue}
                onChange={(event) =>
                  setRetirementForm((current) => ({
                    ...current,
                    contributionValue: event.target.value,
                  }))
                }
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Employer match %"
                value={retirementForm.employerMatchPercent}
                onChange={(event) =>
                  setRetirementForm((current) => ({
                    ...current,
                    employerMatchPercent: event.target.value,
                  }))
                }
              />
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Employer match limit % of pay"
              value={retirementForm.employerMatchLimitPercent}
              onChange={(event) =>
                setRetirementForm((current) => ({
                  ...current,
                  employerMatchLimitPercent: event.target.value,
                }))
              }
            />
            <button type="submit">Save retirement contribution</button>
          </form>

          <div className="modal-list compact-list">
            {financialProfile.benefitElections.length === 0 ? (
              <p className="empty-copy">No benefit deductions added yet.</p>
            ) : (
              financialProfile.benefitElections.map((benefit) => (
                <div className="modal-list-row" key={benefit.id}>
                  <div>
                    <strong>{benefit.name}</strong>
                    <p>
                      {benefit.type.replaceAll('_', ' ')} •{' '}
                      {benefit.taxTreatment === 'pre_tax' ? 'pre-tax' : 'post-tax'}
                    </p>
                  </div>
                  <div className="row-actions">
                    <span>{currency.format(benefit.amountPerPaycheck)}</span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setFinancialProfile((current) => ({
                          ...current,
                          benefitElections: current.benefitElections.filter(
                            (entry) => entry.id !== benefit.id,
                          ),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
            {retirementContribution ? (
              <div className="modal-list-row">
                <div>
                  <strong>{retirementContribution.accountType.replaceAll('_', ' ')}</strong>
                  <p>
                    {retirementContribution.contributionMode === 'percent'
                      ? `${retirementContribution.contributionValue}% of each paycheck`
                      : `${currency.format(
                        retirementContribution.contributionValue,
                      )} per paycheck`}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() =>
                    setFinancialProfile((current) => ({
                      ...current,
                      retirementContributions: [],
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </>
      )
    }

    if (activeModal === 'essentials') {
      const housingExpenses = recurringTransactions.filter(
        (transaction) => transaction.category === 'Housing',
      )
      const essentialExpenses = recurringTransactions.filter(
        (transaction) => transaction.category === 'Essentials',
      )

      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Core expenses</p>
              <h2>Housing and essentials</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <p className="empty-copy modal-intro">
            Separate housing from everyday essentials so the forecast can track rent
            related costs independently from the rest of your baseline spending.
          </p>
          <form className="stack-form" onSubmit={handleAddEssentialExpenses}>
            <p className="eyebrow">Housing</p>
            <div className="split-row">
              <label className="field-stack">
                <span>Rent / mortgage</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={essentialExpenseForm.rent}
                  onChange={(event) =>
                    setEssentialExpenseForm((current) => ({
                      ...current,
                      rent: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field-stack">
                <span>Rent due day</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={essentialExpenseForm.rentDueDay}
                  onChange={(event) =>
                    setEssentialExpenseForm((current) => ({
                      ...current,
                      rentDueDay: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="essential-grid">
              {[
                ['water', 'Water'],
                ['electricity', 'Electricity'],
              ].map(([key, label]) => (
                <label className="field-stack" key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={
                      essentialExpenseForm[
                      key as keyof typeof essentialExpenseForm
                      ]
                    }
                    onChange={(event) =>
                      setEssentialExpenseForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <p className="eyebrow">Essentials</p>
            <div className="essential-grid">
              {[
                ['utilities', 'Utilities'],
                ['phone', 'Phone'],
                ['internet', 'Internet'],
                ['insurance', 'Insurance'],
                ['subscriptions', 'Subscriptions'],
                ['groceries', 'Groceries'],
                ['transportation', 'Transportation'],
              ].map(([key, label]) => (
                <label className="field-stack" key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={
                      essentialExpenseForm[
                      key as keyof typeof essentialExpenseForm
                      ]
                    }
                    onChange={(event) =>
                      setEssentialExpenseForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <label className="field-stack">
                <span>Default due day</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={essentialExpenseForm.dueDay}
                  onChange={(event) =>
                    setEssentialExpenseForm((current) => ({
                      ...current,
                      dueDay: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <button type="submit">Add essential expenses</button>
          </form>
          <div className="modal-list compact-list">
            {housingExpenses.length === 0 && essentialExpenses.length === 0 ? (
              <p className="empty-copy">
                No housing or essential expenses have been marked yet. Add them here
                so affordability checks start from real obligations.
              </p>
            ) : (
              <>
                {housingExpenses.length > 0 ? (
                  <p className="eyebrow">Housing</p>
                ) : null}
                {housingExpenses.map((item) => (
                  <div className="modal-list-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>Monthly on day {item.dayOfMonth ?? 1}</p>
                    </div>
                    <div className="row-actions">
                      <span>{currency.format(item.amount)}</span>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setRecurringTransactions((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {essentialExpenses.length > 0 ? (
                  <p className="eyebrow">Essentials</p>
                ) : null}
                {essentialExpenses.map((item) => (
                  <div className="modal-list-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>Monthly on day {item.dayOfMonth ?? 1}</p>
                    </div>
                    <div className="row-actions">
                      <span>{currency.format(item.amount)}</span>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setRecurringTransactions((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )
    }

    if (activeModal === 'debt') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Debt</p>
              <h2>Debt and due dates</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleAddDebt}>
            <input
              type="text"
              placeholder="Debt name" required
              value={debtForm.title}
              onChange={(event) =>
                setDebtForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Balance" required
                value={debtForm.balance}
                onChange={(event) =>
                  setDebtForm((current) => ({ ...current, balance: event.target.value }))
                }
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Minimum due" required
                value={debtForm.minimumDue}
                onChange={(event) =>
                  setDebtForm((current) => ({
                    ...current,
                    minimumDue: event.target.value,
                  }))
                }
              />
            </div>
            <div className="split-row">
              <label className="field-stack">
                <span>Due date</span>
                <input
                  type="date"
                  required
                  value={debtForm.dueDate}
                  onChange={(event) =>
                    setDebtForm((current) => ({ ...current, dueDate: event.target.value }))
                  }
                />
              </label>
              <label className="field-stack">
                <span>Payoff target (optional)</span>
                <input
                  type="date"
                  value={debtForm.payoffDate}
                  onChange={(event) =>
                    setDebtForm((current) => ({
                      ...current,
                      payoffDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="APR % (optional)"
                value={debtForm.apr}
                onChange={(event) =>
                  setDebtForm((current) => ({ ...current, apr: event.target.value }))
                }
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Extra monthly payment"
                value={debtForm.extraPayment}
                onChange={(event) =>
                  setDebtForm((current) => ({
                    ...current,
                    extraPayment: event.target.value,
                  }))
                }
              />
            </div>
            {debtForm.payoffDate ? (
              <>
                <div className="split-row">
                  <label className="field-stack">
                    <span>Pay cadence</span>
                    <select
                      value={debtForm.payoffCadence}
                      onChange={(event) =>
                        setDebtForm((current) => ({
                          ...current,
                          payoffCadence: event.target.value as
                            | 'weekly'
                            | 'biweekly'
                            | 'monthly',
                        }))
                      }
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </label>
                  <label className="field-stack">
                    <span>Plan type</span>
                    <select
                      value={debtForm.payoffMode}
                      onChange={(event) =>
                        setDebtForm((current) => ({
                          ...current,
                          payoffMode: event.target.value as 'amount' | 'percent',
                        }))
                      }
                    >
                      <option value="amount">Fixed amount</option>
                      <option value="percent">% of balance</option>
                    </select>
                  </label>
                </div>
                <label className="field-stack">
                  <span>
                    {debtForm.payoffMode === 'amount'
                      ? 'Your planned payment amount (optional)'
                      : 'Your planned percent each payment (optional)'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={
                      debtForm.payoffMode === 'amount' ? 'e.g. 150' : 'e.g. 10'
                    }
                    value={debtForm.payoffValue}
                    onChange={(event) =>
                      setDebtForm((current) => ({
                        ...current,
                        payoffValue: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="payoff-helper">
                  <p>
                    To pay off this balance by {formatLongDate(debtForm.payoffDate)}, you
                    should pay about {currency.format(Math.ceil(debtRecommendedPayment))}{' '}
                    {getCadenceLabel(debtForm.payoffCadence)} for {debtPlanCount} payments.
                  </p>
                  {debtForm.payoffValue ? (
                    <p>
                      Your plan is{' '}
                      {debtForm.payoffMode === 'amount'
                        ? `${currency.format(debtCustomPayment)} ${getCadenceLabel(
                          debtForm.payoffCadence,
                        )}`
                        : `${Number(debtForm.payoffValue)}% of the balance each ${getCadenceLabel(
                          debtForm.payoffCadence,
                        )} (${currency.format(Math.ceil(debtCustomPayment))})`}{' '}
                      and would {debtProjectedRemaining <= 0 ? 'fully cover' : 'leave'}{' '}
                      {debtProjectedRemaining <= 0
                        ? currency.format(Math.abs(Math.ceil(debtProjectedRemaining)))
                        : currency.format(Math.ceil(debtProjectedRemaining))}{' '}
                      by the target date.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
            <button type="submit">Add debt plan</button>
          </form>
          <div className="modal-list compact-list">
            {debtPlans.length === 0 ? (
              <p className="empty-copy">No debts tracked yet.</p>
            ) : (
              debtPlans.map((debt) => (
                <div className="debt-row" key={debt.id}>
                  <div>
                    <strong>{debt.title}</strong>
                    <p>Due {formatLongDate(debt.dueDate)}</p>
                    <p>
                      {debt.payoffDate
                        ? `Need about ${currency.format(
                          Math.ceil(
                            getMonthlyAmountNeeded(debt.balance, debt.payoffDate),
                          ),
                        )} per month`
                        : 'No payoff target set yet'}
                    </p>
                    {debt.payoffDate && debt.payoffCadence ? (
                      <p>
                        Recommended: {currency.format(
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
                    {typeof debt.apr === 'number' ? (
                      <p>
                        APR payoff:{' '}
                        {(() => {
                          const result = estimateDebtAmortization({
                            balance: debt.balance,
                            apr: debt.apr ?? 0,
                            monthlyPayment:
                              debt.minimumDue + (debt.extraPayment ?? 0),
                          })

                          return result.isPayoffPossible
                            ? `${result.months} months, ${currency.format(
                              Math.ceil(result.totalInterest),
                            )} interest`
                            : 'payment does not cover interest'
                        })()}
                      </p>
                    ) : null}
                  </div>
                  <div className="debt-side">
                    <span>{currency.format(debt.balance)}</span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setDebtPlans((current) =>
                          current.filter((entry) => entry.id !== debt.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )
    }

    if (activeModal === 'plan') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Target</p>
              <h2>Finance plan</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={(event) => event.preventDefault()}>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Target amount"
              value={financePlan.targetAmount || ''}
              onChange={(event) =>
                setFinancePlan((current) => ({
                  ...current,
                  targetAmount: Number(event.target.value),
                }))
              }
            />
            <input
              type="date"
              value={financePlan.targetDate}
              onChange={(event) =>
                setFinancePlan((current) => ({
                  ...current,
                  targetDate: event.target.value,
                }))
              }
            />
          </form>
          <div className="status-strip">
            <div>
              <span>Projected by target</span>
              <strong>{currency.format(planProjection)}</strong>
            </div>
            <div>
              <span>{financePlan.targetDate ? 'Gap to target' : 'Set a target date'}</span>
              <strong>
                {financePlan.targetDate ? currency.format(Math.abs(planGap)) : '--'}
              </strong>
            </div>
          </div>
          <p className="empty-copy">
            {financePlan.targetDate
              ? planGap > 0
                ? `You are short ${currency.format(planGap)} based on your current schedule.`
                : `You are ahead by ${currency.format(Math.abs(planGap))}.`
              : 'Add a target amount and date to see whether your current plan gets you there.'}
          </p>
        </>
      )
    }

    if (activeModal === 'purchaseGoals') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Goals</p>
              <h2>Purchase goals</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleAddPurchaseGoal}>
            <input
              type="text"
              placeholder="What do you want to buy?" required
              value={purchaseGoalForm.title}
              onChange={(event) =>
                setPurchaseGoalForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Cost" required
                value={purchaseGoalForm.cost}
                onChange={(event) =>
                  setPurchaseGoalForm((current) => ({
                    ...current,
                    cost: event.target.value,
                  }))
                }
              />
              <input
                type="date"
                required
                value={purchaseGoalForm.targetDate}
                onChange={(event) =>
                  setPurchaseGoalForm((current) => ({
                    ...current,
                    targetDate: event.target.value,
                  }))
                }
              />
            </div>
            <select
              value={purchaseGoalForm.savingsCadence}
              onChange={(event) =>
                setPurchaseGoalForm((current) => ({
                  ...current,
                  savingsCadence: event.target.value as 'weekly' | 'biweekly' | 'monthly',
                }))
              }
            >
              <option value="weekly">Save weekly</option>
              <option value="biweekly">Save biweekly</option>
              <option value="monthly">Save monthly</option>
            </select>
            <button type="submit">Add purchase goal</button>
          </form>
          <div className="modal-list debt-ledger-list">
            {purchaseGoals.length === 0 ? (
              <p className="empty-copy">No purchase goals yet.</p>
            ) : (
              purchaseGoals.map((goal) => {
                const projection = getPurchaseGoalProjection(goal)

                return (
                  <div className="debt-row" key={goal.id}>
                    <div>
                      <strong>{goal.title}</strong>
                      <p>Target {formatLongDate(goal.targetDate)}</p>
                      <p>
                        Save about {currency.format(Math.ceil(projection.recommendedPerCadence))}{' '}
                        {getCadenceLabel(goal.savingsCadence ?? 'monthly')}
                      </p>
                      <p>
                        After purchase: {currency.format(projection.afterPurchase)}
                      </p>
                    </div>
                    <div className="debt-side">
                      <span>{currency.format(goal.cost)}</span>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setPurchaseGoals((current) =>
                            current.filter((entry) => entry.id !== goal.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )
    }

    if (activeModal === 'emergencyFund') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Safety net</p>
              <h2>Emergency fund</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleSaveEmergencyFund}>
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Current emergency savings"
                value={emergencyFundForm.currentSavings}
                onChange={(event) =>
                  setEmergencyFundForm((current) => ({
                    ...current,
                    currentSavings: event.target.value,
                  }))
                }
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Monthly essential expenses"
                value={emergencyFundForm.monthlyEssentialExpenses}
                onChange={(event) =>
                  setEmergencyFundForm((current) => ({
                    ...current,
                    monthlyEssentialExpenses: event.target.value,
                  }))
                }
              />
            </div>
            <label className="field-stack">
              <span>Target months of expenses</span>
              <input
                type="number"
                min="1"
                value={emergencyFundForm.targetMonths}
                onChange={(event) =>
                  setEmergencyFundForm((current) => ({
                    ...current,
                    targetMonths: event.target.value,
                  }))
                }
              />
            </label>
            <button type="submit">Save emergency fund plan</button>
          </form>
          <div className="status-strip estimate-strip">
            <div>
              <span>Target amount</span>
              <strong>{currency.format(emergencyFundProgress.targetAmount)}</strong>
            </div>
            <div>
              <span>Shortfall</span>
              <strong>{currency.format(emergencyFundProgress.shortfall)}</strong>
            </div>
          </div>
          <p className="empty-copy">
            You are {Math.round(emergencyFundProgress.progressPercent)}% funded toward a{' '}
            {emergencyFundPlan.targetMonths}-month emergency fund.
          </p>
        </>
      )
    }

    if (activeModal === 'investments') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Investing</p>
              <h2>Investment growth</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleAddInvestment}>
            <input
              type="text"
              placeholder="Account name" required
              value={investmentForm.title}
              onChange={(event) =>
                setInvestmentForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
            <select
              value={investmentForm.accountType}
              onChange={(event) =>
                setInvestmentForm((current) => ({
                  ...current,
                  accountType: event.target.value as InvestmentAccount['accountType'],
                }))
              }
            >
              <option value="brokerage">Brokerage</option>
              <option value="traditional_401k">Traditional 401(k)</option>
              <option value="roth_401k">Roth 401(k)</option>
              <option value="ira">IRA</option>
              <option value="roth_ira">Roth IRA</option>
              <option value="hsa">HSA</option>
              <option value="other">Other</option>
            </select>
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Current balance" required
                value={investmentForm.balance}
                onChange={(event) =>
                  setInvestmentForm((current) => ({
                    ...current,
                    balance: event.target.value,
                  }))
                }
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Monthly contribution"
                value={investmentForm.monthlyContribution}
                onChange={(event) =>
                  setInvestmentForm((current) => ({
                    ...current,
                    monthlyContribution: event.target.value,
                  }))
                }
              />
            </div>
            <label className="field-stack">
              <span>Assumed annual return %</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={investmentForm.annualReturnRate}
                onChange={(event) =>
                  setInvestmentForm((current) => ({
                    ...current,
                    annualReturnRate: event.target.value,
                  }))
                }
              />
            </label>
            <button type="submit">Add investment account</button>
          </form>
          <div className="status-strip estimate-strip">
            <div>
              <span>Current invested</span>
              <strong>{currency.format(totalInvestmentBalance)}</strong>
            </div>
            <div>
              <span>Projected in 5 years</span>
              <strong>{currency.format(fiveYearInvestmentProjection)}</strong>
            </div>
          </div>
          <div className="modal-list compact-list">
            {investmentAccounts.length === 0 ? (
              <p className="empty-copy">No investment accounts added yet.</p>
            ) : (
              investmentAccounts.map((account) => (
                <div className="modal-list-row" key={account.id}>
                  <div>
                    <strong>{account.title}</strong>
                    <p>
                      {currency.format(account.balance)} balance •{' '}
                      {currency.format(account.monthlyContribution)} monthly
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      setInvestmentAccounts((current) =>
                        current.filter((entry) => entry.id !== account.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )
    }

    if (activeModal === 'netWorth') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Net worth</p>
              <h2>Assets and liabilities</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleAddNetWorthItem}>
            <input
              type="text"
              placeholder="Item name" required
              value={netWorthForm.title}
              onChange={(event) =>
                setNetWorthForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Balance" required
                value={netWorthForm.balance}
                onChange={(event) =>
                  setNetWorthForm((current) => ({
                    ...current,
                    balance: event.target.value,
                  }))
                }
              />
              <select
                value={netWorthForm.kind}
                onChange={(event) =>
                  setNetWorthForm((current) => ({
                    ...current,
                    kind: event.target.value as NetWorthItem['kind'],
                  }))
                }
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
              </select>
            </div>
            <select
              value={netWorthForm.category}
              onChange={(event) =>
                setNetWorthForm((current) => ({
                  ...current,
                  category: event.target.value as NetWorthItem['category'],
                }))
              }
            >
              <option value="cash">Cash</option>
              <option value="investment">Investment</option>
              <option value="property">Property</option>
              <option value="vehicle">Vehicle</option>
              <option value="debt">Debt</option>
              <option value="other">Other</option>
            </select>
            <button type="submit">Add net worth item</button>
          </form>
          <div className="status-strip estimate-strip">
            <div>
              <span>Total assets</span>
              <strong>{currency.format(netWorthSummary.totalAssets)}</strong>
            </div>
            <div>
              <span>Net worth</span>
              <strong>{currency.format(netWorthSummary.netWorth)}</strong>
            </div>
          </div>
          <div className="modal-list compact-list">
            {netWorthItems.length === 0 ? (
              <p className="empty-copy">
                Add assets or liabilities that are not already represented by cash,
                investments, or tracked debts.
              </p>
            ) : (
              netWorthItems.map((item) => (
                <div className="modal-list-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.kind} • {item.category}</p>
                  </div>
                  <div className="row-actions">
                    <span>{currency.format(item.balance)}</span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setNetWorthItems((current) =>
                          current.filter((entry) => entry.id !== item.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )
    }

    if (activeModal === 'scenarios') {
      type ScenarioComparisonRow = [
        string,
        {
          baseline: number
          scenario: number
          delta: number
          percentChange: number
        },
      ]
      const comparisonRows: ScenarioComparisonRow[] = scenarioImpact
        ? [
          ['Net paycheck', scenarioImpact.netPaycheck],
          ['Monthly cash flow', scenarioImpact.monthlyNet],
          ['6-month cash', scenarioImpact.sixMonthCash],
          ['Debt after 6 months', scenarioImpact.totalDebt],
          ['Net worth', scenarioImpact.netWorth],
          ['5-year investments', scenarioImpact.investmentFiveYearValue],
        ]
        : []

      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Scenario builder</p>
              <h2>Baseline vs what-if</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleSaveScenario}>
            <input
              type="text"
              placeholder="Scenario name" required
              value={scenarioForm.title}
              onChange={(event) =>
                setScenarioForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                placeholder="Income change %"
                value={scenarioForm.incomeChangePercent}
                onChange={(event) =>
                  setScenarioForm((current) => ({
                    ...current,
                    incomeChangePercent: event.target.value,
                  }))
                }
              />
              <input
                type="number"
                step="0.01"
                placeholder="Rent increase per month"
                value={scenarioForm.rentChange}
                onChange={(event) =>
                  setScenarioForm((current) => ({
                    ...current,
                    rentChange: event.target.value,
                  }))
                }
              />
            </div>
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                placeholder="Benefit change per paycheck"
                value={scenarioForm.benefitChangePerPaycheck}
                onChange={(event) =>
                  setScenarioForm((current) => ({
                    ...current,
                    benefitChangePerPaycheck: event.target.value,
                  }))
                }
              />
              <input
                type="number"
                step="0.01"
                placeholder="401(k) change %"
                value={scenarioForm.retirementContributionChangePercent}
                onChange={(event) =>
                  setScenarioForm((current) => ({
                    ...current,
                    retirementContributionChangePercent: event.target.value,
                  }))
                }
              />
            </div>
            <div className="split-row">
              <input
                type="number"
                step="0.01"
                placeholder="Extra debt payment / month"
                value={scenarioForm.extraDebtPayment}
                onChange={(event) =>
                  setScenarioForm((current) => ({
                    ...current,
                    extraDebtPayment: event.target.value,
                  }))
                }
              />
              <input
                type="number"
                step="0.01"
                placeholder="One-time purchase"
                value={scenarioForm.oneTimePurchase}
                onChange={(event) =>
                  setScenarioForm((current) => ({
                    ...current,
                    oneTimePurchase: event.target.value,
                  }))
                }
              />
            </div>
            <input
              type="number"
              step="0.01"
              placeholder="Investment contribution change / month"
              value={scenarioForm.investmentContributionChange}
              onChange={(event) =>
                setScenarioForm((current) => ({
                  ...current,
                  investmentContributionChange: event.target.value,
                }))
              }
            />
            <button type="submit">Save scenario</button>
          </form>

          {activeScenario ? (
            <>
              <div className="status-strip estimate-strip">
                <div>
                  <span>Active scenario</span>
                  <strong>{activeScenario.title}</strong>
                </div>
                <div>
                  <span>6-month cash impact</span>
                  <strong
                    className={
                      (scenarioImpact?.sixMonthCash.delta ?? 0) >= 0
                        ? 'positive-text'
                        : 'negative-text'
                    }
                  >
                    {(scenarioImpact?.sixMonthCash.delta ?? 0) >= 0 ? '+' : '-'}
                    {currency.format(Math.abs(scenarioImpact?.sixMonthCash.delta ?? 0))}
                  </strong>
                </div>
              </div>
              <div className="scenario-comparison-list">
                {comparisonRows.map(([label, comparison]) => (
                  <div className="scenario-row" key={label}>
                    <div>
                      <span>{label}</span>
                      <strong>{currency.format(comparison.baseline)}</strong>
                    </div>
                    <div>
                      <span>Scenario</span>
                      <strong>{currency.format(comparison.scenario)}</strong>
                    </div>
                    <div>
                      <span>Change</span>
                      <strong
                        className={
                          comparison.delta >= 0 ? 'positive-text' : 'negative-text'
                        }
                      >
                        {comparison.delta >= 0 ? '+' : '-'}
                        {currency.format(Math.abs(comparison.delta))}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-copy">
              Add a scenario to compare your current baseline against a possible
              income, rent, benefit, debt, purchase, or investing change.
            </p>
          )}

          <div className="modal-list compact-list">
            {scenarioPlans.map((scenario) => (
              <div className="modal-list-row" key={scenario.id}>
                <div>
                  <strong>{scenario.title}</strong>
                  <p>
                    Income {scenario.incomeChangePercent}% • Rent{' '}
                    {currency.format(scenario.rentChange)} • Extra debt{' '}
                    {currency.format(scenario.extraDebtPayment)}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() =>
                    setScenarioPlans((current) =>
                      current.filter((entry) => entry.id !== scenario.id),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )
    }

    return null
}
