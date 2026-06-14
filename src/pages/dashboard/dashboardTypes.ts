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
  | 'insights'
  | 'debt'
  | 'allDebts'
  | 'plan'
  | 'purchaseGoals'
  | null

export type PageView =
  | 'dashboard'
  | 'calendar'
  | 'cashFlow'
  | 'planning'
  | 'scenarios'
  | 'insights'

export const pageTabs: { label: string; value: PageView }[] = [
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Cash Flow', value: 'cashFlow' },
  { label: 'Planning', value: 'planning' },
  { label: 'Scenarios', value: 'scenarios' },
  { label: 'Insights', value: 'insights' },
]
