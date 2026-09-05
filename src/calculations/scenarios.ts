export type ScenarioComparison<T> = {
  baseline: T
  scenario: T
}

export function compareNumberScenario({ baseline, scenario }: ScenarioComparison<number>) {
  return {
    baseline,
    scenario,
    delta: scenario - baseline,
    percentChange: baseline === 0 ? 0 : (scenario - baseline) / baseline * 100,
  }
}

export type ScenarioProjectionInput = {
  monthlyNet: number
  // Projected cash at the end of the horizon window (horizonMonths ahead).
  sixMonthCash: number
  netPaycheck: number
  netWorth: number
  totalDebt: number
  investmentFiveYearValue: number
  incomeChangePercent: number
  rentChange: number
  benefitChangePerPaycheck: number
  retirementContributionChangePercent: number
  extraDebtPayment: number
  oneTimePurchase: number
  investmentContributionChange: number
  paychecksPerMonth?: number
  horizonMonths?: number
}

export function projectScenarioImpact({
  monthlyNet,
  sixMonthCash,
  netPaycheck,
  netWorth,
  totalDebt,
  investmentFiveYearValue,
  incomeChangePercent,
  rentChange,
  benefitChangePerPaycheck,
  retirementContributionChangePercent,
  extraDebtPayment,
  oneTimePurchase,
  investmentContributionChange,
  paychecksPerMonth = 2,
  horizonMonths = 6,
}: ScenarioProjectionInput) {
  const paycheckIncomeDelta = netPaycheck * (incomeChangePercent / 100)
  const retirementDelta = netPaycheck * (retirementContributionChangePercent / 100)
  const netPaycheckScenario =
    netPaycheck + paycheckIncomeDelta - benefitChangePerPaycheck - retirementDelta
  const monthlyScenario =
    monthlyNet +
    (netPaycheckScenario - netPaycheck) * paychecksPerMonth -
    rentChange -
    extraDebtPayment -
    investmentContributionChange
  const sixMonthScenario =
    sixMonthCash +
    (monthlyScenario - monthlyNet) * horizonMonths -
    oneTimePurchase
  const totalDebtScenario = Math.max(0, totalDebt - extraDebtPayment * horizonMonths)
  const netWorthScenario =
    netWorth +
    (sixMonthScenario - sixMonthCash) +
    extraDebtPayment * horizonMonths -
    oneTimePurchase
  const investmentFiveYearScenario =
    investmentFiveYearValue + investmentContributionChange * 60

  return {
    netPaycheck: compareNumberScenario({
      baseline: netPaycheck,
      scenario: netPaycheckScenario,
    }),
    monthlyNet: compareNumberScenario({
      baseline: monthlyNet,
      scenario: monthlyScenario,
    }),
    sixMonthCash: compareNumberScenario({
      baseline: sixMonthCash,
      scenario: sixMonthScenario,
    }),
    totalDebt: compareNumberScenario({
      baseline: totalDebt,
      scenario: totalDebtScenario,
    }),
    netWorth: compareNumberScenario({
      baseline: netWorth,
      scenario: netWorthScenario,
    }),
    investmentFiveYearValue: compareNumberScenario({
      baseline: investmentFiveYearValue,
      scenario: investmentFiveYearScenario,
    }),
  }
}
