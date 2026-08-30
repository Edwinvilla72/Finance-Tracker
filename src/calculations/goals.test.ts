import { describe, expect, it } from 'vitest'
import {
  assessGoalFeasibility,
  convertCadenceAmountToMonthly,
  getMonthsUntil,
  summarizeGoalPortfolio,
} from './goals'

const today = new Date(2026, 7, 30)

describe('getMonthsUntil', () => {
  it('counts the current month as one saving opportunity', () => {
    expect(getMonthsUntil(today, '2026-08-31')).toBe(1)
  })

  it('counts whole months through the target month', () => {
    expect(getMonthsUntil(today, '2026-12-15')).toBe(5)
    expect(getMonthsUntil(today, '2027-08-01')).toBe(13)
  })

  it('never returns less than one month for past dates', () => {
    expect(getMonthsUntil(today, '2026-01-01')).toBe(1)
  })
})

describe('convertCadenceAmountToMonthly', () => {
  it('converts weekly and biweekly amounts to monthly equivalents', () => {
    expect(convertCadenceAmountToMonthly(120, 'monthly')).toBe(120)
    expect(convertCadenceAmountToMonthly(120, 'weekly')).toBeCloseTo(520)
    expect(convertCadenceAmountToMonthly(120, 'biweekly')).toBeCloseTo(260)
  })
})

describe('assessGoalFeasibility', () => {
  it('marks a goal funded when the projected balance already covers it', () => {
    const result = assessGoalFeasibility({
      amountNeeded: 2000,
      targetDate: '2026-12-31',
      today,
      projectedBalanceAtTarget: 2500,
      monthlySurplus: 100,
    })

    expect(result.status).toBe('funded')
    expect(result.fundedPercent).toBe(100)
    expect(result.monthlyShortfall).toBe(0)
  })

  it('marks a goal on track when the surplus covers the required saving', () => {
    const result = assessGoalFeasibility({
      amountNeeded: 2500,
      targetDate: '2026-12-31',
      today,
      projectedBalanceAtTarget: 500,
      monthlySurplus: 600,
    })

    expect(result.status).toBe('on_track')
    expect(result.monthsUntilTarget).toBe(5)
    expect(result.requiredMonthlySaving).toBe(500)
    expect(result.monthlyShortfall).toBe(0)
    expect(result.fundedPercent).toBe(20)
  })

  it('marks a goal a stretch when the surplus covers most of the required saving', () => {
    const result = assessGoalFeasibility({
      amountNeeded: 2500,
      targetDate: '2026-12-31',
      today,
      projectedBalanceAtTarget: 0,
      monthlySurplus: 350,
    })

    expect(result.status).toBe('stretch')
    expect(result.monthlyShortfall).toBe(150)
  })

  it('marks a goal at risk when the surplus falls well short', () => {
    const result = assessGoalFeasibility({
      amountNeeded: 2500,
      targetDate: '2026-12-31',
      today,
      projectedBalanceAtTarget: 0,
      monthlySurplus: 100,
    })

    expect(result.status).toBe('at_risk')
    expect(result.monthlyShortfall).toBe(400)
  })

  it('computes the earliest feasible month-end at the current surplus', () => {
    const result = assessGoalFeasibility({
      amountNeeded: 2500,
      targetDate: '2026-10-01',
      today,
      projectedBalanceAtTarget: 0,
      monthlySurplus: 500,
    })

    // 2500 / 500 = 5 months from August 2026 lands at the end of January 2027.
    expect(result.earliestFeasibleDate).toBe('2027-01-31')
  })

  it('returns no feasible date when there is no surplus', () => {
    const result = assessGoalFeasibility({
      amountNeeded: 2500,
      targetDate: '2026-10-01',
      today,
      projectedBalanceAtTarget: 0,
      monthlySurplus: 0,
    })

    expect(result.earliestFeasibleDate).toBeNull()
    expect(result.status).toBe('at_risk')
  })

  it('treats a zero-amount goal as funded today', () => {
    const result = assessGoalFeasibility({
      amountNeeded: 0,
      targetDate: '2026-10-01',
      today,
      projectedBalanceAtTarget: 0,
      monthlySurplus: 0,
    })

    expect(result.status).toBe('funded')
    expect(result.earliestFeasibleDate).toBe('2026-08-30')
  })
})

describe('summarizeGoalPortfolio', () => {
  it('reports no goals when nothing requires saving', () => {
    const result = summarizeGoalPortfolio([], 500)

    expect(result.status).toBe('no_goals')
    expect(result.requiredMonthlyTotal).toBe(0)
    expect(result.freeAfterGoals).toBe(500)
  })

  it('reports comfortable when goals use a modest share of the surplus', () => {
    const result = summarizeGoalPortfolio([100, 200], 500)

    expect(result.status).toBe('comfortable')
    expect(result.commitmentPercent).toBe(60)
    expect(result.freeAfterGoals).toBe(200)
  })

  it('reports tight when goals nearly consume the surplus', () => {
    const result = summarizeGoalPortfolio([250, 200], 500)

    expect(result.status).toBe('tight')
  })

  it('reports overcommitted when goals exceed the surplus', () => {
    const result = summarizeGoalPortfolio([400, 200], 500)

    expect(result.status).toBe('overcommitted')
    expect(result.freeAfterGoals).toBe(-100)
  })

  it('reports overcommitted with goals but no surplus', () => {
    const result = summarizeGoalPortfolio([100], 0)

    expect(result.status).toBe('overcommitted')
    expect(result.commitmentPercent).toBeNull()
  })

  it('ignores negative required amounts', () => {
    const result = summarizeGoalPortfolio([-50, 100], 500)

    expect(result.requiredMonthlyTotal).toBe(100)
  })
})
