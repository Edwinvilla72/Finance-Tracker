import { describe, expect, it } from 'vitest'
import { buildCalendarOccurrences } from './cashFlow'
import type { RecurringTransaction } from '../types/finance'

const today = new Date(2026, 7, 31)

const rent: RecurringTransaction = {
  id: 1,
  title: 'Rent',
  amount: 1200,
  frequency: 'monthly',
  dayOfMonth: 1,
  type: 'expense',
  category: 'Housing',
  startDate: '2026-08-01',
}

function buildWith(overrides: Partial<Parameters<typeof buildCalendarOccurrences>[0]>) {
  return buildCalendarOccurrences({
    currentMonth: today,
    today,
    scheduledTransactions: [],
    recurringTransactions: [rent],
    paycheckRules: [],
    debtPlans: [],
    financePlan: { targetAmount: 0, targetDate: '' },
    ...overrides,
  })
}

describe('buildCalendarOccurrences horizon', () => {
  it('generates recurring occurrences through the projection window, not just the visible month', () => {
    const occurrences = buildWith({})
    const rentDates = occurrences
      .filter((occurrence) => occurrence.originId === rent.id)
      .map((occurrence) => occurrence.date)

    // Six months ahead of August 2026 is February 2027.
    expect(rentDates).toContain('2026-09-01')
    expect(rentDates).toContain('2027-02-01')
  })

  it('extends the horizon to cover purchase goal target dates', () => {
    const occurrences = buildWith({
      purchaseGoals: [
        { id: 9, title: 'Trip', cost: 3000, targetDate: '2027-08-15' },
      ],
    })
    const rentDates = occurrences
      .filter((occurrence) => occurrence.originId === rent.id)
      .map((occurrence) => occurrence.date)

    expect(rentDates).toContain('2027-08-01')
  })

  it('generates weekly recurring occurrences on every selected weekday', () => {
    const groceries: RecurringTransaction = {
      id: 2,
      title: 'Groceries',
      amount: 80,
      frequency: 'weekly',
      weekdays: [1, 4],
      type: 'expense',
      startDate: '2026-08-31',
    }
    const occurrences = buildWith({ recurringTransactions: [groceries] })
    const septemberDates = occurrences
      .filter(
        (occurrence) =>
          occurrence.originId === groceries.id && occurrence.date.startsWith('2026-09'),
      )
      .map((occurrence) => occurrence.date)
      .sort()

    // September 2026 has four Mondays after the start date and four Thursdays.
    expect(septemberDates).toEqual([
      '2026-09-03',
      '2026-09-07',
      '2026-09-10',
      '2026-09-14',
      '2026-09-17',
      '2026-09-21',
      '2026-09-24',
      '2026-09-28',
    ])
  })
})
