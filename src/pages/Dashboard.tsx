import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildCalendarOccurrences,
  getCalendarDays,
  projectBalance,
} from '../calculations/cashFlow'
import {
  getPaymentCount,
  getRecommendedPayment,
} from '../calculations/debtPayoff'
import { calculateEmergencyFundProgress } from '../calculations/emergencyFund'
import { projectInvestmentGrowth } from '../calculations/investments'
import { calculateNetWorth } from '../calculations/netWorth'
import { estimatePaycheck } from '../calculations/paycheck'
import { projectBalanceMonths } from '../calculations/projections'
import { projectScenarioImpact } from '../calculations/scenarios'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  loadBankSnapshot,
  loadPlaidLinkScript,
  syncBankSnapshot,
} from '../services/bankSyncService'
import { CalendarPanel } from './dashboard/CalendarPanel'
import { DashboardHeader } from './dashboard/DashboardHeader'
import { DashboardModalContent } from './dashboard/DashboardModalContent'
import { buildGoalItems, summarizeGoalItems, type GoalItemKind } from './dashboard/goalItems'
import { CashFlowPage } from './dashboard/pages/CashFlowPage'
import { GoalsPage } from './dashboard/pages/GoalsPage'
import { HomePage } from './dashboard/pages/HomePage'
import { InsightsPage } from './dashboard/pages/InsightsPage'
import { ScenariosPage } from './dashboard/pages/ScenariosPage'
import { type ModalView, type PageView } from './dashboard/dashboardTypes'
import {
  clearPersistedState,
  DASHBOARD_STATE_TABLE,
  getDefaultPersistedState,
  loadPersistedState,
  mergePersistedStates,
  normalizePersistedState,
  savePersistedState,
} from '../services/dashboardStateService'
import type {
  BankBalanceSource,
  LinkedBankAccount,
  LinkedBankTransaction,
} from '../types/banking'
import type {
  CalendarOccurrence,
  DebtPlan,
  BenefitElection,
  FinancePlan,
  FinancialProfile,
  EmergencyFundPlan,
  InvestmentAccount,
  NetWorthItem,
  PaycheckRule,
  PersistedState,
  PurchaseGoal,
  RecurringTransaction,
  RetirementContribution,
  ScenarioPlan,
  ScheduledTransaction,
  TransactionType,
} from '../types/finance'
import {
  endOfMonth,
  formatDateKey,
  parseDateKey,
  startOfMonth,
} from '../utils/dates'
import { currency } from '../utils/currency'

type DashboardProps = {
  userId?: string
  userEmail?: string
  appMode?: 'local' | 'supabase'
  onModeChange?: (mode: 'local' | 'supabase') => void
  onSignOut?: () => Promise<void> | void
}

type DamageSequencePhase = 'approach' | 'impact' | 'resolve'

type DamageSequence = {
  id: number
  amount: number
  nextBalance: number
  phase: DamageSequencePhase
  previousBalance: number
  title: string
}

