import type {
  CalendarOccurrence,
  DebtPlan,
  FinancePlan,
  PaycheckRule,
  RecurringTransaction,
  ScheduledTransaction,
  TransactionType,
} from '../types/finance'
import {
  clampDayOfMonth,
  formatDateKey,
  getFirstWeekdayOnOrAfter,
  getMonthsBetween,
  parseDateKey,
  startOfMonth,
} from '../utils/dates'

export function getCalendarDays(month: Date) {
  const first = startOfMonth(month)
  const offset = first.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const trailingSlots =
    (offset + daysInMonth) % 7 === 0 ? 0 : 7 - ((offset + daysInMonth) % 7)

  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index + 1),
    ),
    ...Array.from({ length: trailingSlots }, () => null),
  ]
}

export function getSignedAmount(amount: number, type: TransactionType) {
  return type === 'income' ? amount : -amount
}

type OccurrenceInput = {
  currentMonth: Date
  today: Date
  scheduledTransactions: ScheduledTransaction[]
  recurringTransactions: RecurringTransaction[]
  paycheckRules: PaycheckRule[]
  debtPlans: DebtPlan[]
  financePlan: FinancePlan
}

export function buildCalendarOccurrences({
  currentMonth,
  today,
  scheduledTransactions,
  recurringTransactions,
  paycheckRules,
  debtPlans,
  financePlan,
}: OccurrenceInput) {
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

  const furthestDate = rangeDates.reduce(
    (latest, current) => (current > latest ? current : latest),
    today,
  )

  const recurringOccurrences = getMonthsBetween(recurrenceStart, furthestDate).flatMap(
    (month) =>
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
              category: transaction.category ?? 'Recurring',
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
                  originType: 'recurring',
                  title: transaction.title,
                  amount: transaction.amount,
                  date: occurrenceKey,
                  type: transaction.type,
                  category: transaction.category ?? 'Recurring',
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

  const paycheckOccurrences = getMonthsBetween(recurrenceStart, furthestDate).flatMap(
    (month) =>
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
              date: formatDateKey(new Date(month.getFullYear(), month.getMonth(), day)),
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
                originType: 'paycheck',
                title: paycheck.title,
                amount: paycheck.amount,
                date: formatDateKey(cursor),
                type: 'income',
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
}

export function projectBalance(
  currentBalance: number,
  occurrences: CalendarOccurrence[],
  todayKey: string,
  targetDateKey: string,
) {
  return (
    currentBalance +
    occurrences
      .filter(
        (transaction) =>
          transaction.date >= todayKey && transaction.date <= targetDateKey,
      )
      .reduce(
        (sum, transaction) =>
          sum + getSignedAmount(transaction.amount, transaction.type),
        0,
      )
  )
}
