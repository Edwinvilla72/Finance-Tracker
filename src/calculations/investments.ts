export type GrowthProjectionInput = {
  startingBalance: number
  monthlyContribution: number
  annualReturnRate: number
  years: number
}

export function projectInvestmentGrowth({
  startingBalance,
  monthlyContribution,
  annualReturnRate,
  years,
}: GrowthProjectionInput) {
  const monthlyRate = annualReturnRate / 100 / 12
  const months = Math.max(0, Math.round(years * 12))
  const points: { month: number; balance: number }[] = []
  let balance = startingBalance

  for (let month = 1; month <= months; month += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
    points.push({ month, balance })
  }

  return points
}
