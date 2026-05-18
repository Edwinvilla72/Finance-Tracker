export type TransactionType = 'income' | 'expense' | 'transfer' | 'debt'

export type Cadence = 'weekly' | 'biweekly' | 'monthly'

export type ScheduledTransaction = {
  id: number
  title: string
  amount: number
  date: string
  type: TransactionType
  category?: string
}

export type RecurringTransaction = {
  id: number
  title: string
  amount: number
  frequency: 'monthly' | 'weekly'
  dayOfMonth?: number
  weekdays?: number[]
  type: Exclude<TransactionType, 'income'>
  category?: string
  startDate?: string
  endDate?: string
}

export type PaycheckRule = {
  id: number
  title: string
  amount: number
  frequency: 'monthly' | 'weekly' | 'biweekly'
  dayOfMonth?: number
  weekday?: number
  startDate?: string
}

export type DebtPlan = {
  id: number
  title: string
  balance: number
  minimumDue: number
  dueDate: string
  payoffDate: string
  apr?: number
  extraPayment?: number
  payoffCadence?: Cadence
  payoffMode?: 'amount' | 'percent'
  payoffValue?: number
}

export type FinancePlan = {
  targetAmount: number
  targetDate: string
}

export type PurchaseGoal = {
  id: number
  title: string
  cost: number
  targetDate: string
  savingsCadence?: Cadence
}

export type CalendarOccurrence = {
  id: string
  originId: number
  originType: 'single' | 'recurring' | 'paycheck'
  title: string
  amount: number
  date: string
  type: TransactionType
  category?: string
}

export type PersistedState = {
  currentBalanceInput: string
  scheduledTransactions: ScheduledTransaction[]
  recurringTransactions: RecurringTransaction[]
  paycheckRules: PaycheckRule[]
  debtPlans: DebtPlan[]
  financePlan: FinancePlan
  purchaseGoals: PurchaseGoal[]
  financialProfile: FinancialProfile
  emergencyFundPlan: EmergencyFundPlan
  investmentAccounts: InvestmentAccount[]
  netWorthItems: NetWorthItem[]
  scenarioPlans: ScenarioPlan[]
}

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household'

export type IncomeSource = {
  id: number
  name: string
  type: 'salary' | 'hourly' | 'contract' | 'other'
  amount: number
  hoursPerWeek?: number
  payFrequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
}

export type BenefitElection = {
  id: number
  name: string
  type:
    | 'health'
    | 'dental'
    | 'vision'
    | 'life'
    | 'disability'
    | 'accident'
    | 'critical_illness'
    | 'hospital_indemnity'
    | 'hsa'
    | 'fsa'
    | 'other'
  amountPerPaycheck: number
  taxTreatment: 'pre_tax' | 'post_tax'
}

export type RetirementContribution = {
  id: number
  accountType: 'traditional_401k' | 'roth_401k' | 'traditional_ira' | 'roth_ira'
  contributionMode: 'percent' | 'amount'
  contributionValue: number
  employerMatchPercent?: number
  employerMatchLimitPercent?: number
}

export type FinancialProfile = {
  state: string
  filingStatus: FilingStatus
  incomeSources: IncomeSource[]
  benefitElections: BenefitElection[]
  retirementContributions: RetirementContribution[]
}

export type EmergencyFundPlan = {
  currentSavings: number
  monthlyEssentialExpenses: number
  targetMonths: number
}

export type InvestmentAccount = {
  id: number
  title: string
  accountType: 'brokerage' | 'traditional_401k' | 'roth_401k' | 'ira' | 'roth_ira' | 'hsa' | 'other'
  balance: number
  monthlyContribution: number
  annualReturnRate: number
}

export type NetWorthItem = {
  id: number
  title: string
  balance: number
  kind: 'asset' | 'liability'
  category: 'cash' | 'investment' | 'property' | 'vehicle' | 'debt' | 'other'
}

export type ScenarioPlan = {
  id: number
  title: string
  incomeChangePercent: number
  rentChange: number
  benefitChangePerPaycheck: number
  retirementContributionChangePercent: number
  extraDebtPayment: number
  oneTimePurchase: number
  investmentContributionChange: number
}
