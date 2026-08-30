export type ModalView =
  | 'balanceEdit'
  | 'day'
  | 'oneTime'
  | 'recurring'
  | 'paycheck'
  | 'incomeModel'
  | 'benefits'
  | 'bankSync'
  | 'essentials'
  | 'emergencyFund'
  | 'investments'
  | 'netWorth'
  | 'scenarios'
  | 'debt'
  | 'plan'
  | 'purchaseGoals'
  | null

export type PageView =
  | 'dashboard'
  | 'cashFlow'
  | 'goals'
  | 'scenarios'
  | 'insights'

export const pageTabs: { label: string; value: PageView }[] = [
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Cash Flow', value: 'cashFlow' },
  { label: 'Goals', value: 'goals' },
  { label: 'Scenarios', value: 'scenarios' },
  { label: 'Insights', value: 'insights' },
]