function Dashboard({ userId, userEmail, appMode, onModeChange, onSignOut }: DashboardProps) {
  const today = useMemo(() => new Date(), [])
  const todayKey = formatDateKey(today)
  const todayWeekday = String(today.getDay())
  const defaultState = useMemo(() => getDefaultPersistedState(), [])

  const [navOpen, setNavOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalView>(null)
  const [activePage, setActivePage] = useState<PageView>('dashboard')
  const [syncReady, setSyncReady] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today))
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)
  const [currentBalanceInput, setCurrentBalanceInput] = useState(
    defaultState.currentBalanceInput,
  )
  const [bankBalanceSource, setBankBalanceSource] = useState<BankBalanceSource>(
    defaultState.bankBalanceSource,
  )
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedBankAccount[]>([])
  const [linkedTransactions, setLinkedTransactions] = useState<LinkedBankTransaction[]>([])
  const [bankSyncError, setBankSyncError] = useState<string | null>(null)
  const [isConnectingBank, setIsConnectingBank] = useState(false)
  const [isSyncingBank, setIsSyncingBank] = useState(false)
  const [balanceDraft, setBalanceDraft] = useState(
    defaultState.currentBalanceInput,
  )
  const [scheduledTransactions, setScheduledTransactions] = useState<
    ScheduledTransaction[]
  >(defaultState.scheduledTransactions)
  const [recurringTransactions, setRecurringTransactions] = useState<
    RecurringTransaction[]
  >(defaultState.recurringTransactions)
  const [paycheckRules, setPaycheckRules] = useState<PaycheckRule[]>(
    defaultState.paycheckRules,
  )
  const [debtPlans, setDebtPlans] = useState<DebtPlan[]>(defaultState.debtPlans)
  const [financePlan, setFinancePlan] = useState<FinancePlan>(
    defaultState.financePlan,
  )
  const [purchaseGoals, setPurchaseGoals] = useState<PurchaseGoal[]>(
    defaultState.purchaseGoals,
  )
  const [financialProfile, setFinancialProfile] = useState<FinancialProfile>(
    defaultState.financialProfile,
  )
  const [emergencyFundPlan, setEmergencyFundPlan] = useState<EmergencyFundPlan>(
    defaultState.emergencyFundPlan,
  )
  const [investmentAccounts, setInvestmentAccounts] = useState<InvestmentAccount[]>(
    defaultState.investmentAccounts,
  )
  const [netWorthItems, setNetWorthItems] = useState<NetWorthItem[]>(
    defaultState.netWorthItems,
  )
  const [scenarioPlans, setScenarioPlans] = useState<ScenarioPlan[]>(
    defaultState.scenarioPlans,
  )
  const [dayForm, setDayForm] = useState({
    title: '',
    amount: '',
    type: 'expense' as TransactionType,
  })
  const [oneTimeForm, setOneTimeForm] = useState({
    title: '',
    amount: '',
    date: todayKey,
    type: 'expense' as TransactionType,
    category: 'Groceries',
  })
  const [recurringForm, setRecurringForm] = useState({
    title: '',
    amount: '',
    frequency: 'monthly' as 'monthly' | 'weekly',
    dayOfMonth: '',
    weekdays: [] as number[],
    type: 'expense' as Exclude<TransactionType, 'income'>,
    startDate: todayKey,
    endDate: '',
  })
  const [essentialExpenseForm, setEssentialExpenseForm] = useState({
    rent: '',
    rentDueDay: '1',
    utilities: '',
    water: '',
    electricity: '',
    phone: '',
    internet: '',
    insurance: '',
    subscriptions: '',
    groceries: '',
    transportation: '',
    dueDay: '1',
  })
  const [paycheckForm, setPaycheckForm] = useState({
    title: 'Paycheck',
    amount: '',
    frequency: 'monthly' as PaycheckRule['frequency'],
    dayOfMonth: '',
    weekday: todayWeekday,
    startDate: todayKey,
  })
  const [estimatedPaycheckDate, setEstimatedPaycheckDate] = useState(todayKey)
  const [incomeModelForm, setIncomeModelForm] = useState({
    name: 'Primary income',
    type: 'salary' as FinancialProfile['incomeSources'][number]['type'],
    amount: '',
    hoursPerWeek: '40',
    payFrequency: 'biweekly' as FinancialProfile['incomeSources'][number]['payFrequency'],
    state: defaultState.financialProfile.state,
    filingStatus: defaultState.financialProfile.filingStatus,
  })
  const [benefitForm, setBenefitForm] = useState({
    name: 'Health insurance',
    type: 'health' as BenefitElection['type'],
    amountPerPaycheck: '',
    taxTreatment: 'pre_tax' as BenefitElection['taxTreatment'],
  })
  const [retirementForm, setRetirementForm] = useState({
    accountType: 'traditional_401k' as RetirementContribution['accountType'],
    contributionMode: 'percent' as RetirementContribution['contributionMode'],
    contributionValue: '',
    employerMatchPercent: '',
    employerMatchLimitPercent: '',
  })
  const [debtForm, setDebtForm] = useState({
    title: '',
    balance: '',
    minimumDue: '',
    dueDate: '',
    payoffDate: '',
    payoffCadence: 'monthly' as 'weekly' | 'biweekly' | 'monthly',
    payoffMode: 'amount' as 'amount' | 'percent',
    payoffValue: '',
    apr: '',
    extraPayment: '',
  })
  const [emergencyFundForm, setEmergencyFundForm] = useState({
    currentSavings: '',
    monthlyEssentialExpenses: '',
    targetMonths: '3',
  })
  const [investmentForm, setInvestmentForm] = useState({
    title: '',
    accountType: 'brokerage' as InvestmentAccount['accountType'],
    balance: '',
    monthlyContribution: '',
    annualReturnRate: '7',
  })
  const [netWorthForm, setNetWorthForm] = useState({
    title: '',
    balance: '',
    kind: 'asset' as NetWorthItem['kind'],
    category: 'cash' as NetWorthItem['category'],
  })
  const [scenarioForm, setScenarioForm] = useState({
    title: 'What if scenario',
    incomeChangePercent: '',
    rentChange: '',
    benefitChangePerPaycheck: '',
    retirementContributionChangePercent: '',
    extraDebtPayment: '',
    oneTimePurchase: '',
    investmentContributionChange: '',
  })
  const [purchaseGoalForm, setPurchaseGoalForm] = useState({
    title: '',
    cost: '',
    targetDate: '',
    savingsCadence: 'monthly' as 'weekly' | 'biweekly' | 'monthly',
  })
  const [damageSequence, setDamageSequence] = useState<DamageSequence | null>(null)
  const damageTimeoutsRef = useRef<number[]>([])

  const allOccurrences = useMemo(
    () =>
      buildCalendarOccurrences({
        currentMonth,
        today,
        scheduledTransactions,
        recurringTransactions,
        paycheckRules,
        debtPlans,
        financePlan,
      }),
    [
      currentMonth,
      debtPlans,
      financePlan,
      paycheckRules,
      recurringTransactions,
      scheduledTransactions,
      today,
    ],
  )

  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth])
  const selectedDayTransactions = allOccurrences.filter(
    (transaction) => transaction.date === selectedDateKey,
  )
  const linkedCashBalance = linkedAccounts
    .filter((account) => account.type === 'depository')
    .reduce((sum, account) => sum + account.currentBalance, 0)
  const usingLinkedBalance = bankBalanceSource === 'linked' && linkedAccounts.length > 0
  const currentBalance = usingLinkedBalance
    ? linkedCashBalance
    : currentBalanceInput.trim() === ''
      ? 0
      : Number(currentBalanceInput)
  const projectedBalance = (targetDateKey: string) =>
    projectBalance(currentBalance, allOccurrences, todayKey, targetDateKey)
  const currentAvailableBalance = projectedBalance(todayKey)
  const selectedDayBalance = projectedBalance(selectedDateKey)
  const totalDebt = debtPlans.reduce((sum, debt) => sum + debt.balance, 0)
  const totalInvestmentBalance = investmentAccounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  )
  const projectedMonthEndBalance = projectedBalance(
    formatDateKey(endOfMonth(currentMonth)),
  )
  const planProjection = financePlan.targetDate
    ? projectedBalance(financePlan.targetDate)
    : currentAvailableBalance
  const planGap = financePlan.targetDate
    ? financePlan.targetAmount - planProjection
    : 0
  const upcomingTransactions = allOccurrences
    .filter((transaction) => transaction.date >= todayKey)
    .slice(0, 8)
  const debtPlanCount = debtForm.payoffDate
    ? getPaymentCount(today, debtForm.payoffDate, debtForm.payoffCadence)
    : 0
  const debtRecommendedPayment =
    debtForm.payoffDate && debtForm.balance
      ? getRecommendedPayment(
        Number(debtForm.balance),
        debtForm.payoffDate,
        debtForm.payoffCadence,
        today,
      )
      : 0
  const debtCustomPayment =
    debtForm.payoffDate && debtForm.balance && debtForm.payoffValue
      ? debtForm.payoffMode === 'amount'
        ? Number(debtForm.payoffValue)
        : Number(debtForm.balance) * (Number(debtForm.payoffValue) / 100)
      : 0
  const debtProjectedRemaining =
    debtForm.payoffDate && debtForm.balance && debtForm.payoffValue
      ? Number(debtForm.balance) - debtCustomPayment * debtPlanCount
      : 0
  const monthStartKey = formatDateKey(startOfMonth(currentMonth))
  const monthEndKey = formatDateKey(endOfMonth(currentMonth))
  const currentMonthOccurrences = allOccurrences.filter(
    (transaction) => transaction.date >= monthStartKey && transaction.date <= monthEndKey,
  )
  const monthlyIncome = currentMonthOccurrences
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const monthlyOutflow = currentMonthOccurrences
    .filter((transaction) => transaction.type !== 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const essentialMonthlyOutflow = currentMonthOccurrences
    .filter(
      (transaction) =>
        transaction.category === 'Essentials' || transaction.category === 'Housing',
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const monthlyNet = monthlyIncome - monthlyOutflow
  const nextPaycheck = allOccurrences.find(
    (transaction) => transaction.date >= todayKey && transaction.type === 'income',
  )
  const primaryIncome = financialProfile.incomeSources[0]
  const paycheckEstimate = primaryIncome
    ? estimatePaycheck({
      income: primaryIncome,
      state: financialProfile.state,
      filingStatus: financialProfile.filingStatus,
      benefitElections: financialProfile.benefitElections,
      retirementContributions: financialProfile.retirementContributions,
    })
    : null
  const totalBenefitsPerPaycheck = financialProfile.benefitElections.reduce(
    (sum, benefit) => sum + benefit.amountPerPaycheck,
    0,
  )
  const totalRetirementPerPaycheck =
    paycheckEstimate?.retirementContributionPerPaycheck ?? 0
  const sixMonthProjection = projectedBalance(
    formatDateKey(new Date(today.getFullYear(), today.getMonth() + 6, today.getDate())),
  )
  const emergencyFundProgress = calculateEmergencyFundProgress(
    emergencyFundPlan.currentSavings,
    emergencyFundPlan.monthlyEssentialExpenses || essentialMonthlyOutflow,
    emergencyFundPlan.targetMonths || 3,
  )
  const fiveYearInvestmentProjection = investmentAccounts.reduce((sum, account) => {
    const projection = projectInvestmentGrowth({
      startingBalance: account.balance,
      monthlyContribution: account.monthlyContribution,
      annualReturnRate: account.annualReturnRate,
      years: 5,
    })
    const finalPoint = projection[projection.length - 1]

    return sum + (finalPoint?.balance ?? account.balance)
  }, 0)
  const netWorthSummary = calculateNetWorth(
    [
      { id: -1, name: 'Current cash', balance: currentAvailableBalance },
      ...investmentAccounts.map((account) => ({
        id: account.id,
        name: account.title,
        balance: account.balance,
      })),
      ...netWorthItems
        .filter((item) => item.kind === 'asset')
        .map((item) => ({
          id: item.id,
          name: item.title,
          balance: item.balance,
        })),
    ],
    [
      ...debtPlans.map((debt) => ({
        id: debt.id,
        name: debt.title,
        balance: debt.balance,
      })),
      ...netWorthItems
        .filter((item) => item.kind === 'liability')
        .map((item) => ({
          id: item.id,
          name: item.title,
          balance: item.balance,
        })),
    ],
  )
  const activeScenario = scenarioPlans[0]
  const paychecksPerMonth = primaryIncome
    ? primaryIncome.payFrequency === 'weekly'
      ? 52 / 12
      : primaryIncome.payFrequency === 'biweekly'
        ? 26 / 12
        : primaryIncome.payFrequency === 'semimonthly'
          ? 2
          : 1
    : 2
  const scenarioImpact = activeScenario
    ? projectScenarioImpact({
      monthlyNet,
      sixMonthCash: sixMonthProjection,
      netPaycheck: paycheckEstimate?.estimatedNetPaycheck ?? nextPaycheck?.amount ?? 0,
      netWorth: netWorthSummary.netWorth,
      totalDebt,
      investmentFiveYearValue: fiveYearInvestmentProjection,
      incomeChangePercent: activeScenario.incomeChangePercent,
      rentChange: activeScenario.rentChange,
      benefitChangePerPaycheck: activeScenario.benefitChangePerPaycheck,
      retirementContributionChangePercent:
        activeScenario.retirementContributionChangePercent,
      extraDebtPayment: activeScenario.extraDebtPayment,
      oneTimePurchase: activeScenario.oneTimePurchase,
      investmentContributionChange: activeScenario.investmentContributionChange,
      paychecksPerMonth,
    })
    : null
  const monthlyProjection = projectBalanceMonths(
    currentBalance,
    allOccurrences,
    today,
    6,
  )
  const spendingByCategory = currentMonthOccurrences
    .filter((transaction) => transaction.type !== 'income')
    .reduce<Record<string, number>>((categories, transaction) => {
      const category = transaction.category ?? 'General'

      return {
        ...categories,
        [category]: (categories[category] ?? 0) + transaction.amount,
      }
    }, {})
  const spendingTrend = Object.entries(spendingByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount)
  const goalItems = buildGoalItems({
    purchaseGoals,
    financePlan,
    debtPlans,
    emergencyFundPlan,
    fallbackEssentialExpenses: essentialMonthlyOutflow,
    monthlySurplus: monthlyNet,
    projectedBalance,
    today,
  })
  const goalPortfolio = summarizeGoalItems(goalItems, monthlyNet)
  const healthLabel =
    monthlyNet >= 0 && currentAvailableBalance >= 0
      ? 'Stable'
      : projectedMonthEndBalance < 0
        ? 'Needs attention'
        : 'Tight'
  const primaryRecommendation =
    projectedMonthEndBalance < 0
      ? 'Your current schedule projects a negative month-end balance. Review upcoming bills or add expected income.'
      : !paycheckEstimate
        ? 'Add your income and paycheck assumptions so the planner can estimate real take-home pay.'
        : essentialMonthlyOutflow === 0
          ? 'Add rent and essential monthly expenses so affordability checks start with your real obligations.'
          : totalDebt > 0 && monthlyNet > 0
            ? 'You have positive projected cash flow. Consider directing part of the surplus toward debt or emergency savings.'
            : !financePlan.targetDate
              ? 'Set a target amount and date so the planner can judge whether your cash flow supports the goal.'
              : planGap > 0
                ? 'Your target is not fully funded yet. Add income, reduce planned spending, or move the target date.'
                : 'Your current plan is on track. Keep upcoming transactions current so the forecast stays useful.'

  useEffect(() => {
    if (!userId) {
      const localState = normalizePersistedState(loadPersistedState())

      setCurrentBalanceInput(localState.currentBalanceInput)
      setBankBalanceSource(localState.bankBalanceSource)
      setBalanceDraft(localState.currentBalanceInput)
      setScheduledTransactions(localState.scheduledTransactions)
      setRecurringTransactions(localState.recurringTransactions)
      setPaycheckRules(localState.paycheckRules)
      setDebtPlans(localState.debtPlans)
      setFinancePlan(localState.financePlan)
      setPurchaseGoals(localState.purchaseGoals)
      setFinancialProfile(localState.financialProfile)
      setEmergencyFundPlan(localState.emergencyFundPlan)
      setInvestmentAccounts(localState.investmentAccounts)
      setNetWorthItems(localState.netWorthItems)
      setScenarioPlans(localState.scenarioPlans)
      setLinkedAccounts([])
      setLinkedTransactions([])
      setBankSyncError(null)
      setSyncReady(true)
      return
    }

    if (!supabase) {
      setSyncReady(true)
      return
    }

    const supabaseClient = supabase
    let active = true

    async function hydrateFromCloud() {
      const localState = normalizePersistedState(loadPersistedState())
      const { data, error } = await supabaseClient
        .from(DASHBOARD_STATE_TABLE)
        .select('payload')
        .eq('user_id', userId)
        .maybeSingle()

      if (!active) {
        return
      }

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load dashboard state', error)
        setSyncReady(true)
        return
      }

      const remoteState = normalizePersistedState(
        (data?.payload as Partial<PersistedState> | undefined) ?? null,
      )
      const shouldBackfillLocal =
        (!data?.payload || Object.keys(data.payload as object).length === 0) &&
        JSON.stringify(localState) !== JSON.stringify(getDefaultPersistedState())
      const hydratedState = shouldBackfillLocal
        ? mergePersistedStates(remoteState, localState)
        : remoteState

      setCurrentBalanceInput(hydratedState.currentBalanceInput)
      setBankBalanceSource(hydratedState.bankBalanceSource)
      setBalanceDraft(hydratedState.currentBalanceInput)
      setScheduledTransactions(hydratedState.scheduledTransactions)
      setRecurringTransactions(hydratedState.recurringTransactions)
      setPaycheckRules(hydratedState.paycheckRules)
      setDebtPlans(hydratedState.debtPlans)
      setFinancePlan(hydratedState.financePlan)
      setPurchaseGoals(hydratedState.purchaseGoals)
      setFinancialProfile(hydratedState.financialProfile)
      setEmergencyFundPlan(hydratedState.emergencyFundPlan)
      setInvestmentAccounts(hydratedState.investmentAccounts)
      setNetWorthItems(hydratedState.netWorthItems)
      setScenarioPlans(hydratedState.scenarioPlans)

      if (shouldBackfillLocal) {
        const { error: upsertError } = await supabaseClient
          .from(DASHBOARD_STATE_TABLE)
          .upsert(
            {
              user_id: userId,
              payload: hydratedState,
            },
            { onConflict: 'user_id' },
          )

        if (upsertError) {
          console.error('Failed to backfill dashboard state', upsertError)
        }
      }

      clearPersistedState()

      if (active) {
        setSyncReady(true)
      }
    }

    hydrateFromCloud()

    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    if (!userId || !supabase) {
      setLinkedAccounts([])
      setLinkedTransactions([])
      setBankSyncError(null)
      return
    }

    let active = true

    async function hydrateBankSnapshot() {
      try {
        const snapshot = await loadBankSnapshot()

        if (!active) {
          return
        }

        setLinkedAccounts(snapshot.accounts)
        setLinkedTransactions(snapshot.transactions)
      } catch (error) {
        if (!active) {
          return
        }

        console.error('Failed to load linked bank data', error)
        setBankSyncError(
          error instanceof Error ? error.message : 'Failed to load linked bank data.',
        )
      }
    }

    hydrateBankSnapshot()

    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    if (!syncReady) {
      return
    }

    const payload: PersistedState = {
      currentBalanceInput,
      bankBalanceSource,
      scheduledTransactions,
      recurringTransactions,
      paycheckRules,
      debtPlans,
      financePlan,
      purchaseGoals,
      financialProfile,
      emergencyFundPlan,
      investmentAccounts,
      netWorthItems,
      scenarioPlans,
    }

    const timeoutId = window.setTimeout(async () => {
      if (!userId || !supabase) {
        savePersistedState(payload)
        return
      }

      const { error } = await supabase.from(DASHBOARD_STATE_TABLE).upsert(
        {
          user_id: userId,
          payload,
        },
        { onConflict: 'user_id' },
      )

      if (error) {
        console.error('Failed to save dashboard state', error)
      }
    }, 400)

    return () => window.clearTimeout(timeoutId)
  }, [
    bankBalanceSource,
    currentBalanceInput,
    debtPlans,
    emergencyFundPlan,
    financialProfile,
    financePlan,
    investmentAccounts,
    netWorthItems,
    paycheckRules,
    purchaseGoals,
    recurringTransactions,
    scenarioPlans,
    scheduledTransactions,
    syncReady,
    userId,
  ])

  useEffect(
    () => () => {
      damageTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    },
    [],
  )

  function getPurchaseGoalProjection(goal: PurchaseGoal) {
    const projectedOnTarget = projectedBalance(goal.targetDate)
    const afterPurchase = projectedOnTarget - goal.cost

    return {
      projectedOnTarget,
      afterPurchase,
      savingsNeeded: Math.max(0, goal.cost - projectedOnTarget),
      recommendedPerCadence: getRecommendedPayment(
        goal.cost,
        goal.targetDate,
        goal.savingsCadence ?? 'monthly',
        today,
      ),
    }
  }

  function openModal(view: Exclude<ModalView, null>) {
    if (view === 'balanceEdit') {
      setBalanceDraft(currentBalanceInput)
    }

    if (view === 'incomeModel') {
      const savedIncome = financialProfile.incomeSources[0]

      setIncomeModelForm({
        name: savedIncome?.name ?? 'Primary income',
        type: savedIncome?.type ?? 'salary',
        amount: savedIncome ? String(savedIncome.amount) : '',
        hoursPerWeek: savedIncome?.hoursPerWeek
          ? String(savedIncome.hoursPerWeek)
          : '40',
        payFrequency: savedIncome?.payFrequency ?? 'biweekly',
        state: financialProfile.state,
        filingStatus: financialProfile.filingStatus,
      })
    }

    if (view === 'benefits') {
      const savedRetirement = financialProfile.retirementContributions[0]

      if (savedRetirement) {
        setRetirementForm({
          accountType: savedRetirement.accountType,
          contributionMode: savedRetirement.contributionMode,
          contributionValue: String(savedRetirement.contributionValue),
          employerMatchPercent: savedRetirement.employerMatchPercent
            ? String(savedRetirement.employerMatchPercent)
            : '',
          employerMatchLimitPercent: savedRetirement.employerMatchLimitPercent
            ? String(savedRetirement.employerMatchLimitPercent)
            : '',
        })
      }
    }

    if (view === 'emergencyFund') {
      setEmergencyFundForm({
        currentSavings: emergencyFundPlan.currentSavings
          ? String(emergencyFundPlan.currentSavings)
          : '',
        monthlyEssentialExpenses: emergencyFundPlan.monthlyEssentialExpenses
          ? String(emergencyFundPlan.monthlyEssentialExpenses)
          : String(Math.round(essentialMonthlyOutflow || monthlyOutflow || 0)),
        targetMonths: String(emergencyFundPlan.targetMonths || 3),
      })
    }

    setActiveModal(view)
  }

  function closeModal() {
    setActiveModal(null)
  }

  function triggerDamageSequence(title: string, amount: number) {
    const id = Date.now()

    damageTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))

    setDamageSequence({
      id,
      amount,
      nextBalance: currentAvailableBalance - amount,
      phase: 'approach',
      previousBalance: currentAvailableBalance,
      title,
    })

    damageTimeoutsRef.current = [
      window.setTimeout(() => {
        setDamageSequence((current) =>
          current?.id === id ? { ...current, phase: 'impact' } : current,
        )
      }, 900),
      window.setTimeout(() => {
        setDamageSequence((current) =>
          current?.id === id ? { ...current, phase: 'resolve' } : current,
        )
      }, 1220),
      window.setTimeout(() => {
        setDamageSequence((current) => (current?.id === id ? null : current))
      }, 2400),
    ]
  }

  async function handleConnectBank() {
    if (!userId || !supabase) {
      setBankSyncError(
        'Bank syncing requires a signed-in Supabase session so Plaid tokens stay on the server.',
      )
      return
    }

    setIsConnectingBank(true)
    setBankSyncError(null)

    try {
      const [{ linkToken }, plaid] = await Promise.all([
        createPlaidLinkToken(),
        loadPlaidLinkScript(),
      ])

      await new Promise<void>((resolve, reject) => {
        const handler = plaid.create({
          token: linkToken,
          onSuccess: async (publicToken, metadata) => {
            try {
              const snapshot = await exchangePlaidPublicToken(
                publicToken,
                metadata.institution ?? null,
              )

              setLinkedAccounts(snapshot.accounts)
              setLinkedTransactions(snapshot.transactions)
              setBankBalanceSource((current) =>
                current === 'linked' || snapshot.accounts.length === 0 ? current : 'linked',
              )
              resolve()
            } catch (error) {
              reject(error)
            } finally {
              handler.destroy()
            }
          },
          onExit: (error) => {
            handler.destroy()

            if (error) {
              reject(error)
              return
            }

            resolve()
          },
        })

        handler.open()
      })
    } catch (error) {
      console.error('Failed to connect bank', error)
      setBankSyncError(error instanceof Error ? error.message : 'Failed to connect bank.')
    } finally {
      setIsConnectingBank(false)
    }
  }

  async function handleSyncBank() {
    if (!userId || !supabase) {
      setBankSyncError(
        'Bank syncing requires a signed-in Supabase session so Plaid tokens stay on the server.',
      )
      return
    }

    setIsSyncingBank(true)
    setBankSyncError(null)

    try {
      const snapshot = await syncBankSnapshot()
      setLinkedAccounts(snapshot.accounts)
      setLinkedTransactions(snapshot.transactions)
    } catch (error) {
      console.error('Failed to sync bank data', error)
      setBankSyncError(error instanceof Error ? error.message : 'Failed to sync bank data.')
    } finally {
      setIsSyncingBank(false)
    }
  }

  function openDay(dateKey: string) {
    setSelectedDateKey(dateKey)
    setActiveModal('day')
  }

  function removeGoal(kind: GoalItemKind, originId: number) {
    if (kind === 'purchase') {
      setPurchaseGoals((current) => current.filter((goal) => goal.id !== originId))
      return
    }

    if (kind === 'debt') {
      setDebtPlans((current) => current.filter((debt) => debt.id !== originId))
    }
  }

  function removePaycheckRule(id: number) {
    setPaycheckRules((current) => current.filter((rule) => rule.id !== id))
  }

  function removeRecurring(id: number) {
    setRecurringTransactions((current) =>
      current.filter((transaction) => transaction.id !== id),
    )
  }

  function removeScheduled(id: number) {
    setScheduledTransactions((current) =>
      current.filter((transaction) => transaction.id !== id),
    )
  }

  function removeScenario(id: number) {
    setScenarioPlans((current) => current.filter((scenario) => scenario.id !== id))
  }

  function activateScenario(id: number) {
    setScenarioPlans((current) => {
      const target = current.find((scenario) => scenario.id === id)

      return target
        ? [target, ...current.filter((scenario) => scenario.id !== id)]
        : current
    })
  }

  function removeOccurrence(item: CalendarOccurrence) {
    if (item.originType === 'single') {
      setScheduledTransactions((current) =>
        current.filter((transaction) => transaction.id !== item.originId),
      )
      return
    }

    if (item.originType === 'recurring') {
      setRecurringTransactions((current) =>
        current.filter((transaction) => transaction.id !== item.originId),
      )
      return
    }

    setPaycheckRules((current) =>
      current.filter((transaction) => transaction.id !== item.originId),
    )
  }

  function handleAddDayTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!dayForm.title || !dayForm.amount) {
      return
    }

    const amount = Number(dayForm.amount)
    const isCurrentDayExpense = selectedDateKey === todayKey && dayForm.type === 'expense'

    setScheduledTransactions((current) => [
      ...current,
      {
        id: Date.now(),
        title: dayForm.title,
        amount,
        date: selectedDateKey,
        type: dayForm.type,
        category: 'General',
      },
    ])

    if (isCurrentDayExpense) {
      triggerDamageSequence(dayForm.title, amount)
    }

    setDayForm({ title: '', amount: '', type: 'expense' })
  }

  function handleSaveBalance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCurrentBalanceInput(balanceDraft)
    closeModal()
  }

  function handleAddOneTimeTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!oneTimeForm.title || !oneTimeForm.amount || !oneTimeForm.date) {
      return
    }

    const amount = Number(oneTimeForm.amount)
    const isCurrentDayExpense = oneTimeForm.date === todayKey && oneTimeForm.type === 'expense'

    setScheduledTransactions((current) => [
      ...current,
      {
        id: Date.now(),
        title: oneTimeForm.title,
        amount,
        date: oneTimeForm.date,
        type: oneTimeForm.type,
        category: oneTimeForm.category,
      },
    ])

    if (isCurrentDayExpense) {
      triggerDamageSequence(oneTimeForm.title, amount)
    }

    setOneTimeForm({
      title: '',
      amount: '',
      date: todayKey,
      type: 'expense',
      category: 'Groceries',
    })
  }

  function handleAddRecurring(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!recurringForm.title || !recurringForm.amount) {
      return
    }

    if (recurringForm.frequency === 'monthly' && !recurringForm.dayOfMonth) {
      return
    }

    if (recurringForm.frequency === 'weekly' && recurringForm.weekdays.length === 0) {
      return
    }

    setRecurringTransactions((current) => [
      ...current,
      {
        id: Date.now(),
        title: recurringForm.title,
        amount: Number(recurringForm.amount),
        frequency: recurringForm.frequency,
        dayOfMonth:
          recurringForm.frequency === 'monthly'
            ? Number(recurringForm.dayOfMonth)
            : undefined,
        weekdays:
          recurringForm.frequency === 'weekly' ? recurringForm.weekdays : undefined,
        type: recurringForm.type,
        category: 'Recurring',
        startDate: recurringForm.startDate || undefined,
        endDate: recurringForm.endDate || undefined,
      },
    ])

    setRecurringForm({
      title: '',
      amount: '',
      frequency: 'monthly',
      dayOfMonth: '',
      weekdays: [],
      type: 'expense',
      startDate: todayKey,
      endDate: '',
    })
  }

  function handleAddEssentialExpenses(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const entries = [
      {
        title: 'Rent / mortgage',
        amount: essentialExpenseForm.rent,
        dayOfMonth: essentialExpenseForm.rentDueDay,
        category: 'Housing',
      },
      {
        title: 'Utilities',
        amount: essentialExpenseForm.utilities,
        dayOfMonth: essentialExpenseForm.dueDay,
        category: 'Essentials',
      },
      {
        title: 'Water',
        amount: essentialExpenseForm.water,
        dayOfMonth: essentialExpenseForm.dueDay,
        category: 'Housing',
      },
      {
        title: 'Electricity',
        amount: essentialExpenseForm.electricity,
        dayOfMonth: essentialExpenseForm.dueDay,
        category: 'Housing',
      },
      {
        title: 'Phone',
        amount: essentialExpenseForm.phone,
        dayOfMonth: essentialExpenseForm.dueDay,
        category: 'Essentials',
      },
      {
        title: 'Internet',
        amount: essentialExpenseForm.internet,
        dayOfMonth: essentialExpenseForm.dueDay,
        category: 'Essentials',
      },
      {
        title: 'Insurance',
        amount: essentialExpenseForm.insurance,
        dayOfMonth: essentialExpenseForm.dueDay,
        category: 'Essentials',
      },
      {
        title: 'Subscriptions',
        amount: essentialExpenseForm.subscriptions,
        dayOfMonth: essentialExpenseForm.dueDay,
        category: 'Essentials',
      },
      {
        title: 'Groceries',
        amount: essentialExpenseForm.groceries,
        dayOfMonth: essentialExpenseForm.dueDay,
        category: 'Essentials',
      },
      {
        title: 'Transportation',
        amount: essentialExpenseForm.transportation,
        dayOfMonth: essentialExpenseForm.dueDay,
        category: 'Essentials',
      },
    ].filter((entry) => Number(entry.amount) > 0)

    if (entries.length === 0) {
      return
    }

    const now = Date.now()

    setRecurringTransactions((current) => [
      ...current,
      ...entries.map((entry, index) => ({
        id: now + index,
        title: entry.title,
        amount: Number(entry.amount),
        frequency: 'monthly' as const,
        dayOfMonth: Number(entry.dayOfMonth),
        type: 'expense' as const,
        category: entry.category,
        startDate: todayKey,
      })),
    ])

    setEssentialExpenseForm({
      rent: '',
      rentDueDay: '1',
      utilities: '',
      water: '',
      electricity: '',
      phone: '',
      internet: '',
      insurance: '',
      subscriptions: '',
      groceries: '',
      transportation: '',
      dueDay: '1',
    })
  }

  function handleAddPaycheck(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!paycheckForm.title || !paycheckForm.amount) {
      return
    }

    if (paycheckForm.frequency === 'monthly' && !paycheckForm.dayOfMonth) {
      return
    }

    if (
      (paycheckForm.frequency === 'weekly' || paycheckForm.frequency === 'biweekly') &&
      !paycheckForm.startDate
    ) {
      return
    }

    const paycheckWeekday =
      paycheckForm.frequency === 'weekly' || paycheckForm.frequency === 'biweekly'
        ? String(parseDateKey(paycheckForm.startDate).getDay())
        : paycheckForm.weekday

    setPaycheckRules((current) => [
      ...current,
      {
        id: Date.now(),
        title: paycheckForm.title,
        amount: Number(paycheckForm.amount),
        frequency: paycheckForm.frequency,
        dayOfMonth:
          paycheckForm.frequency === 'monthly'
            ? Number(paycheckForm.dayOfMonth)
            : undefined,
        weekday:
          paycheckForm.frequency === 'weekly' ||
            paycheckForm.frequency === 'biweekly'
            ? Number(paycheckWeekday)
            : undefined,
        startDate:
          paycheckForm.frequency === 'weekly' ||
            paycheckForm.frequency === 'biweekly'
            ? paycheckForm.startDate
            : undefined,
      },
    ])

    setPaycheckForm({
      title: 'Paycheck',
      amount: '',
      frequency: 'monthly',
      dayOfMonth: '',
      weekday: todayWeekday,
      startDate: todayKey,
    })
  }

  function handleSaveIncomeModel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!incomeModelForm.name || !incomeModelForm.amount) {
      return
    }

    setFinancialProfile((current) => ({
      ...current,
      state: incomeModelForm.state.trim().toUpperCase(),
      filingStatus: incomeModelForm.filingStatus,
      incomeSources: [
        {
          id: current.incomeSources[0]?.id ?? Date.now(),
          name: incomeModelForm.name,
          type: incomeModelForm.type,
          amount: Number(incomeModelForm.amount),
          hoursPerWeek:
            incomeModelForm.type === 'hourly'
              ? Number(incomeModelForm.hoursPerWeek || 40)
              : undefined,
          payFrequency: incomeModelForm.payFrequency,
        },
      ],
    }))
  }

  function handleAddBenefit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!benefitForm.name || !benefitForm.amountPerPaycheck) {
      return
    }

    setFinancialProfile((current) => ({
      ...current,
      benefitElections: [
        ...current.benefitElections,
        {
          id: Date.now(),
          name: benefitForm.name,
          type: benefitForm.type,
          amountPerPaycheck: Number(benefitForm.amountPerPaycheck),
          taxTreatment: benefitForm.taxTreatment,
        },
      ],
    }))

    setBenefitForm({
      name: 'Health insurance',
      type: 'health',
      amountPerPaycheck: '',
      taxTreatment: 'pre_tax',
    })
  }

  function handleSaveRetirementContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!retirementForm.contributionValue) {
      return
    }

    setFinancialProfile((current) => ({
      ...current,
      retirementContributions: [
        {
          id: current.retirementContributions[0]?.id ?? Date.now(),
          accountType: retirementForm.accountType,
          contributionMode: retirementForm.contributionMode,
          contributionValue: Number(retirementForm.contributionValue),
          employerMatchPercent: retirementForm.employerMatchPercent
            ? Number(retirementForm.employerMatchPercent)
            : undefined,
          employerMatchLimitPercent: retirementForm.employerMatchLimitPercent
            ? Number(retirementForm.employerMatchLimitPercent)
            : undefined,
        },
      ],
    }))
  }

  function handleUseNetPaycheck() {
    if (!paycheckEstimate || !primaryIncome) {
      return
    }

    if (
      primaryIncome.payFrequency !== 'weekly' &&
      primaryIncome.payFrequency !== 'biweekly' &&
      primaryIncome.payFrequency !== 'monthly'
    ) {
      return
    }

    const paycheckFrequency = primaryIncome.payFrequency
    const anchorDate = parseDateKey(estimatedPaycheckDate)

    setPaycheckRules((current) => [
      ...current,
      {
        id: Date.now(),
        title: `${primaryIncome.name} net pay`,
        amount: Math.max(0, Math.round(paycheckEstimate.estimatedNetPaycheck)),
        frequency: paycheckFrequency,
        dayOfMonth: paycheckFrequency === 'monthly' ? anchorDate.getDate() : undefined,
        weekday: paycheckFrequency === 'monthly' ? undefined : anchorDate.getDay(),
        startDate: paycheckFrequency === 'monthly' ? undefined : estimatedPaycheckDate,
      },
    ])
  }

  function handleAddDebt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !debtForm.title ||
      !debtForm.balance ||
      !debtForm.minimumDue ||
      !debtForm.dueDate
    ) {
      return
    }

    setDebtPlans((current) => [
      ...current,
      {
        id: Date.now(),
        title: debtForm.title,
        balance: Number(debtForm.balance),
        minimumDue: Number(debtForm.minimumDue),
        dueDate: debtForm.dueDate,
        payoffDate: debtForm.payoffDate,
        apr: debtForm.apr ? Number(debtForm.apr) : undefined,
        extraPayment: debtForm.extraPayment ? Number(debtForm.extraPayment) : undefined,
        payoffCadence: debtForm.payoffDate ? debtForm.payoffCadence : undefined,
        payoffMode:
          debtForm.payoffDate && debtForm.payoffValue ? debtForm.payoffMode : undefined,
        payoffValue:
          debtForm.payoffDate && debtForm.payoffValue
            ? Number(debtForm.payoffValue)
            : undefined,
      },
    ])

    setDebtForm({
      title: '',
      balance: '',
      minimumDue: '',
      dueDate: '',
      payoffDate: '',
      payoffCadence: 'monthly',
      payoffMode: 'amount',
      payoffValue: '',
      apr: '',
      extraPayment: '',
    })
  }

  function handleAddPurchaseGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!purchaseGoalForm.title || !purchaseGoalForm.cost || !purchaseGoalForm.targetDate) {
      return
    }

    setPurchaseGoals((current) => [
      ...current,
      {
        id: Date.now(),
        title: purchaseGoalForm.title,
        cost: Number(purchaseGoalForm.cost),
        targetDate: purchaseGoalForm.targetDate,
        savingsCadence: purchaseGoalForm.savingsCadence,
      },
    ])

    setPurchaseGoalForm({
      title: '',
      cost: '',
      targetDate: '',
      savingsCadence: 'monthly',
    })
  }

  function handleSaveEmergencyFund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setEmergencyFundPlan({
      currentSavings: Number(emergencyFundForm.currentSavings || 0),
      monthlyEssentialExpenses: Number(emergencyFundForm.monthlyEssentialExpenses || 0),
      targetMonths: Number(emergencyFundForm.targetMonths || 3),
    })
  }

  function handleAddInvestment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!investmentForm.title || !investmentForm.balance) {
      return
    }

    setInvestmentAccounts((current) => [
      ...current,
      {
        id: Date.now(),
        title: investmentForm.title,
        accountType: investmentForm.accountType,
        balance: Number(investmentForm.balance),
        monthlyContribution: Number(investmentForm.monthlyContribution || 0),
        annualReturnRate: Number(investmentForm.annualReturnRate || 0),
      },
    ])

    setInvestmentForm({
      title: '',
      accountType: 'brokerage',
      balance: '',
      monthlyContribution: '',
      annualReturnRate: '7',
    })
  }

  function handleAddNetWorthItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!netWorthForm.title || !netWorthForm.balance) {
      return
    }

    setNetWorthItems((current) => [
      ...current,
      {
        id: Date.now(),
        title: netWorthForm.title,
        balance: Number(netWorthForm.balance),
        kind: netWorthForm.kind,
        category: netWorthForm.category,
      },
    ])

    setNetWorthForm({
      title: '',
      balance: '',
      kind: 'asset',
      category: 'cash',
    })
  }

  function handleSaveScenario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!scenarioForm.title) {
      return
    }

    const scenario: ScenarioPlan = {
      id: Date.now(),
      title: scenarioForm.title,
      incomeChangePercent: Number(scenarioForm.incomeChangePercent || 0),
      rentChange: Number(scenarioForm.rentChange || 0),
      benefitChangePerPaycheck: Number(scenarioForm.benefitChangePerPaycheck || 0),
      retirementContributionChangePercent: Number(
        scenarioForm.retirementContributionChangePercent || 0,
      ),
      extraDebtPayment: Number(scenarioForm.extraDebtPayment || 0),
      oneTimePurchase: Number(scenarioForm.oneTimePurchase || 0),
      investmentContributionChange: Number(
        scenarioForm.investmentContributionChange || 0,
      ),
    }

    setScenarioPlans((current) => [scenario, ...current.filter((item) => item.id !== scenario.id)])
    setScenarioForm({
      title: 'What if scenario',
      incomeChangePercent: '',
      rentChange: '',
      benefitChangePerPaycheck: '',
      retirementContributionChangePercent: '',
      extraDebtPayment: '',
      oneTimePurchase: '',
      investmentContributionChange: '',
    })
  }


  return (
    <>
      <main
        className={`planner-shell ${
          damageSequence?.phase === 'impact' ? 'planner-shell-damage-shake' : ''
        }`}
      >
        <DashboardHeader
          activePage={activePage}
          appMode={appMode}
          navOpen={navOpen}
          onModeChange={onModeChange}
          onPageChange={(page) => {
            setActivePage(page)
            setNavOpen(false)
          }}
          onSignOut={onSignOut}
          onToggleNav={() => setNavOpen((current) => !current)}
          userEmail={userEmail}
        />

        <div className="page-stack">
          {activePage === 'dashboard' ? (
            <>
              <HomePage
                balanceDisplayValue={
                  damageSequence
                    ? damageSequence.phase === 'resolve'
                      ? damageSequence.nextBalance
                      : damageSequence.previousBalance
                    : currentAvailableBalance
                }
                balanceHeroPhase={damageSequence?.phase ?? null}
                currentCashSourceLabel={
                  usingLinkedBalance
                    ? 'Using linked bank balances'
                    : 'Tap to update manual balance'
                }
                currentMonth={currentMonth}
                goalItems={goalItems}
                goalPortfolio={goalPortfolio}
                healthLabel={healthLabel}
                monthlyIncome={monthlyIncome}
                monthlyNet={monthlyNet}
                monthlyOutflow={monthlyOutflow}
                nextPaycheck={nextPaycheck}
                onNavigate={setActivePage}
                openModal={openModal}
                paycheckEstimate={paycheckEstimate}
                primaryRecommendation={primaryRecommendation}
                sixMonthProjection={sixMonthProjection}
              />
              <CalendarPanel
                allOccurrences={allOccurrences}
                calendarDays={calendarDays}
                currentMonth={currentMonth}
                debtPlans={debtPlans}
                openDay={openDay}
                projectedBalance={projectedBalance}
                selectedDateKey={selectedDateKey}
                setCurrentMonth={setCurrentMonth}
                today={today}
                todayKey={todayKey}
                upcomingTransactions={upcomingTransactions}
              />
            </>
          ) : null}

          {activePage === 'cashFlow' ? (
            <CashFlowPage
              currentMonth={currentMonth}
              essentialMonthlyOutflow={essentialMonthlyOutflow}
              linkedAccountsCount={linkedAccounts.length}
              linkedCashBalance={linkedCashBalance}
              monthlyIncome={monthlyIncome}
              monthlyNet={monthlyNet}
              monthlyOutflow={monthlyOutflow}
              openModal={openModal}
              paycheckEstimate={paycheckEstimate}
              paycheckRules={paycheckRules}
              recurringTransactions={recurringTransactions}
              removePaycheckRule={removePaycheckRule}
              removeRecurring={removeRecurring}
              removeScheduled={removeScheduled}
              scheduledTransactions={scheduledTransactions}
              todayKey={todayKey}
              totalBenefitsPerPaycheck={totalBenefitsPerPaycheck}
            />
          ) : null}

          {activePage === 'goals' ? (
            <GoalsPage
              debtPlans={debtPlans}
              goalItems={goalItems}
              goalPortfolio={goalPortfolio}
              monthlyNet={monthlyNet}
              openModal={openModal}
              removeGoal={removeGoal}
            />
          ) : null}

          {activePage === 'scenarios' ? (
            <ScenariosPage
              activateScenario={activateScenario}
              activeScenario={activeScenario}
              openModal={openModal}
              removeScenario={removeScenario}
              scenarioImpact={scenarioImpact}
              scenarioPlans={scenarioPlans}
            />
          ) : null}

          {activePage === 'insights' ? (
            <InsightsPage
              currentMonth={currentMonth}
              fiveYearInvestmentProjection={fiveYearInvestmentProjection}
              monthlyProjection={monthlyProjection}
              netWorthSummary={netWorthSummary}
              openModal={openModal}
              scenarioImpact={scenarioImpact}
              spendingTrend={spendingTrend}
              totalInvestmentBalance={totalInvestmentBalance}
            />
          ) : null}
        </div>
      </main>

      <AnimatePresence>
        {damageSequence ? (
          <motion.div
            className={`damage-overlay damage-overlay-${damageSequence.phase}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="damage-overlay-backdrop" />
            <div className="damage-overlay-content">
              <div className="damage-stage">
                <p className="damage-overlay-label">Money available</p>
                <strong className="damage-overlay-total">
                  {currency.format(
                    damageSequence.phase === 'resolve'
                      ? damageSequence.nextBalance
                      : damageSequence.previousBalance,
                  )}
                </strong>
                <p className="damage-overlay-subtitle">{damageSequence.title}</p>
                <div className="damage-projectile">
                  <span>-{currency.format(damageSequence.amount)}</span>
                </div>
                <div className="damage-impact-ring" />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal ? (
          <>
            <motion.button
              type="button"
              className="modal-overlay"
              aria-label="Close modal"
              onClick={closeModal}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            />
            <div className="modal-shell">
              <motion.section
                className="modal-card"
                aria-label="Planner modal"
                initial={{ opacity: 0, scale: 0.94, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{
                  duration: 0.22,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <DashboardModalContent
                  activeModal={activeModal}
                  activeScenario={activeScenario}
                  balanceDraft={balanceDraft}
                  bankBalanceSource={bankBalanceSource}
                  bankSyncError={bankSyncError}
                  benefitForm={benefitForm}
                  canUseBankSync={Boolean(userId && supabase && isSupabaseConfigured)}
                  closeModal={closeModal}
                  dayForm={dayForm}
                  debtCustomPayment={debtCustomPayment}
                  debtForm={debtForm}
                  debtPlanCount={debtPlanCount}
                  debtPlans={debtPlans}
                  debtProjectedRemaining={debtProjectedRemaining}
                  debtRecommendedPayment={debtRecommendedPayment}
                  emergencyFundForm={emergencyFundForm}
                  emergencyFundPlan={emergencyFundPlan}
                  emergencyFundProgress={emergencyFundProgress}
                  essentialExpenseForm={essentialExpenseForm}
                  financePlan={financePlan}
                  financialProfile={financialProfile}
                  fiveYearInvestmentProjection={fiveYearInvestmentProjection}
                  getPurchaseGoalProjection={getPurchaseGoalProjection}
                  handleAddBenefit={handleAddBenefit}
                  handleAddDayTransaction={handleAddDayTransaction}
                  handleAddDebt={handleAddDebt}
                  handleAddEssentialExpenses={handleAddEssentialExpenses}
                  handleAddInvestment={handleAddInvestment}
                  handleAddNetWorthItem={handleAddNetWorthItem}
                  handleAddOneTimeTransaction={handleAddOneTimeTransaction}
                  handleAddPaycheck={handleAddPaycheck}
                  handleAddPurchaseGoal={handleAddPurchaseGoal}
                  handleAddRecurring={handleAddRecurring}
                  handleSaveBalance={handleSaveBalance}
                  handleSaveEmergencyFund={handleSaveEmergencyFund}
                  handleSaveIncomeModel={handleSaveIncomeModel}
                  handleSaveRetirementContribution={handleSaveRetirementContribution}
                  handleSaveScenario={handleSaveScenario}
                  handleBankBalanceSourceChange={setBankBalanceSource}
                  handleConnectBank={handleConnectBank}
                  handleSyncBank={handleSyncBank}
                  handleUseNetPaycheck={handleUseNetPaycheck}
                  incomeModelForm={incomeModelForm}
                  investmentAccounts={investmentAccounts}
                  investmentForm={investmentForm}
                  netWorthForm={netWorthForm}
                  netWorthItems={netWorthItems}
                  netWorthSummary={netWorthSummary}
                  oneTimeForm={oneTimeForm}
                  estimatedPaycheckDate={estimatedPaycheckDate}
                  isConnectingBank={isConnectingBank}
                  isSyncingBank={isSyncingBank}
                  linkedAccounts={linkedAccounts}
                  linkedCashBalance={linkedCashBalance}
                  linkedTransactions={linkedTransactions}
                  paycheckEstimate={paycheckEstimate}
                  paycheckForm={paycheckForm}
                  paycheckRules={paycheckRules}
                  planGap={planGap}
                  planProjection={planProjection}
                  primaryIncome={primaryIncome}
                  purchaseGoalForm={purchaseGoalForm}
                  purchaseGoals={purchaseGoals}
                  recurringForm={recurringForm}
                  recurringTransactions={recurringTransactions}
                  removeOccurrence={removeOccurrence}
                  retirementForm={retirementForm}
                  scenarioForm={scenarioForm}
                  scenarioImpact={scenarioImpact}
                  scenarioPlans={scenarioPlans}
                  scheduledTransactions={scheduledTransactions}
                  selectedDateKey={selectedDateKey}
                  selectedDayBalance={selectedDayBalance}
                  selectedDayTransactions={selectedDayTransactions}
                  setBalanceDraft={setBalanceDraft}
                  setBenefitForm={setBenefitForm}
                  setDayForm={setDayForm}
                  setDebtForm={setDebtForm}
                  setDebtPlans={setDebtPlans}
                  setEmergencyFundForm={setEmergencyFundForm}
                  setEssentialExpenseForm={setEssentialExpenseForm}
                  setFinancePlan={setFinancePlan}
                  setFinancialProfile={setFinancialProfile}
                  setIncomeModelForm={setIncomeModelForm}
                  setInvestmentAccounts={setInvestmentAccounts}
                  setInvestmentForm={setInvestmentForm}
                  setNetWorthForm={setNetWorthForm}
                  setNetWorthItems={setNetWorthItems}
                  setOneTimeForm={setOneTimeForm}
                  setEstimatedPaycheckDate={setEstimatedPaycheckDate}
                  setPaycheckForm={setPaycheckForm}
                  setPaycheckRules={setPaycheckRules}
                  setPurchaseGoalForm={setPurchaseGoalForm}
                  setPurchaseGoals={setPurchaseGoals}
                  setRecurringForm={setRecurringForm}
                  setRecurringTransactions={setRecurringTransactions}
                  setRetirementForm={setRetirementForm}
                  setScenarioForm={setScenarioForm}
                  setScenarioPlans={setScenarioPlans}
                  setScheduledTransactions={setScheduledTransactions}
                  today={today}
                  totalBenefitsPerPaycheck={totalBenefitsPerPaycheck}
                  totalInvestmentBalance={totalInvestmentBalance}
                  totalRetirementPerPaycheck={totalRetirementPerPaycheck}
                />
              </motion.section>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}

export default Dashboard


