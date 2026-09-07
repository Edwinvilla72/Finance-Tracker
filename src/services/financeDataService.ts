import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BenefitElection,
  DebtPlan,
  IncomeSource,
  InvestmentAccount,
  NetWorthItem,
  PaycheckRule,
  PersistedState,
  PurchaseGoal,
  RecurringTransaction,
  RetirementContribution,
  ScenarioPlan,
  ScheduledTransaction,
} from '../types/finance'
import { normalizePersistedState } from './dashboardStateService'

// Persistence for signed-in Supabase sessions. Each kind of data has its own
// table; the dashboard keeps working with one PersistedState object, and this
// module translates between the two:
//
//   loadFinanceState  - reads every table for the user into a PersistedState
//   diffFinanceState  - compares the last synced state with the current one
//   applyFinanceSyncPlan - writes only the rows that changed
//
// Ids are uuids generated in the browser (see utils/ids.ts), so an item keeps
// the same primary key from the moment it is created.

type Row = Record<string, unknown>

export type ListTable =
  | 'scheduled_transactions'
  | 'recurring_transactions'
  | 'paycheck_rules'
  | 'debt_plans'
  | 'purchase_goals'
  | 'income_sources'
  | 'benefit_elections'
  | 'retirement_contributions'
  | 'investment_accounts'
  | 'net_worth_items'
  | 'scenario_plans'

export type ListSync = {
  table: ListTable
  upserts: Row[]
  deleteIds: string[]
}

export type FinanceSyncPlan = {
  settings: Row | null
  emergencyFund: Row | null
  financialProfile: Row | null
  lists: ListSync[]
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function balanceInputFromNumber(value: unknown) {
  const parsed = toNumber(value)
  return parsed === 0 ? '' : String(parsed)
}

function numberFromBalanceInput(value: string) {
  return value.trim() === '' ? 0 : toNumber(value)
}

// ---------------------------------------------------------------------------
// Row <-> model mapping
// ---------------------------------------------------------------------------

const scheduledColumns = 'id, title, amount, transaction_date, transaction_type, category'
const recurringColumns =
  'id, title, amount, frequency, day_of_month, weekdays, transaction_type, category, start_date, end_date'
const paycheckColumns = 'id, title, amount, frequency, day_of_month, weekday, start_date'
const debtColumns =
  'id, title, balance, minimum_due, due_date, payoff_date, payoff_cadence, payoff_mode, payoff_value, apr, extra_payment'
const goalColumns = 'id, title, cost, target_date, savings_cadence'
const incomeColumns = 'id, name, income_type, amount, hours_per_week, pay_frequency'
const benefitColumns = 'id, name, benefit_type, amount_per_paycheck, tax_treatment'
const retirementColumns =
  'id, account_type, contribution_mode, contribution_value, employer_match_percent, employer_match_limit_percent'
const investmentColumns = 'id, title, account_type, balance, monthly_contribution, annual_return_rate'
const netWorthColumns = 'id, title, balance, kind, category'
const scenarioColumns =
  'id, title, income_change_percent, rent_change, benefit_change_per_paycheck, retirement_contribution_change_percent, extra_debt_payment, one_time_purchase, investment_contribution_change, position'
const settingsColumns =
  'current_balance, bank_balance_source, target_amount, target_date, state_tax_rate_percent, projection_months, setup_guide_dismissed'
const emergencyColumns = 'current_savings, monthly_essential_expenses, target_months'
const profileColumns = 'state, filing_status'

const fromScheduled = (row: Row): ScheduledTransaction => ({
  id: String(row.id),
  title: String(row.title),
  amount: toNumber(row.amount),
  date: String(row.transaction_date),
  type: row.transaction_type as ScheduledTransaction['type'],
  category: toOptionalString(row.category),
})

const toScheduled = (item: ScheduledTransaction, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  title: item.title,
  amount: item.amount,
  transaction_date: item.date,
  transaction_type: item.type,
  category: item.category ?? null,
})

const fromRecurring = (row: Row): RecurringTransaction => ({
  id: String(row.id),
  title: String(row.title),
  amount: toNumber(row.amount),
  frequency: row.frequency as RecurringTransaction['frequency'],
  dayOfMonth: toOptionalNumber(row.day_of_month),
  weekdays: Array.isArray(row.weekdays) ? row.weekdays.map((day) => toNumber(day)) : undefined,
  type: row.transaction_type as RecurringTransaction['type'],
  category: toOptionalString(row.category),
  startDate: toOptionalString(row.start_date),
  endDate: toOptionalString(row.end_date),
})

