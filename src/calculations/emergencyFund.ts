export function calculateEmergencyFundProgress(
  currentSavings: number,
  monthlyEssentialExpenses: number,
  targetMonths: number,
) {
  const targetAmount = Math.max(0, monthlyEssentialExpenses * targetMonths)

  return {
    targetAmount,
    progressPercent: targetAmount > 0 ? Math.min(100, currentSavings / targetAmount * 100) : 0,
    shortfall: Math.max(0, targetAmount - currentSavings),
  }
}
