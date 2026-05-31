import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import {
  buildCalendarOccurrences,
  getCalendarDays,
  getSignedAmount,
  projectBalance,
} from '../calculations/cashFlow'
import {
  getCadenceLabel,
  estimateDebtAmortization,
  getMonthlyAmountNeeded,
  getPaymentCount,
  getRecommendedPayment,
} from '../calculations/debtPayoff'
import { calculateEmergencyFundProgress } from '../calculations/emergencyFund'
import { projectInvestmentGrowth } from '../calculations/investments'
import { calculateNetWorth } from '../calculations/netWorth'
import { estimatePaycheck } from '../calculations/paycheck'
import { projectBalanceMonths } from '../calculations/projections'
import { projectScenarioImpact } from '../calculations/scenarios'
import { supabase } from '../lib/supabase'
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
import { currency } from '../utils/currency'
import {
  endOfMonth,
  formatDateKey,
  formatLongDate,
  formatMonthLabel,
  getWeekdayList,
  parseDateKey,
  startOfMonth,
  weekdayLabels,
  weekdayOptions,
} from '../utils/dates'

type ModalView =
  | 'balanceEdit'
  | 'day'
  | 'oneTime'
  | 'recurring'
  | 'paycheck'
  | 'incomeModel'
  | 'benefits'
  | 'essentials'
  | 'emergencyFund'
  | 'investments'
  | 'netWorth'
  | 'scenarios'
  | 'insights'
  | 'debt'
  | 'allDebts'
  | 'plan'
  | 'purchaseGoals'
  | null

type PageView =
  | 'dashboard'
  | 'calendar'
  | 'cashFlow'
  | 'planning'
  | 'scenarios'
  | 'insights'

const pageTabs: { label: string; value: PageView }[] = [
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Cash Flow', value: 'cashFlow' },
  { label: 'Planning', value: 'planning' },
  { label: 'Scenarios', value: 'scenarios' },
  { label: 'Insights', value: 'insights' },
]

type DashboardProps = {
  userId?: string
  userEmail?: string
  appMode?: 'local' | 'supabase'
  onModeChange?: (mode: 'local' | 'supabase') => void
  onSignOut?: () => Promise<void> | void
}

