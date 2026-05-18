import type { CalendarOccurrence } from '../types/finance'
import { formatDateKey } from '../utils/dates'
import { projectBalance } from './cashFlow'

export function projectBalanceMonths(
  startingBalance: number,
  occurrences: CalendarOccurrence[],
  today: Date,
  monthCount: number,
) {
  const todayKey = formatDateKey(today)

  return Array.from({ length: monthCount }, (_, index) => {
    const target = new Date(today.getFullYear(), today.getMonth() + index + 1, 0)
    const targetDateKey = formatDateKey(target)

    return {
      month: targetDateKey,
      balance: projectBalance(startingBalance, occurrences, todayKey, targetDateKey),
    }
  })
}
