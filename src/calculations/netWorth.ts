export type NetWorthItem = {
  id: number
  name: string
  balance: number
}

export function calculateNetWorth(assets: NetWorthItem[], liabilities: NetWorthItem[]) {
  const totalAssets = assets.reduce((sum, asset) => sum + asset.balance, 0)
  const totalLiabilities = liabilities.reduce(
    (sum, liability) => sum + liability.balance,
    0,
  )

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  }
}