function Dashboard({ userId, userEmail, appMode, onModeChange, onSignOut }: DashboardProps) {
  const today = useMemo(() => new Date(), [])
  const todayKey = formatDateKey(today)
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
    weekday: '5',
    startDate: todayKey,
  })
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
  const currentBalance =
    currentBalanceInput.trim() === '' ? 0 : Number(currentBalanceInput)
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
  const nearestPurchaseGoal = purchaseGoals
    .filter((goal) => goal.targetDate >= todayKey)
    .sort((left, right) => left.targetDate.localeCompare(right.targetDate))[0]
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
    .filter((transaction) => transaction.category === 'Essentials')
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
  const maxProjectionMagnitude = Math.max(
    1,
    ...monthlyProjection.map((point) => Math.abs(point.balance)),
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
  const maxSpendingCategory = Math.max(1, ...spendingTrend.map((item) => item.amount))
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
    if (!syncReady) {
      return
    }

    const payload: PersistedState = {
      currentBalanceInput,
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

  function openDay(dateKey: string) {
    setSelectedDateKey(dateKey)
    setActiveModal('day')
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

    setScheduledTransactions((current) => [
      ...current,
      {
        id: Date.now(),
        title: dayForm.title,
        amount: Number(dayForm.amount),
        date: selectedDateKey,
        type: dayForm.type,
        category: 'General',
      },
    ])

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

    setScheduledTransactions((current) => [
      ...current,
      {
        id: Date.now(),
        title: oneTimeForm.title,
        amount: Number(oneTimeForm.amount),
        date: oneTimeForm.date,
        type: oneTimeForm.type,
        category: oneTimeForm.category,
      },
    ])

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
      },
      {
        title: 'Utilities',
        amount: essentialExpenseForm.utilities,
        dayOfMonth: essentialExpenseForm.dueDay,
      },
      {
        title: 'Phone',
        amount: essentialExpenseForm.phone,
        dayOfMonth: essentialExpenseForm.dueDay,
      },
      {
        title: 'Internet',
        amount: essentialExpenseForm.internet,
        dayOfMonth: essentialExpenseForm.dueDay,
      },
      {
        title: 'Insurance',
        amount: essentialExpenseForm.insurance,
        dayOfMonth: essentialExpenseForm.dueDay,
      },
      {
        title: 'Subscriptions',
        amount: essentialExpenseForm.subscriptions,
        dayOfMonth: essentialExpenseForm.dueDay,
      },
      {
        title: 'Groceries',
        amount: essentialExpenseForm.groceries,
        dayOfMonth: essentialExpenseForm.dueDay,
      },
      {
        title: 'Transportation',
        amount: essentialExpenseForm.transportation,
        dayOfMonth: essentialExpenseForm.dueDay,
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
        category: 'Essentials',
        startDate: todayKey,
      })),
    ])

    setEssentialExpenseForm({
      rent: '',
      rentDueDay: '1',
      utilities: '',
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
            ? Number(paycheckForm.weekday)
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
      weekday: '5',
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

    setPaycheckRules((current) => [
      ...current,
      {
        id: Date.now(),
        title: `${primaryIncome.name} net pay`,
        amount: Math.max(0, Math.round(paycheckEstimate.estimatedNetPaycheck)),
        frequency: paycheckFrequency,
        dayOfMonth: paycheckFrequency === 'monthly' ? 1 : undefined,
        weekday: paycheckFrequency === 'monthly' ? undefined : 5,
        startDate: paycheckFrequency === 'monthly' ? undefined : todayKey,
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

  function renderModalContent() {
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
              placeholder="Scheduled transaction"
              value={dayForm.title}
              onChange={(event) =>
                setDayForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <div className="split-row">
              <input
                type="number"
                min="0"
                placeholder="Amount"
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

    if (activeModal === 'oneTime') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">One-time</p>
              <h2>One-time transactions</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleAddOneTimeTransaction}>
            <input
              type="text"
              placeholder="Transaction name"
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
                min="0"
                placeholder="Amount"
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
                        className={`day-net ${getSignedAmount(transaction.amount, transaction.type) >= 0
                          ? 'positive'
                          : 'negative'
                          }`}
                      >
                        {getSignedAmount(transaction.amount, transaction.type) >= 0 ? '+' : '-'}
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
      )
    }

    if (activeModal === 'recurring') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Recurring</p>
              <h2>Recurring transactions</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleAddRecurring}>
            <input
              type="text"
              placeholder="Name"
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
                min="0"
                placeholder="Amount"
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
                  placeholder="Day of month"
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
      )
    }

    if (activeModal === 'paycheck') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Income</p>
              <h2>Paycheck days</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={handleAddPaycheck}>
            <input
              type="text"
              placeholder="Paycheck label"
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
                min="0"
                placeholder="Amount"
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
                  placeholder="Day of month"
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
                  value={paycheckForm.startDate}
                  onChange={(event) =>
                    setPaycheckForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                />
              </label>
            ) : null}
            <button type="submit">Add paycheck day</button>
          </form>
          <div className="modal-list compact-list">
            {paycheckRules.length === 0 ? (
              <p className="empty-copy">No paycheck rules yet.</p>
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
              ))
            )}
          </div>
        </>
      )
    }

    if (activeModal === 'incomeModel') {
      const canUseEstimateAsPaycheck =
        primaryIncome?.payFrequency === 'weekly' ||
        primaryIncome?.payFrequency === 'biweekly' ||
        primaryIncome?.payFrequency === 'monthly'

      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Income model</p>
              <h2>Gross to net paycheck</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <p className="empty-copy modal-intro">
            Estimate take-home pay from salary or hourly income, state, filing
            status, benefits, and retirement deductions. These numbers are planning
            estimates, not tax or financial advice.
          </p>
          <form className="stack-form" onSubmit={handleSaveIncomeModel}>
            <input
              type="text"
              placeholder="Income name"
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
                  min="0"
                  placeholder="0"
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
              placeholder="Benefit name"
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
                  min="0"
                  placeholder="0"
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
                min="0"
                placeholder={retirementForm.contributionMode === 'percent' ? 'e.g. 6' : 'e.g. 150'}
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
      const essentialExpenses = recurringTransactions.filter(
        (transaction) => transaction.category === 'Essentials',
      )

      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Core expenses</p>
              <h2>Rent and essentials</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <p className="empty-copy modal-intro">
            Add the fixed costs that shape your real monthly life first. These become
            monthly recurring expenses in the forecast.
          </p>
          <form className="stack-form" onSubmit={handleAddEssentialExpenses}>
            <div className="split-row">
              <label className="field-stack">
                <span>Rent / mortgage</span>
                <input
                  type="number"
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
            {essentialExpenses.length === 0 ? (
              <p className="empty-copy">
                No essential expenses have been marked yet. Add rent and common bills
                here so affordability checks start from real obligations.
              </p>
            ) : (
              essentialExpenses.map((item) => (
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
              ))
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
              placeholder="Debt name"
              value={debtForm.title}
              onChange={(event) =>
                setDebtForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <div className="split-row">
              <input
                type="number"
                min="0"
                placeholder="Balance"
                value={debtForm.balance}
                onChange={(event) =>
                  setDebtForm((current) => ({ ...current, balance: event.target.value }))
                }
              />
              <input
                type="number"
                min="0"
                placeholder="Minimum due"
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
                min="0"
                placeholder="APR % (optional)"
                value={debtForm.apr}
                onChange={(event) =>
                  setDebtForm((current) => ({ ...current, apr: event.target.value }))
                }
              />
              <input
                type="number"
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

    if (activeModal === 'allDebts') {
      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Debt overview</p>
              <h2>All debts</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>
          <div className="status-strip">
            <div>
              <span>Total debt</span>
              <strong>{currency.format(totalDebt)}</strong>
            </div>
            <div>
              <span>Tracked accounts</span>
              <strong>{debtPlans.length}</strong>
            </div>
          </div>
          <div className="modal-list debt-ledger-list">
            {debtPlans.length === 0 ? (
              <p className="empty-copy">No debts tracked yet.</p>
            ) : (
              debtPlans.map((debt) => (
                <div className="debt-row" key={debt.id}>
                  <div>
                    <strong>{debt.title}</strong>
                    <p>Due {formatLongDate(debt.dueDate)}</p>
                    <p>Minimum due {currency.format(debt.minimumDue)}</p>
                    <p>
                      {debt.payoffDate
                        ? `Target ${formatLongDate(debt.payoffDate)}`
                        : 'No payoff target'}
                    </p>
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
              placeholder="What do you want to buy?"
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
                min="0"
                placeholder="Cost"
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
              placeholder="Account name"
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
                min="0"
                placeholder="Current balance"
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
              placeholder="Item name"
              value={netWorthForm.title}
              onChange={(event) =>
                setNetWorthForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <div className="split-row">
              <input
                type="number"
                min="0"
                placeholder="Balance"
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
              placeholder="Scenario name"
              value={scenarioForm.title}
              onChange={(event) =>
                setScenarioForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <div className="split-row">
              <input
                type="number"
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

    if (activeModal === 'insights') {
      const scenarioBars = scenarioImpact
        ? [
          ['Paycheck', scenarioImpact.netPaycheck.delta],
          ['Monthly', scenarioImpact.monthlyNet.delta],
          ['6-month', scenarioImpact.sixMonthCash.delta],
          ['Net worth', scenarioImpact.netWorth.delta],
        ]
        : []
      const maxScenarioDelta = Math.max(
        1,
        ...scenarioBars.map(([, value]) => Math.abs(value as number)),
      )

      return (
        <>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Insights</p>
              <h2>Trends and overviews</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeModal}>
              Close
            </button>
          </div>

          <section className="chart-panel">
            <div className="modal-header compact-modal-header">
              <div>
                <p className="eyebrow">Cash trend</p>
                <h2>Projected balance</h2>
              </div>
            </div>
            <div className="bar-chart">
              {monthlyProjection.map((point) => (
                <div className="bar-row" key={point.month}>
                  <span>{formatMonthLabel(parseDateKey(point.month)).slice(0, 3)}</span>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${point.balance >= 0 ? 'positive' : 'negative'}`}
                      style={{
                        width: `${Math.max(
                          4,
                          Math.abs(point.balance) / maxProjectionMagnitude * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>{currency.format(point.balance)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="chart-panel">
            <div className="modal-header compact-modal-header">
              <div>
                <p className="eyebrow">Spending</p>
                <h2>{formatMonthLabel(currentMonth)} mix</h2>
              </div>
            </div>
            <div className="bar-chart">
              {spendingTrend.length === 0 ? (
                <p className="empty-copy">No spending categories this month yet.</p>
              ) : (
                spendingTrend.map((item) => (
                  <div className="bar-row" key={item.category}>
                    <span>{item.category}</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill spending"
                        style={{
                          width: `${Math.max(4, item.amount / maxSpendingCategory * 100)}%`,
                        }}
                      />
                    </div>
                    <strong>{currency.format(item.amount)}</strong>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="chart-panel">
            <div className="modal-header compact-modal-header">
              <div>
                <p className="eyebrow">Scenario</p>
                <h2>Impact overview</h2>
              </div>
            </div>
            <div className="bar-chart">
              {scenarioBars.length === 0 ? (
                <p className="empty-copy">Create a scenario to see impact bars.</p>
              ) : (
                scenarioBars.map(([label, value]) => (
                  <div className="bar-row" key={label as string}>
                    <span>{label as string}</span>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${(value as number) >= 0 ? 'positive' : 'negative'}`}
                        style={{
                          width: `${Math.max(
                            4,
                            Math.abs(value as number) / maxScenarioDelta * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>{currency.format(value as number)}</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )
    }

    return null
  }

  return (
    <>
      <main className="planner-shell">
        <header className="app-navbar">
          <div className="navbar-brand">
            <p className="eyebrow">Finance tracker</p>
            <strong>{userEmail ? `Planner · ${userEmail}` : 'Planner'}</strong>
            <span className="mode-badge">
              {appMode === 'local' ? 'Local dev' : 'Supabase'}
            </span>
          </div>

          <button
            type="button"
            className="icon-button navbar-toggle"
            onClick={() => setNavOpen((current) => !current)}
            aria-label="Toggle navigation"
          >
            <span />
            <span />
            <span />
          </button>

          <AnimatePresence initial={false}>
            {navOpen ? (
              <motion.nav
                className="app-nav is-open"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {pageTabs.map((tab) => (
                  <button
                    type="button"
                    className={`nav-pill ${activePage === tab.value ? 'active' : ''}`}
                    key={tab.value}
                    onClick={() => {
                      setActivePage(tab.value)
                      setNavOpen(false)
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
                {onModeChange ? (
                  <button
                    type="button"
                    className="nav-pill"
                    onClick={() =>
                      onModeChange(appMode === 'local' ? 'supabase' : 'local')
                    }
                  >
                    {appMode === 'local' ? 'Use Supabase' : 'Use local dev'}
                  </button>
                ) : null}
                {onSignOut ? (
                  <button
                    type="button"
                    className="nav-pill"
                    onClick={() => void onSignOut()}
                  >
                    Sign out
                  </button>
                ) : null}
              </motion.nav>
            ) : null}
          </AnimatePresence>

          <nav className="app-nav desktop-nav">
            {pageTabs.map((tab) => (
              <button
                type="button"
                className={`nav-pill ${activePage === tab.value ? 'active' : ''}`}
                key={tab.value}
                onClick={() => setActivePage(tab.value)}
              >
                {tab.label}
              </button>
            ))}
            {onModeChange ? (
              <button
                type="button"
                className="nav-pill"
                onClick={() => onModeChange(appMode === 'local' ? 'supabase' : 'local')}
              >
                {appMode === 'local' ? 'Use Supabase' : 'Use local dev'}
              </button>
            ) : null}
            {onSignOut ? (
              <button type="button" className="nav-pill" onClick={() => void onSignOut()}>
                Sign out
              </button>
            ) : null}
          </nav>
        </header>

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
                  className="balance-hero balance-trigger"
                  onClick={() => openModal('balanceEdit')}
                >
                  <span>Current cash</span>
                  <strong>{currency.format(currentAvailableBalance)}</strong>
                  <small>Tap to update balance</small>
                </button>
              </div>

              <div className="health-grid">
                <button
                  type="button"
                  className="health-card"
                  onClick={() => openModal('paycheck')}
                >
                  <span>Next paycheck</span>
                  <strong>
                    {nextPaycheck
                      ? `${currency.format(nextPaycheck.amount)}`
                      : 'Not scheduled'}
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
                  <span>Essential bills</span>
                  <strong>{currency.format(essentialMonthlyOutflow)}</strong>
                  <small>Rent and common monthly costs</small>
                </button>
                <button
                  type="button"
                  className="health-card"
                  onClick={() => openModal('benefits')}
                >
                  <span>Benefits & retirement</span>
                  <strong>{currency.format(totalBenefitsPerPaycheck + totalRetirementPerPaycheck)}</strong>
                  <small>Estimated per paycheck</small>
                </button>
                <button
                  type="button"
                  className="health-card"
                  onClick={() => openModal('debt')}
                >
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
                  <strong>
                    {currency.format(emergencyFundPlan.currentSavings)}
                  </strong>
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
                <button
                  type="button"
                  className="health-card"
                  onClick={() => openModal('netWorth')}
                >
                  <span>Net worth</span>
                  <strong>{currency.format(netWorthSummary.netWorth)}</strong>
                  <small>
                    {currency.format(netWorthSummary.totalAssets)} assets •{' '}
                    {currency.format(netWorthSummary.totalLiabilities)} liabilities
                  </small>
                </button>
                <button
                  type="button"
                  className="health-card"
                  onClick={() => openModal('scenarios')}
                >
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
                <button
                  type="button"
                  className="health-card"
                  onClick={() => openModal('insights')}
                >
                  <span>Trend views</span>
                  <strong>{monthlyProjection.length} mo</strong>
                  <small>Cash, spending, and scenario charts</small>
                </button>
                <button
                  type="button"
                  className="health-card"
                  onClick={() => openModal('plan')}
                >
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
                  Schedule expense
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
                          (current) =>
                            new Date(current.getFullYear(), current.getMonth() - 1, 1),
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
                          (current) =>
                            new Date(current.getFullYear(), current.getMonth() + 1, 1),
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
                    const dayItems = allOccurrences.filter(
                      (transaction) => transaction.date === dateKey,
                    )
                    const dayNet = dayItems.reduce(
                      (sum, transaction) =>
                        sum + getSignedAmount(transaction.amount, transaction.type),
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
                        className={`day-cell ${isSelected ? 'selected-day' : ''} ${isToday ? 'today-cell' : ''
                          }`}
                        onClick={() => openDay(dateKey)}
                      >
                        <span className="day-number">{date.getDate()}</span>
                        <div className="indicator-row">
                          {dayItems.slice(0, 4).map((item) => (
                            <span
                              key={item.id}
                              className={`indicator-dot ${item.type}`}
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
                          {dayItems.length > 0
                            ? `End day: ${currency.format(dayEndBalance)}`
                            : ''}
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
                              className={`day-net ${getSignedAmount(transaction.amount, transaction.type) >= 0
                                ? 'positive'
                                : 'negative'
                                }`}
                            >
                              {getSignedAmount(transaction.amount, transaction.type) >= 0
                                ? '+'
                                : '-'}
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
                            <span className="day-net negative">
                              -{currency.format(debt.balance)}
                            </span>
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
                <button type="button" className="action-card" onClick={() => openModal('essentials')}>
                  <span>Rent & essentials</span>
                  <strong>{currency.format(essentialMonthlyOutflow)}</strong>
                  <small>Rent, utilities, groceries, insurance, and core bills.</small>
                </button>
                <button type="button" className="action-card" onClick={() => openModal('recurring')}>
                  <span>Recurring bills</span>
                  <strong>{recurringTransactions.length}</strong>
                  <small>Subscriptions, transfers, debt payments, and other repeats.</small>
                </button>
                <button type="button" className="action-card" onClick={() => openModal('oneTime')}>
                  <span>One-time items</span>
                  <strong>{scheduledTransactions.length}</strong>
                  <small>Irregular purchases, reimbursements, or one-off expenses.</small>
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
                <button type="button" className="action-card" onClick={() => openModal('emergencyFund')}>
                  <span>Emergency fund</span>
                  <strong>{Math.round(emergencyFundProgress.progressPercent)}%</strong>
                  <small>{currency.format(emergencyFundProgress.shortfall)} left to target.</small>
                </button>
                <button type="button" className="action-card" onClick={() => openModal('purchaseGoals')}>
                  <span>Purchase goals</span>
                  <strong>{purchaseGoals.length}</strong>
                  <small>Planned purchases and recommended saving cadence.</small>
                </button>
                <button type="button" className="action-card" onClick={() => openModal('investments')}>
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
                  <strong>{financePlan.targetDate ? currency.format(planProjection) : 'No target'}</strong>
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
                  <strong className={(scenarioImpact?.sixMonthCash.delta ?? 0) >= 0 ? 'positive-text' : 'negative-text'}>
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
      </main>

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
                {renderModalContent()}
              </motion.section>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}

export default Dashboard
