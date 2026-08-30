import type { Cadence } from '../types/finance'
import { formatDateKey, parseDateKey } from '../utils/dates'

export type GoalFeasibilityStatus = 'funded' | 'on_track' | 'stretch' | 'at_risk'

export type GoalFeasibilityInput = {
  amountNeeded: number
  targetDate: string
  today: Date
  projectedBalanceAtTarget: number
  monthlySurplus: number
}

export type GoalFeasibility = {
  status: GoalFeasibilityStatus
  monthsUntilTarget: number
  requiredMonthlySaving: number
  monthlyShortfall: number
  fundedPercent: number
  earliestFeasibleDate: string | null
}

// A goal counts as a "stretch" while the surplus covers at least this share
// of the required saving; below it the goal is at risk.
const STRETCH_COVERAGE_THRESHOLD = 0.6

// Whole months from today through the target month, matching the payment
// counting convention in debtPayoff.ts (a target this month still means one
// saving opportunity).
export function getMonthsUntil(today: Date, targetDateKey: string) {
  const target = parseDateKey(targetDateKey)
  const months =
    (target.getFullYear() - today.getFullYear()) * 12 +
    (target.getMonth() - today.getMonth()) +
    1

  return Math.max(1, months)
}

export function convertCadenceAmountToMonthly(amount: number, cadence: Cadence) {
  if (cadence === 'weekly') {
    return amount * 52 / 12
  }

  if (cadence === 'biweekly') {
    return amount * 26 / 12
  }

  return amount
}

export function assessGoalFeasibility({
  amountNeeded,
  targetDate,
  today,
  projectedBalanceAtTarget,
  monthlySurplus,
}: GoalFeasibilityInput): GoalFeasibility {
  const monthsUntilTarget = getMonthsUntil(today, targetDate)
  const safeAmount = Math.max(0, amountNeeded)
  const isFunded = safeAmount === 0 || projectedBalanceAtTarget >= safeAmount
  // A funded goal is already covered by the projected schedule, so no extra
  // saving is required on top of it.
  const requiredMonthlySaving = isFunded ? 0 : safeAmount / monthsUntilTarget
  const availableSurplus = Math.max(0, monthlySurplus)
  const monthlyShortfall = Math.max(0, requiredMonthlySaving - availableSurplus)
  const fundedPercent =
    safeAmount === 0
      ? 100
      : Math.min(100, Math.max(0, projectedBalanceAtTarget) / safeAmount * 100)

  const status: GoalFeasibilityStatus = isFunded
    ? 'funded'
    : availableSurplus >= requiredMonthlySaving
      ? 'on_track'
      : availableSurplus >= requiredMonthlySaving * STRETCH_COVERAGE_THRESHOLD
        ? 'stretch'
        : 'at_risk'

  return {
    status,
    monthsUntilTarget,
    requiredMonthlySaving,
    monthlyShortfall,
    fundedPercent,
    earliestFeasibleDate: getEarliestFeasibleDate(safeAmount, monthlySurplus, today),
  }
}

// The first month-end by which the goal amount is covered when the full
// monthly surplus goes toward it. Null when there is no surplus to save.
function getEarliestFeasibleDate(
  amountNeeded: number,
  monthlySurplus: number,
  today: Date,
) {
  if (amountNeeded <= 0) {
    return formatDateKey(today)
  }

  if (monthlySurplus <= 0) {
    return null
  }

  const monthsNeeded = Math.ceil(amountNeeded / monthlySurplus)

  return formatDateKey(
    new Date(today.getFullYear(), today.getMonth() + monthsNeeded + 1, 0),
  )
}

export type GoalPortfolioStatus = 'comfortable' | 'tight' | 'overcommitted' | 'no_goals'

export type GoalPortfolioSummary = {
  status: GoalPortfolioStatus
  requiredMonthlyTotal: number
  monthlySurplus: number
  freeAfterGoals: number
  commitmentPercent: number | null
}

// Goals feel comfortable while they use at most this share of the surplus.
const COMFORTABLE_COMMITMENT_THRESHOLD = 0.7

export function summarizeGoalPortfolio(
  requiredMonthlyAmounts: number[],
  monthlySurplus: number,
): GoalPortfolioSummary {
  const requiredMonthlyTotal = requiredMonthlyAmounts.reduce(
    (sum, amount) => sum + Math.max(0, amount),
    0,
  )
  const freeAfterGoals = monthlySurplus - requiredMonthlyTotal
  const commitmentPercent =
    monthlySurplus > 0 ? requiredMonthlyTotal / monthlySurplus * 100 : null

  const status: GoalPortfolioStatus =
    requiredMonthlyTotal === 0
      ? 'no_goals'
      : monthlySurplus <= 0
        ? 'overcommitted'
        : requiredMonthlyTotal <= monthlySurplus * COMFORTABLE_COMMITMENT_THRESHOLD
          ? 'comfortable'
          : requiredMonthlyTotal <= monthlySurplus
            ? 'tight'
            : 'overcommitted'

  return {
    status,
    requiredMonthlyTotal,
    monthlySurplus,
    freeAfterGoals,
    commitmentPercent,
  }
}

export const goalStatusLabels: Record<GoalFeasibilityStatus, string> = {
  funded: 'Funded',
  on_track: 'On track',
  stretch: 'Stretch',
  at_risk: 'At risk',
}

export const portfolioStatusLabels: Record<GoalPortfolioStatus, string> = {
  comfortable: 'Comfortable',
  tight: 'Tight',
  overcommitted: 'Overcommitted',
  no_goals: 'No goals yet',
}
