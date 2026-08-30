import {
  assessGoalFeasibility,
  summarizeGoalPortfolio,
  type GoalFeasibility,
  type GoalPortfolioSummary,
} from '../../calculations/goals'
import { calculateEmergencyFundProgress } from '../../calculations/emergencyFund'
import type {
  DebtPlan,
  EmergencyFundPlan,
  FinancePlan,
  PurchaseGoal,
} from '../../types/finance'
import { formatDateKey, formatShortDate } from '../../utils/dates'

export type GoalItemKind = 'purchase' | 'target' | 'debt' | 'emergency'

export type GoalItem = {
  key: string
  kind: GoalItemKind
  originId: number | null
  title: string
  targetLabel: string
  amount: number
  feasibility: GoalFeasibility
  progressPercent: number | null
}

type GoalItemsInput = {
  purchaseGoals: PurchaseGoal[]
  financePlan: FinancePlan
  debtPlans: DebtPlan[]
  emergencyFundPlan: EmergencyFundPlan
  fallbackEssentialExpenses: number
  monthlySurplus: number
  projectedBalance: (targetDateKey: string) => number
  today: Date
}

// Builds one unified list from every goal-shaped thing the user tracks so the
// Goals page and the dashboard strip can treat them consistently.
export function buildGoalItems({
  purchaseGoals,
  financePlan,
  debtPlans,
  emergencyFundPlan,
  fallbackEssentialExpenses,
  monthlySurplus,
  projectedBalance,
  today,
}: GoalItemsInput): GoalItem[] {
  const items: GoalItem[] = []

  const essentialExpenses =
    emergencyFundPlan.monthlyEssentialExpenses || fallbackEssentialExpenses
  const emergencyProgress = calculateEmergencyFundProgress(
    emergencyFundPlan.currentSavings,
    essentialExpenses,
    emergencyFundPlan.targetMonths || 3,
  )

  if (emergencyProgress.targetAmount > 0) {
    // The emergency fund has no deadline, so feasibility is judged against a
    // 12-month build pace. Its savings live outside the cash flow forecast,
    // which is why the projected balance passed in is zero.
    const twelveMonthsOut = formatDateKey(
      new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()),
    )

    items.push({
      key: 'emergency',
      kind: 'emergency',
      originId: null,
      title: 'Emergency fund',
      targetLabel: `${emergencyFundPlan.targetMonths || 3} months of essentials`,
      amount: emergencyProgress.targetAmount,
      feasibility: assessGoalFeasibility({
        amountNeeded: emergencyProgress.shortfall,
        targetDate: twelveMonthsOut,
        today,
        projectedBalanceAtTarget: 0,
        monthlySurplus,
      }),
      progressPercent: emergencyProgress.progressPercent,
    })
  }

  if (financePlan.targetDate && financePlan.targetAmount > 0) {
    const feasibility = assessGoalFeasibility({
      amountNeeded: financePlan.targetAmount,
      targetDate: financePlan.targetDate,
      today,
      projectedBalanceAtTarget: projectedBalance(financePlan.targetDate),
      monthlySurplus,
    })

    items.push({
      key: 'target',
      kind: 'target',
      originId: null,
      title: 'Balance target',
      targetLabel: `by ${formatShortDate(financePlan.targetDate)}`,
      amount: financePlan.targetAmount,
      feasibility,
      progressPercent: feasibility.fundedPercent,
    })
  }

  const sortedPurchaseGoals = [...purchaseGoals].sort((left, right) =>
    left.targetDate.localeCompare(right.targetDate),
  )

  for (const goal of sortedPurchaseGoals) {
    const feasibility = assessGoalFeasibility({
      amountNeeded: goal.cost,
      targetDate: goal.targetDate,
      today,
      projectedBalanceAtTarget: projectedBalance(goal.targetDate),
      monthlySurplus,
    })

    items.push({
      key: `purchase-${goal.id}`,
      kind: 'purchase',
      originId: goal.id,
      title: goal.title,
      targetLabel: `by ${formatShortDate(goal.targetDate)}`,
      amount: goal.cost,
      feasibility,
      progressPercent: feasibility.fundedPercent,
    })
  }

  for (const debt of debtPlans) {
    if (!debt.payoffDate) {
      continue
    }

    // Debt payoff is judged purely on the required payment pace. The cash
    // forecast is not treated as money set aside for the debt, so there is no
    // funded progress to show.
    items.push({
      key: `debt-${debt.id}`,
      kind: 'debt',
      originId: debt.id,
      title: `Pay off ${debt.title}`,
      targetLabel: `by ${formatShortDate(debt.payoffDate)}`,
      amount: debt.balance,
      feasibility: assessGoalFeasibility({
        amountNeeded: debt.balance,
        targetDate: debt.payoffDate,
        today,
        projectedBalanceAtTarget: 0,
        monthlySurplus,
      }),
      progressPercent: null,
    })
  }

  return items
}

export function summarizeGoalItems(
  items: GoalItem[],
  monthlySurplus: number,
): GoalPortfolioSummary {
  return summarizeGoalPortfolio(
    items.map((item) => item.feasibility.requiredMonthlySaving),
    monthlySurplus,
  )
}
