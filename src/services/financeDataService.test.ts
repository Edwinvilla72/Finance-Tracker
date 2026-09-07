import { describe, expect, it } from 'vitest'
import { getDefaultPersistedState } from './dashboardStateService'
import { diffFinanceState, isEmptySyncPlan } from './financeDataService'
import type { PersistedState } from '../types/finance'

const userId = 'user-1'

function stateWith(overrides: Partial<PersistedState>): PersistedState {
  return { ...getDefaultPersistedState(), ...overrides }
}

describe('diffFinanceState', () => {
  it('produces an empty plan when nothing changed', () => {
    const state = stateWith({
      scheduledTransactions: [
        { id: 'a', title: 'Rent', amount: 1200, date: '2026-10-01', type: 'expense' },
      ],
    })

    expect(isEmptySyncPlan(diffFinanceState(userId, state, state))).toBe(true)
  })

  it('writes every row when there is no previous snapshot', () => {
    const state = stateWith({
      currentBalanceInput: '500',
      paycheckRules: [
        { id: 'p1', title: 'Paycheck', amount: 2000, frequency: 'monthly', dayOfMonth: 1 },
      ],
    })
    const plan = diffFinanceState(userId, null, state)

    expect(plan.settings).toMatchObject({ user_id: userId, current_balance: 500 })
    expect(plan.lists).toEqual([
      {
        table: 'paycheck_rules',
        upserts: [
          {
            id: 'p1',
            user_id: userId,
            title: 'Paycheck',
            amount: 2000,
            frequency: 'monthly',
            day_of_month: 1,
            weekday: null,
            start_date: null,
          },
        ],
        deleteIds: [],
      },
    ])
  })

  it('upserts added and changed items and deletes removed ones', () => {
    const before = stateWith({
      purchaseGoals: [
        { id: 'g1', title: 'Trip', cost: 3000, targetDate: '2027-08-15' },
        { id: 'g2', title: 'Laptop', cost: 1500, targetDate: '2027-01-01' },
      ],
    })
    const after = stateWith({
      purchaseGoals: [
        { id: 'g1', title: 'Trip', cost: 3500, targetDate: '2027-08-15' },
        { id: 'g3', title: 'Bike', cost: 800, targetDate: '2027-03-01' },
      ],
    })
    const plan = diffFinanceState(userId, before, after)
    const goals = plan.lists.find((sync) => sync.table === 'purchase_goals')

    expect(goals?.upserts.map((row) => row.id)).toEqual(['g1', 'g3'])
    expect(goals?.deleteIds).toEqual(['g2'])
    expect(plan.settings).toBeNull()
  })

  it('treats scenario order as data so making a scenario active is persisted', () => {
    const first = { id: 's1', title: 'A', incomeChangePercent: 0, rentChange: 0, benefitChangePerPaycheck: 0, retirementContributionChangePercent: 0, extraDebtPayment: 0, oneTimePurchase: 0, investmentContributionChange: 0 }
    const second = { ...first, id: 's2', title: 'B' }
    const before = stateWith({ scenarioPlans: [first, second] })
    const after = stateWith({ scenarioPlans: [second, first] })
    const plan = diffFinanceState(userId, before, after)
    const scenarios = plan.lists.find((sync) => sync.table === 'scenario_plans')

    expect(scenarios?.upserts.map((row) => [row.id, row.position])).toEqual([
      ['s2', 0],
      ['s1', 1],
    ])
  })

  it('splits the financial profile into its own tables', () => {
    const before = getDefaultPersistedState()
    const after = stateWith({
      financialProfile: {
        state: 'GA',
        filingStatus: 'married_joint',
        incomeSources: [
          { id: 'i1', name: 'Primary income', type: 'salary', amount: 70000, payFrequency: 'biweekly' },
        ],
        benefitElections: [],
        retirementContributions: [],
      },
    })
    const plan = diffFinanceState(userId, before, after)

    expect(plan.financialProfile).toEqual({
      user_id: userId,
      state: 'GA',
      filing_status: 'married_joint',
    })
    expect(plan.lists.map((sync) => sync.table)).toEqual(['income_sources'])
  })

  it('stores an empty balance input as zero without flagging a change', () => {
    const before = stateWith({ currentBalanceInput: '' })
    const after = stateWith({ currentBalanceInput: '0' })

    expect(diffFinanceState(userId, before, after).settings).toBeNull()
  })
})
