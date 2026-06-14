import type { PersistedState } from '../types/finance'

export const STORAGE_KEY = 'finance-tracker-dashboard'
export const DASHBOARD_STATE_TABLE = 'dashboard_states'

export function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

export function savePersistedState(payload: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    return
  }
}

export function getDefaultPersistedState(): PersistedState {
  return {
    currentBalanceInput: '',
    bankBalanceSource: 'manual',
    scheduledTransactions: [],
    recurringTransactions: [],
    paycheckRules: [],
    debtPlans: [],
    financePlan: {
      targetAmount: 0,
      targetDate: '',
    },
    purchaseGoals: [],
    financialProfile: {
      state: 'FL',
      filingStatus: 'single',
      incomeSources: [],
      benefitElections: [],
      retirementContributions: [],
    },
    emergencyFundPlan: {
      currentSavings: 0,
      monthlyEssentialExpenses: 0,
      targetMonths: 3,
    },
    investmentAccounts: [],
    netWorthItems: [],
    scenarioPlans: [],
  }
}

export function normalizePersistedState(
  value?: Partial<PersistedState> | null,
): PersistedState {
  const defaults = getDefaultPersistedState()

  return {
    currentBalanceInput: value?.currentBalanceInput ?? defaults.currentBalanceInput,
    bankBalanceSource: value?.bankBalanceSource ?? defaults.bankBalanceSource,
    scheduledTransactions: value?.scheduledTransactions ?? defaults.scheduledTransactions,
    recurringTransactions: value?.recurringTransactions ?? defaults.recurringTransactions,
    paycheckRules: value?.paycheckRules ?? defaults.paycheckRules,
    debtPlans: value?.debtPlans ?? defaults.debtPlans,
    financePlan: value?.financePlan ?? defaults.financePlan,
    purchaseGoals: value?.purchaseGoals ?? defaults.purchaseGoals,
    financialProfile: {
      state: value?.financialProfile?.state ?? defaults.financialProfile.state,
      filingStatus:
        value?.financialProfile?.filingStatus ?? defaults.financialProfile.filingStatus,
      incomeSources:
        value?.financialProfile?.incomeSources ??
        defaults.financialProfile.incomeSources,
      benefitElections:
        value?.financialProfile?.benefitElections ??
        defaults.financialProfile.benefitElections,
      retirementContributions:
        value?.financialProfile?.retirementContributions ??
        defaults.financialProfile.retirementContributions,
    },
    emergencyFundPlan: {
      currentSavings:
        value?.emergencyFundPlan?.currentSavings ??
        defaults.emergencyFundPlan.currentSavings,
      monthlyEssentialExpenses:
        value?.emergencyFundPlan?.monthlyEssentialExpenses ??
        defaults.emergencyFundPlan.monthlyEssentialExpenses,
      targetMonths:
        value?.emergencyFundPlan?.targetMonths ??
        defaults.emergencyFundPlan.targetMonths,
    },
    investmentAccounts: value?.investmentAccounts ?? defaults.investmentAccounts,
    netWorthItems: value?.netWorthItems ?? defaults.netWorthItems,
    scenarioPlans: value?.scenarioPlans ?? defaults.scenarioPlans,
  }
}

function mergeById<T extends { id: number }>(remote: T[], local: T[]) {
  const merged = new Map<number, T>()

  for (const item of remote) {
    merged.set(item.id, item)
  }

  for (const item of local) {
    merged.set(item.id, item)
  }

  return Array.from(merged.values())
}

export function mergePersistedStates(
  remote?: Partial<PersistedState> | null,
  local?: Partial<PersistedState> | null,
): PersistedState {
  const defaults = getDefaultPersistedState()
  const remoteState = normalizePersistedState(remote)
  const localState = normalizePersistedState(local)

  return {
    currentBalanceInput:
      localState.currentBalanceInput || remoteState.currentBalanceInput,
    bankBalanceSource:
      localState.bankBalanceSource !== defaults.bankBalanceSource
        ? localState.bankBalanceSource
        : remoteState.bankBalanceSource,
    scheduledTransactions: mergeById(
      remoteState.scheduledTransactions,
      localState.scheduledTransactions,
    ),
    recurringTransactions: mergeById(
      remoteState.recurringTransactions,
      localState.recurringTransactions,
    ),
    paycheckRules: mergeById(remoteState.paycheckRules, localState.paycheckRules),
    debtPlans: mergeById(remoteState.debtPlans, localState.debtPlans),
    financePlan:
      localState.financePlan.targetDate || localState.financePlan.targetAmount
        ? localState.financePlan
        : remoteState.financePlan,
    purchaseGoals: mergeById(remoteState.purchaseGoals, localState.purchaseGoals),
    financialProfile:
      localState.financialProfile.incomeSources.length ||
      localState.financialProfile.benefitElections.length ||
      localState.financialProfile.retirementContributions.length
        ? localState.financialProfile
        : remoteState.financialProfile,
    emergencyFundPlan:
      localState.emergencyFundPlan.currentSavings ||
      localState.emergencyFundPlan.monthlyEssentialExpenses
        ? localState.emergencyFundPlan
        : remoteState.emergencyFundPlan,
    investmentAccounts: mergeById(
      remoteState.investmentAccounts,
      localState.investmentAccounts,
    ),
    netWorthItems: mergeById(remoteState.netWorthItems, localState.netWorthItems),
    scenarioPlans: mergeById(remoteState.scenarioPlans, localState.scenarioPlans),
  }
}

export function clearPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}