const toRecurring = (item: RecurringTransaction, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  title: item.title,
  amount: item.amount,
  frequency: item.frequency,
  day_of_month: item.dayOfMonth ?? null,
  weekdays: item.weekdays ?? null,
  transaction_type: item.type,
  category: item.category ?? null,
  start_date: item.startDate || null,
  end_date: item.endDate || null,
})

const fromPaycheck = (row: Row): PaycheckRule => ({
  id: String(row.id),
  title: String(row.title),
  amount: toNumber(row.amount),
  frequency: row.frequency as PaycheckRule['frequency'],
  dayOfMonth: toOptionalNumber(row.day_of_month),
  weekday: toOptionalNumber(row.weekday),
  startDate: toOptionalString(row.start_date),
})

const toPaycheck = (item: PaycheckRule, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  title: item.title,
  amount: item.amount,
  frequency: item.frequency,
  day_of_month: item.dayOfMonth ?? null,
  weekday: item.weekday ?? null,
  start_date: item.startDate || null,
})

const fromDebt = (row: Row): DebtPlan => ({
  id: String(row.id),
  title: String(row.title),
  balance: toNumber(row.balance),
  minimumDue: toNumber(row.minimum_due),
  dueDate: String(row.due_date),
  payoffDate: toOptionalString(row.payoff_date) ?? '',
  apr: toOptionalNumber(row.apr),
  extraPayment: toOptionalNumber(row.extra_payment),
  payoffCadence: toOptionalString(row.payoff_cadence) as DebtPlan['payoffCadence'],
  payoffMode: toOptionalString(row.payoff_mode) as DebtPlan['payoffMode'],
  payoffValue: toOptionalNumber(row.payoff_value),
})

const toDebt = (item: DebtPlan, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  title: item.title,
  balance: item.balance,
  minimum_due: item.minimumDue,
  due_date: item.dueDate,
  payoff_date: item.payoffDate || null,
  payoff_cadence: item.payoffCadence ?? null,
  payoff_mode: item.payoffMode ?? null,
  payoff_value: item.payoffValue ?? null,
  apr: item.apr ?? null,
  extra_payment: item.extraPayment ?? null,
})

const fromGoal = (row: Row): PurchaseGoal => ({
  id: String(row.id),
  title: String(row.title),
  cost: toNumber(row.cost),
  targetDate: String(row.target_date),
  savingsCadence: toOptionalString(row.savings_cadence) as PurchaseGoal['savingsCadence'],
})

const toGoal = (item: PurchaseGoal, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  title: item.title,
  cost: item.cost,
  target_date: item.targetDate,
  savings_cadence: item.savingsCadence ?? 'monthly',
})

const fromIncome = (row: Row): IncomeSource => ({
  id: String(row.id),
  name: String(row.name),
  type: row.income_type as IncomeSource['type'],
  amount: toNumber(row.amount),
  hoursPerWeek: toOptionalNumber(row.hours_per_week),
  payFrequency: row.pay_frequency as IncomeSource['payFrequency'],
})

const toIncome = (item: IncomeSource, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  name: item.name,
  income_type: item.type,
  amount: item.amount,
  hours_per_week: item.hoursPerWeek ?? null,
  pay_frequency: item.payFrequency,
})

const fromBenefit = (row: Row): BenefitElection => ({
  id: String(row.id),
  name: String(row.name),
  type: row.benefit_type as BenefitElection['type'],
  amountPerPaycheck: toNumber(row.amount_per_paycheck),
  taxTreatment: row.tax_treatment as BenefitElection['taxTreatment'],
})

const toBenefit = (item: BenefitElection, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  name: item.name,
  benefit_type: item.type,
  amount_per_paycheck: item.amountPerPaycheck,
  tax_treatment: item.taxTreatment,
})

const fromRetirement = (row: Row): RetirementContribution => ({
  id: String(row.id),
  accountType: row.account_type as RetirementContribution['accountType'],
  contributionMode: row.contribution_mode as RetirementContribution['contributionMode'],
  contributionValue: toNumber(row.contribution_value),
  employerMatchPercent: toOptionalNumber(row.employer_match_percent),
  employerMatchLimitPercent: toOptionalNumber(row.employer_match_limit_percent),
})

