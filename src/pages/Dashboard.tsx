import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type TransactionType = 'income' | 'expense' | 'transfer' | 'debt'

type ScheduledTransaction = {
  id: number
  title: string
  amount: number
  date: string
  type: TransactionType
  category?: string
}

type RecurringTransaction = {
  id: number
  title: string
  amount: number
  frequency: 'monthly' | 'weekly'
  dayOfMonth?: number
  weekdays?: number[]
  type: Exclude<TransactionType, 'income'>
  startDate?: string
  endDate?: string
}

type PaycheckRule = {
  id: number
  title: string
  amount: number
  frequency: 'monthly' | 'weekly' | 'biweekly'
  dayOfMonth?: number
  weekday?: number
  startDate?: string
}

type DebtPlan = {
  id: number
  title: string
  balance: number
  minimumDue: number
  dueDate: string
  payoffDate: string
  payoffCadence?: 'weekly' | 'biweekly' | 'monthly'
  payoffMode?: 'amount' | 'percent'
  payoffValue?: number
}

type FinancePlan = {
  targetAmount: number
  targetDate: string
}

type PurchaseGoal = {
  id: number
  title: string
  cost: number
  targetDate: string
  savingsCadence?: 'weekly' | 'biweekly' | 'monthly'
}

type CalendarOccurrence = {
  id: string
  originId: number
  originType: 'single' | 'recurring' | 'paycheck'
  title: string
  amount: number
  date: string
  type: TransactionType
  category?: string
}

type ModalView =
  | 'balanceEdit'
  | 'day'
  | 'oneTime'
  | 'recurring'
  | 'paycheck'
  | 'debt'
  | 'allDebts'
  | 'plan'
  | 'purchaseGoals'
  | null

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const weekdayOptions = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]
const STORAGE_KEY = 'finance-tracker-dashboard'
const DASHBOARD_STATE_TABLE = 'dashboard_states'

type PersistedState = {
  currentBalanceInput: string
  scheduledTransactions: ScheduledTransaction[]
  recurringTransactions: RecurringTransaction[]
  paycheckRules: PaycheckRule[]
  debtPlans: DebtPlan[]
  financePlan: FinancePlan
  purchaseGoals: PurchaseGoal[]
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

function getDefaultPersistedState(): PersistedState {
  return {
    currentBalanceInput: '',
    scheduledTransactions: [],
    recurringTransactions: [],
    paycheckRules: [],
    debtPlans: [],
    financePlan: {
      targetAmount: 0,
      targetDate: '',
    },
    purchaseGoals: [],
  }
}

function normalizePersistedState(value?: Partial<PersistedState> | null): PersistedState {
  const defaults = getDefaultPersistedState()

  return {
    currentBalanceInput: value?.currentBalanceInput ?? defaults.currentBalanceInput,
    scheduledTransactions: value?.scheduledTransactions ?? defaults.scheduledTransactions,
    recurringTransactions: value?.recurringTransactions ?? defaults.recurringTransactions,
    paycheckRules: value?.paycheckRules ?? defaults.paycheckRules,
    debtPlans: value?.debtPlans ?? defaults.debtPlans,
    financePlan: value?.financePlan ?? defaults.financePlan,
    purchaseGoals: value?.purchaseGoals ?? defaults.purchaseGoals,
  }
}

function mergeById<T extends { id: number }>(remote: T[], local: T[]) {
  const merged = new Map<number, T>()

  for (const item of remote) {
    merged.set(item.id, item)
  }

  for (const item of local) {
    merged.set(item.id, item)
  }

  return Array.from(merged.values())
}

function mergePersistedStates(
  remote?: Partial<PersistedState> | null,
  local?: Partial<PersistedState> | null,
): PersistedState {
  const remoteState = normalizePersistedState(remote)
  const localState = normalizePersistedState(local)

  return {
    currentBalanceInput:
      localState.currentBalanceInput || remoteState.currentBalanceInput,
    scheduledTransactions: mergeById(
      remoteState.scheduledTransactions,
      localState.scheduledTransactions,
    ),
    recurringTransactions: mergeById(
      remoteState.recurringTransactions,
      localState.recurringTransactions,
    ),
    paycheckRules: mergeById(remoteState.paycheckRules, localState.paycheckRules),
    debtPlans: mergeById(remoteState.debtPlans, localState.debtPlans),
    financePlan:
      localState.financePlan.targetDate || localState.financePlan.targetAmount
        ? localState.financePlan
        : remoteState.financePlan,
    purchaseGoals: mergeById(remoteState.purchaseGoals, localState.purchaseGoals),
  }
}

function clearPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLongDate(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function clampDayOfMonth(year: number, month: number, dayOfMonth: number) {
  return Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate())
}

function getMonthsBetween(start: Date, end: Date) {
  const months: Date[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const limit = new Date(end.getFullYear(), end.getMonth(), 1)

  while (cursor <= limit) {
    months.push(new Date(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}

function getCalendarDays(month: Date) {
  const first = startOfMonth(month)
  const offset = first.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const trailingSlots = (offset + daysInMonth) % 7 === 0 ? 0 : 7 - ((offset + daysInMonth) % 7)

  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index + 1),
    ),
    ...Array.from({ length: trailingSlots }, () => null),
  ]
}

function getSignedAmount(amount: number, type: TransactionType) {
  return type === 'income' ? amount : -amount
}

function getMonthlyAmountNeeded(balance: number, payoffDate: string) {
  if (!payoffDate) {
    return balance
  }

  const today = new Date()
  const end = parseDateKey(payoffDate)
  const months =
    (end.getFullYear() - today.getFullYear()) * 12 +
    (end.getMonth() - today.getMonth()) +
    1

  return months > 0 ? balance / months : balance
}

function getCadenceLabel(cadence: 'weekly' | 'biweekly' | 'monthly') {
  if (cadence === 'weekly') {
    return 'weekly'
  }

  if (cadence === 'biweekly') {
    return 'biweekly'
  }

  return 'monthly'
}

function getPaymentCount(startDate: Date, endDateKey: string, cadence: 'weekly' | 'biweekly' | 'monthly') {
  const endDate = parseDateKey(endDateKey)

  if (endDate < startDate) {
    return 1
  }

  if (cadence === 'monthly') {
    const months =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) +
      1

    return Math.max(1, months)
  }

  const diffDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  )
  const interval = cadence === 'weekly' ? 7 : 14

  return Math.max(1, Math.floor(diffDays / interval) + 1)
}

