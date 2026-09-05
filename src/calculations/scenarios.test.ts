import { describe, expect, it } from 'vitest'
import { projectScenarioImpact } from './scenarios'

const baseline = {
  monthlyNet: 500,
  sixMonthCash: 5000,
  netPaycheck: 2000,
  netWorth: 20000,
  totalDebt: 6000,
  investmentFiveYearValue: 10000,
  incomeChangePercent: 0,
  rentChange: 0,
  benefitChangePerPaycheck: 0,
  retirementContributionChangePercent: 0,
  extraDebtPayment: 0,
  oneTimePurchase: 0,
  investmentContributionChange: 0,
}

describe('projectScenarioImpact', () => {
  it('returns zero deltas for an empty scenario', () => {
    const impact = projectScenarioImpact(baseline)

    expect(impact.sixMonthCash.delta).toBe(0)
    expect(impact.netWorth.delta).toBe(0)
  })

  it('scales cash and debt impact with the horizon', () => {
    const sixMonths = projectScenarioImpact({ ...baseline, extraDebtPayment: 100 })
    const twelveMonths = projectScenarioImpact({
      ...baseline,
      extraDebtPayment: 100,
      horizonMonths: 12,
    })

    expect(sixMonths.sixMonthCash.delta).toBe(-600)
    expect(twelveMonths.sixMonthCash.delta).toBe(-1200)
    expect(sixMonths.totalDebt.delta).toBe(-600)
    expect(twelveMonths.totalDebt.delta).toBe(-1200)
  })

  it('keeps net worth neutral when extra debt payments come from cash', () => {
    const impact = projectScenarioImpact({ ...baseline, extraDebtPayment: 100 })

    // Cash drops by the payments while debt drops equally, so net worth holds.
    expect(impact.netWorth.delta).toBe(0)
  })
})