const toRetirement = (item: RetirementContribution, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  account_type: item.accountType,
  contribution_mode: item.contributionMode,
  contribution_value: item.contributionValue,
  employer_match_percent: item.employerMatchPercent ?? null,
  employer_match_limit_percent: item.employerMatchLimitPercent ?? null,
})

const fromInvestment = (row: Row): InvestmentAccount => ({
  id: String(row.id),
  title: String(row.title),
  accountType: row.account_type as InvestmentAccount['accountType'],
  balance: toNumber(row.balance),
  monthlyContribution: toNumber(row.monthly_contribution),
  annualReturnRate: toNumber(row.annual_return_rate),
})

const toInvestment = (item: InvestmentAccount, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  title: item.title,
  account_type: item.accountType,
  balance: item.balance,
  monthly_contribution: item.monthlyContribution,
  annual_return_rate: item.annualReturnRate,
})

const fromNetWorth = (row: Row): NetWorthItem => ({
  id: String(row.id),
  title: String(row.title),
  balance: toNumber(row.balance),
  kind: row.kind as NetWorthItem['kind'],
  category: row.category as NetWorthItem['category'],
})

const toNetWorth = (item: NetWorthItem, userId: string): Row => ({
  id: item.id,
  user_id: userId,
  title: item.title,
  balance: item.balance,
  kind: item.kind,
  category: item.category,
})

const fromScenario = (row: Row): ScenarioPlan => ({
  id: String(row.id),
  title: String(row.title),
  incomeChangePercent: toNumber(row.income_change_percent),
  rentChange: toNumber(row.rent_change),
  benefitChangePerPaycheck: toNumber(row.benefit_change_per_paycheck),
  retirementContributionChangePercent: toNumber(row.retirement_contribution_change_percent),
  extraDebtPayment: toNumber(row.extra_debt_payment),
  oneTimePurchase: toNumber(row.one_time_purchase),
  investmentContributionChange: toNumber(row.investment_contribution_change),
})

// Array order is meaningful for scenarios (index 0 is active), so the position
// is stored with each row.
const toScenario = (item: ScenarioPlan, userId: string, position: number): Row => ({
  id: item.id,
  user_id: userId,
  title: item.title,
  income_change_percent: item.incomeChangePercent,
  rent_change: item.rentChange,
  benefit_change_per_paycheck: item.benefitChangePerPaycheck,
  retirement_contribution_change_percent: item.retirementContributionChangePercent,
  extra_debt_payment: item.extraDebtPayment,
  one_time_purchase: item.oneTimePurchase,
  investment_contribution_change: item.investmentContributionChange,
  position,
})

function toSettingsRow(state: PersistedState, userId: string): Row {
  return {
    user_id: userId,
    current_balance: numberFromBalanceInput(state.currentBalanceInput),
    bank_balance_source: state.bankBalanceSource,
    target_amount: toNumber(state.financePlan.targetAmount),
    target_date: state.financePlan.targetDate || null,
    state_tax_rate_percent: state.assumptions.stateTaxRatePercent,
    projection_months: state.assumptions.projectionMonths,
    setup_guide_dismissed: state.setupGuideDismissed,
  }
}

function toEmergencyFundRow(state: PersistedState, userId: string): Row {
  return {
    user_id: userId,
    current_savings: state.emergencyFundPlan.currentSavings,
    monthly_essential_expenses: state.emergencyFundPlan.monthlyEssentialExpenses,
    target_months: state.emergencyFundPlan.targetMonths,
  }
}