function getRecommendedPayment(
  balance: number,
  payoffDate: string,
  cadence: 'weekly' | 'biweekly' | 'monthly',
  startDate: Date,
) {
  return balance / getPaymentCount(startDate, payoffDate, cadence)
}

function getFirstWeekdayOnOrAfter(date: Date, weekday: number) {
  const result = new Date(date)
  const offset = (weekday - result.getDay() + 7) % 7
  result.setDate(result.getDate() + offset)
  return result
}

function getWeekdayList(days: number[]) {
  return days.map((day) => weekdayOptions[day]?.label).filter(Boolean).join(', ')
}

type DashboardProps = {
  userId?: string
  userEmail?: string
  onSignOut?: () => Promise<void> | void
}

function Dashboard({ userId, userEmail, onSignOut }: DashboardProps) {
  const today = useMemo(() => new Date(), [])
  const todayKey = formatDateKey(today)
  const defaultState = useMemo(() => getDefaultPersistedState(), [])

  const [navOpen, setNavOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalView>(null)
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
  const [paycheckForm, setPaycheckForm] = useState({
    title: 'Paycheck',
    amount: '',
    frequency: 'monthly' as PaycheckRule['frequency'],
    dayOfMonth: '',
    weekday: '5',
    startDate: todayKey,
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
  })
  const [purchaseGoalForm, setPurchaseGoalForm] = useState({
    title: '',
    cost: '',
    targetDate: '',
    savingsCadence: 'monthly' as 'weekly' | 'biweekly' | 'monthly',
  })

  const allOccurrences = useMemo(() => {
    const visibleMonthStart = startOfMonth(currentMonth)
    const currentMonthStart = startOfMonth(today)
    const recurrenceStart =
      visibleMonthStart < currentMonthStart ? visibleMonthStart : currentMonthStart

    const rangeDates = [
      ...scheduledTransactions.map((transaction) => parseDateKey(transaction.date)),
      ...debtPlans
        .flatMap((debt) => [debt.dueDate, debt.payoffDate])
        .filter(Boolean)
        .map((value) => parseDateKey(value)),
      financePlan.targetDate ? parseDateKey(financePlan.targetDate) : today,
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0),
    ]

    const furthestDate = rangeDates.reduce((latest, current) =>
      current > latest ? current : latest,
      today,
    )

    const recurringOccurrences = getMonthsBetween(
      recurrenceStart,
      furthestDate,
    ).flatMap((month) =>
      recurringTransactions.flatMap((transaction) => {
        if (transaction.frequency === 'monthly' && transaction.dayOfMonth) {
          const day = clampDayOfMonth(
            month.getFullYear(),
            month.getMonth(),
            transaction.dayOfMonth,
          )
          const occurrenceDate = new Date(month.getFullYear(), month.getMonth(), day)
          const occurrenceKey = formatDateKey(occurrenceDate)

          if (transaction.startDate && occurrenceKey < transaction.startDate) {
            return []
          }

          if (transaction.endDate && occurrenceKey > transaction.endDate) {
            return []
          }

          return [
            {
              id: `recurring-${transaction.id}-${month.getFullYear()}-${month.getMonth()}`,
              originId: transaction.id,
              originType: 'recurring' as const,
              title: transaction.title,
              amount: transaction.amount,
              date: occurrenceKey,
              type: transaction.type,
              category: 'Recurring',
            },
          ]
        }

        if (transaction.frequency === 'weekly' && transaction.weekdays?.length) {
          const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
          const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
          const occurrences: CalendarOccurrence[] = []

          for (const weekday of transaction.weekdays) {
            const cursor = getFirstWeekdayOnOrAfter(monthStart, weekday)

            while (cursor <= monthEnd) {
              const occurrenceKey = formatDateKey(cursor)

              if (
                (!transaction.startDate || occurrenceKey >= transaction.startDate) &&
                (!transaction.endDate || occurrenceKey <= transaction.endDate)
              ) {
                occurrences.push({
                  id: `recurring-${transaction.id}-${occurrenceKey}-${weekday}`,
                  originId: transaction.id,
                  originType: 'recurring' as const,
                  title: transaction.title,
                  amount: transaction.amount,
                  date: occurrenceKey,
                  type: transaction.type,
                  category: 'Recurring',
                })
              }

              cursor.setDate(cursor.getDate() + 7)
            }
          }

          return occurrences
        }

        return []
      }),
    )

    const paycheckOccurrences = getMonthsBetween(
      recurrenceStart,
      furthestDate,
    ).flatMap((month) =>
      paycheckRules.flatMap((paycheck) => {
        if (paycheck.frequency === 'monthly' && paycheck.dayOfMonth) {
          const day = clampDayOfMonth(
            month.getFullYear(),
            month.getMonth(),
            paycheck.dayOfMonth,
          )

          return [
            {
              id: `paycheck-${paycheck.id}-${month.getFullYear()}-${month.getMonth()}`,
              originId: paycheck.id,
              originType: 'paycheck' as const,
              title: paycheck.title,
              amount: paycheck.amount,
              date: formatDateKey(
                new Date(month.getFullYear(), month.getMonth(), day),
              ),
              type: 'income' as const,
              category: 'Paycheck',
            },
          ]
        }

        if (
          (paycheck.frequency === 'weekly' || paycheck.frequency === 'biweekly') &&
          typeof paycheck.weekday === 'number'
        ) {
          const interval = paycheck.frequency === 'weekly' ? 7 : 14
          const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
          const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
          const anchor = paycheck.startDate
            ? parseDateKey(paycheck.startDate)
            : getFirstWeekdayOnOrAfter(recurrenceStart, paycheck.weekday)

          const firstOccurrence =
            anchor > monthStart
              ? new Date(anchor)
              : getFirstWeekdayOnOrAfter(monthStart, paycheck.weekday)

          while (firstOccurrence < anchor) {
            firstOccurrence.setDate(firstOccurrence.getDate() + interval)
          }

          const occurrences: CalendarOccurrence[] = []
          const cursor = new Date(firstOccurrence)

          while (cursor <= monthEnd) {
            const diffDays = Math.round(
              (cursor.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24),
            )

            if (diffDays >= 0 && diffDays % interval === 0) {
              occurrences.push({
                id: `paycheck-${paycheck.id}-${formatDateKey(cursor)}`,
                originId: paycheck.id,
                originType: 'paycheck' as const,
                title: paycheck.title,
                amount: paycheck.amount,
                date: formatDateKey(cursor),
                type: 'income' as const,
                category: 'Paycheck',
              })
            }

            cursor.setDate(cursor.getDate() + 7)
          }

          return occurrences
        }

        return []
      }),
    )

    const manualOccurrences = scheduledTransactions.map((transaction) => ({
      id: `single-${transaction.id}`,
      originId: transaction.id,
      originType: 'single' as const,
      title: transaction.title,
      amount: transaction.amount,
      date: transaction.date,
      type: transaction.type,
      category: transaction.category,
    }))

    return [...manualOccurrences, ...recurringOccurrences, ...paycheckOccurrences].sort(
      (left, right) =>
        parseDateKey(left.date).getTime() - parseDateKey(right.date).getTime(),
    )
  }, [
    currentMonth,
    debtPlans,
    financePlan.targetDate,
    paycheckRules,
    recurringTransactions,
    scheduledTransactions,
    today,
  ])

  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth])
  const selectedDayTransactions = allOccurrences.filter(
    (transaction) => transaction.date === selectedDateKey,
  )
  const currentBalance =
    currentBalanceInput.trim() === '' ? 0 : Number(currentBalanceInput)
  const projectedBalance = (targetDateKey: string) =>
    currentBalance +
    allOccurrences
      .filter(
        (transaction) =>
          transaction.date >= todayKey && transaction.date <= targetDateKey,
      )
      .reduce(
        (sum, transaction) =>
          sum + getSignedAmount(transaction.amount, transaction.type),
        0,
      )
  const currentAvailableBalance = projectedBalance(todayKey)
  const selectedDayBalance = projectedBalance(selectedDateKey)
  const totalDebt = debtPlans.reduce((sum, debt) => sum + debt.balance, 0)
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

  useEffect(() => {
    if (!userId) {
      setSyncReady(true)
      return
    }

    let active = true

    async function hydrateFromCloud() {
      const localState = normalizePersistedState(loadPersistedState())
      const { data, error } = await supabase
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

      if (shouldBackfillLocal) {
        const { error: upsertError } = await supabase
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
    if (!userId || !syncReady) {
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
    }

    const timeoutId = window.setTimeout(async () => {
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
    financePlan,
    paycheckRules,
    purchaseGoals,
    recurringTransactions,
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
                        className={`day-net ${
                          getSignedAmount(transaction.amount, transaction.type) >= 0
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

    return null
  }

  return (
    <>
      <main className="planner-shell">
        <header className="app-navbar">
          <div className="navbar-brand">
            <p className="eyebrow">Finance tracker</p>
            <strong>{userEmail ? `Planner · ${userEmail}` : 'Planner'}</strong>
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
                <button type="button" className="nav-pill" onClick={() => openModal('recurring')}>
                  Recurring
                </button>
                <button type="button" className="nav-pill" onClick={() => openModal('paycheck')}>
                  Paychecks
                </button>
                <button type="button" className="nav-pill" onClick={() => openModal('oneTime')}>
                  One-time
                </button>
                <button type="button" className="nav-pill" onClick={() => openModal('debt')}>
                  Debt & dues
                </button>
                <button type="button" className="nav-pill" onClick={() => openModal('allDebts')}>
                  All debts
                </button>
                <button type="button" className="nav-pill" onClick={() => openModal('plan')}>
                  Finance plan
                </button>
                <button
                  type="button"
                  className="nav-pill"
                  onClick={() => openModal('purchaseGoals')}
                >
                  Purchase goals
                </button>
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
            <button type="button" className="nav-pill" onClick={() => openModal('recurring')}>
              Recurring
            </button>
            <button type="button" className="nav-pill" onClick={() => openModal('paycheck')}>
              Paychecks
            </button>
            <button type="button" className="nav-pill" onClick={() => openModal('oneTime')}>
              One-time
            </button>
            <button type="button" className="nav-pill" onClick={() => openModal('debt')}>
              Debt & dues
            </button>
            <button type="button" className="nav-pill" onClick={() => openModal('allDebts')}>
              All debts
            </button>
            <button type="button" className="nav-pill" onClick={() => openModal('plan')}>
              Finance plan
            </button>
            <button
              type="button"
              className="nav-pill"
              onClick={() => openModal('purchaseGoals')}
            >
              Purchase goals
            </button>
            {onSignOut ? (
              <button type="button" className="nav-pill" onClick={() => void onSignOut()}>
                Sign out
              </button>
            ) : null}
          </nav>
        </header>

        <section className="dashboard-layout">
          <section className="balance-card">
            <div className="summary-row">
              <button
                type="button"
                className="summary-stat summary-balance balance-trigger"
                onClick={() => openModal('balanceEdit')}
              >
                <span>Available balance</span>
                <strong>{currency.format(currentAvailableBalance)}</strong>
              </button>
              <div className="summary-stat">
                <span>Projected end of {formatMonthLabel(currentMonth)}</span>
                <strong>{currency.format(projectedMonthEndBalance)}</strong>
              </div>
              <div className="summary-stat">
                <span>Projected target</span>
                <strong>
                  {financePlan.targetDate ? currency.format(planProjection) : 'No target yet'}
                </strong>
              </div>
              <div className="summary-stat">
                <span>Nearest purchase goal</span>
                <strong>
                  {nearestPurchaseGoal
                    ? `${nearestPurchaseGoal.title} · ${currency.format(nearestPurchaseGoal.cost)}`
                    : 'No goals yet'}
                </strong>
              </div>
              <div className="debt-total-pill">
                <span>Total debt</span>
                <strong>{currency.format(totalDebt)}</strong>
              </div>
            </div>
          </section>

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
                      className={`day-cell ${isSelected ? 'selected-day' : ''} ${
                        isToday ? 'today-cell' : ''
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
