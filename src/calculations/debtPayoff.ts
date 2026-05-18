import type { Cadence } from '../types/finance'
import { parseDateKey } from '../utils/dates'

export function getMonthlyAmountNeeded(balance: number, payoffDate: string) {
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

export function getCadenceLabel(cadence: Cadence) {
  if (cadence === 'weekly') {
    return 'weekly'
  }

  if (cadence === 'biweekly') {
    return 'biweekly'
  }

  return 'monthly'
}

export function getPaymentCount(startDate: Date, endDateKey: string, cadence: Cadence) {
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

export function getRecommendedPayment(
  balance: number,
  payoffDate: string,
  cadence: Cadence,
  startDate: Date,
) {
  return balance / getPaymentCount(startDate, payoffDate, cadence)
}

export type DebtAmortizationInput = {
  balance: number
  apr: number
  monthlyPayment: number
}

export function estimateDebtAmortization({
  balance,
  apr,
  monthlyPayment,
}: DebtAmortizationInput) {
  const monthlyRate = Math.max(0, apr) / 100 / 12
  let remainingBalance = Math.max(0, balance)
  let totalInterest = 0
  let months = 0

  if (monthlyPayment <= 0) {
    return {
      months,
      totalInterest,
      finalBalance: remainingBalance,
      isPayoffPossible: false,
    }
  }

  while (remainingBalance > 0 && months < 600) {
    const interest = remainingBalance * monthlyRate
    const principalPayment = monthlyPayment - interest

    if (principalPayment <= 0) {
      return {
        months,
        totalInterest,
        finalBalance: remainingBalance,
        isPayoffPossible: false,
      }
    }

    totalInterest += interest
    remainingBalance = Math.max(0, remainingBalance - principalPayment)
    months += 1
  }

  return {
    months,
    totalInterest,
    finalBalance: remainingBalance,
    isPayoffPossible: remainingBalance === 0,
  }
}