function toFinancialProfileRow(state: PersistedState, userId: string): Row {
  return {
    user_id: userId,
    state: state.financialProfile.state,
    filing_status: state.financialProfile.filingStatus,
  }
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export async function loadFinanceState(
  client: SupabaseClient,
  userId: string,
): Promise<PersistedState> {
  const byUser = (table: string, columns: string, order: string) =>
    client.from(table).select(columns).eq('user_id', userId).order(order)

  const [
    settings,
    emergency,
    profile,
    scheduled,
    recurring,
    paychecks,
    debts,
    goals,
    incomes,
    benefits,
    retirement,
    investments,
    netWorth,
    scenarios,
  ] = await Promise.all([
    client.from('finance_settings').select(settingsColumns).eq('user_id', userId).maybeSingle(),
    client.from('emergency_fund_plans').select(emergencyColumns).eq('user_id', userId).maybeSingle(),
    client.from('financial_profiles').select(profileColumns).eq('user_id', userId).maybeSingle(),
    byUser('scheduled_transactions', scheduledColumns, 'created_at'),
    byUser('recurring_transactions', recurringColumns, 'created_at'),
    byUser('paycheck_rules', paycheckColumns, 'created_at'),
    byUser('debt_plans', debtColumns, 'created_at'),
    byUser('purchase_goals', goalColumns, 'created_at'),
    byUser('income_sources', incomeColumns, 'created_at'),
    byUser('benefit_elections', benefitColumns, 'created_at'),
    byUser('retirement_contributions', retirementColumns, 'created_at'),
    byUser('investment_accounts', investmentColumns, 'created_at'),
    byUser('net_worth_items', netWorthColumns, 'created_at'),
    byUser('scenario_plans', scenarioColumns, 'position'),
  ])

  for (const result of [
    settings,
    emergency,
    profile,
    scheduled,
    recurring,
    paychecks,
    debts,
    goals,
    incomes,
    benefits,
    retirement,
    investments,
    netWorth,
    scenarios,
  ]) {
    if (result.error) {
      throw result.error
    }
  }

  const settingsRow = (settings.data ?? null) as Row | null
  const emergencyRow = (emergency.data ?? null) as Row | null
  const profileRow = (profile.data ?? null) as Row | null
  const rows = (result: { data: unknown }) => (result.data ?? []) as Row[]

  return normalizePersistedState({
    currentBalanceInput: settingsRow ? balanceInputFromNumber(settingsRow.current_balance) : '',
    bankBalanceSource:
      settingsRow?.bank_balance_source === 'linked' ? 'linked' : 'manual',
    scheduledTransactions: rows(scheduled).map(fromScheduled),
    recurringTransactions: rows(recurring).map(fromRecurring),
    paycheckRules: rows(paychecks).map(fromPaycheck),
    debtPlans: rows(debts).map(fromDebt),
    financePlan: {
      targetAmount: settingsRow ? toNumber(settingsRow.target_amount) : 0,
      targetDate: settingsRow ? toOptionalString(settingsRow.target_date) ?? '' : '',
    },
    purchaseGoals: rows(goals).map(fromGoal),
    financialProfile: {
      state: profileRow ? String(profileRow.state) : 'FL',
      filingStatus: profileRow
        ? (String(profileRow.filing_status) as PersistedState['financialProfile']['filingStatus'])
        : 'single',
      incomeSources: rows(incomes).map(fromIncome),
      benefitElections: rows(benefits).map(fromBenefit),
      retirementContributions: rows(retirement).map(fromRetirement),
    },
    emergencyFundPlan: {
      currentSavings: emergencyRow ? toNumber(emergencyRow.current_savings) : 0,
      monthlyEssentialExpenses: emergencyRow
        ? toNumber(emergencyRow.monthly_essential_expenses)
        : 0,
      targetMonths: emergencyRow ? toNumber(emergencyRow.target_months, 3) : 3,
    },
    investmentAccounts: rows(investments).map(fromInvestment),
    netWorthItems: rows(netWorth).map(fromNetWorth),
    scenarioPlans: rows(scenarios).map(fromScenario),
    assumptions: {
      stateTaxRatePercent: settingsRow ? toNumber(settingsRow.state_tax_rate_percent, 4) : 4,
      projectionMonths: settingsRow ? toNumber(settingsRow.projection_months, 6) : 6,
    },
    setupGuideDismissed: settingsRow ? Boolean(settingsRow.setup_guide_dismissed) : false,
  })
}

// ---------------------------------------------------------------------------
// Diff + apply
// ---------------------------------------------------------------------------

function sameRow(left: Row, right: Row) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function diffList<T extends { id: string }>(
  table: ListTable,
  previous: T[],
  next: T[],
  toRow: (item: T, index: number) => Row,
): ListSync {
  const previousRows = new Map(previous.map((item, index) => [item.id, toRow(item, index)]))
  const nextIds = new Set(next.map((item) => item.id))
  const upserts: Row[] = []

  next.forEach((item, index) => {
    const row = toRow(item, index)
    const before = previousRows.get(item.id)

    if (!before || !sameRow(before, row)) {
      upserts.push(row)
    }
  })

  const deleteIds = previous.filter((item) => !nextIds.has(item.id)).map((item) => item.id)

  return { table, upserts, deleteIds }
}

export function diffFinanceState(
  userId: string,
  previous: PersistedState | null,
  next: PersistedState,
): FinanceSyncPlan {
  const singleton = (build: (state: PersistedState, user: string) => Row) => {
    const nextRow = build(next, userId)

    return previous && sameRow(build(previous, userId), nextRow) ? null : nextRow
  }

  const prevProfile = previous?.financialProfile

  const lists: ListSync[] = [
    diffList('scheduled_transactions', previous?.scheduledTransactions ?? [], next.scheduledTransactions, (item) => toScheduled(item, userId)),
    diffList('recurring_transactions', previous?.recurringTransactions ?? [], next.recurringTransactions, (item) => toRecurring(item, userId)),
    diffList('paycheck_rules', previous?.paycheckRules ?? [], next.paycheckRules, (item) => toPaycheck(item, userId)),
    diffList('debt_plans', previous?.debtPlans ?? [], next.debtPlans, (item) => toDebt(item, userId)),
    diffList('purchase_goals', previous?.purchaseGoals ?? [], next.purchaseGoals, (item) => toGoal(item, userId)),
    diffList('income_sources', prevProfile?.incomeSources ?? [], next.financialProfile.incomeSources, (item) => toIncome(item, userId)),
    diffList('benefit_elections', prevProfile?.benefitElections ?? [], next.financialProfile.benefitElections, (item) => toBenefit(item, userId)),
    diffList('retirement_contributions', prevProfile?.retirementContributions ?? [], next.financialProfile.retirementContributions, (item) => toRetirement(item, userId)),
    diffList('investment_accounts', previous?.investmentAccounts ?? [], next.investmentAccounts, (item) => toInvestment(item, userId)),
    diffList('net_worth_items', previous?.netWorthItems ?? [], next.netWorthItems, (item) => toNetWorth(item, userId)),
    diffList('scenario_plans', previous?.scenarioPlans ?? [], next.scenarioPlans, (item, index) => toScenario(item, userId, index)),
  ].filter((sync) => sync.upserts.length > 0 || sync.deleteIds.length > 0)

  return {
    settings: singleton(toSettingsRow),
    emergencyFund: singleton(toEmergencyFundRow),
    financialProfile: singleton(toFinancialProfileRow),
    lists,
  }
}

export function isEmptySyncPlan(plan: FinanceSyncPlan) {
  return (
    plan.settings === null &&
    plan.emergencyFund === null &&
    plan.financialProfile === null &&
    plan.lists.length === 0
  )
}

export async function applyFinanceSyncPlan(
  client: SupabaseClient,
  userId: string,
  plan: FinanceSyncPlan,
) {
  const requests: PromiseLike<{ error: { message: string } | null }>[] = []

  if (plan.settings) {
    requests.push(client.from('finance_settings').upsert(plan.settings, { onConflict: 'user_id' }))
  }

  if (plan.emergencyFund) {
    requests.push(
      client.from('emergency_fund_plans').upsert(plan.emergencyFund, { onConflict: 'user_id' }),
    )
  }

  if (plan.financialProfile) {
    requests.push(
      client.from('financial_profiles').upsert(plan.financialProfile, { onConflict: 'user_id' }),
    )
  }

  for (const sync of plan.lists) {
    if (sync.upserts.length > 0) {
      requests.push(client.from(sync.table).upsert(sync.upserts, { onConflict: 'id' }))
    }

    if (sync.deleteIds.length > 0) {
      requests.push(
        client.from(sync.table).delete().eq('user_id', userId).in('id', sync.deleteIds),
      )
    }
  }

  const results = await Promise.all(requests)
  const failure = results.find((result) => result.error)

  if (failure?.error) {
    throw new Error(failure.error.message)
  }
}

export async function syncFinanceState(
  client: SupabaseClient,
  userId: string,
  previous: PersistedState | null,
  next: PersistedState,
) {
  const plan = diffFinanceState(userId, previous, next)

  if (isEmptySyncPlan(plan)) {
    return false
  }

  await applyFinanceSyncPlan(client, userId, plan)
  return true
}
