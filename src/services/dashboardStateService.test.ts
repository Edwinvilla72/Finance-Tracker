import { describe, expect, it } from 'vitest'
import {
  clampProjectionMonths,
  DEFAULT_ASSUMPTIONS,
  getDefaultPersistedState,
  mergePersistedStates,
  normalizePersistedState,
} from './dashboardStateService'

describe('clampProjectionMonths', () => {
  it('keeps values inside the allowed range', () => {
    expect(clampProjectionMonths(6)).toBe(6)
    expect(clampProjectionMonths(24)).toBe(24)
  })

  it('rounds fractional values', () => {
    expect(clampProjectionMonths(8.6)).toBe(9)
  })

  it('falls back to the default for invalid values', () => {
    expect(clampProjectionMonths(0)).toBe(DEFAULT_ASSUMPTIONS.projectionMonths)
    expect(clampProjectionMonths(Number.NaN)).toBe(
      DEFAULT_ASSUMPTIONS.projectionMonths,
    )
  })

  it('caps values above the maximum', () => {
    expect(clampProjectionMonths(60)).toBe(24)
  })
})

describe('normalizePersistedState', () => {
  it('fills assumptions defaults for legacy payloads', () => {
    const normalized = normalizePersistedState({ currentBalanceInput: '100' })

    expect(normalized.assumptions).toEqual(DEFAULT_ASSUMPTIONS)
    expect(normalized.setupGuideDismissed).toBe(false)
  })

  it('keeps valid stored assumptions and clamps invalid ones', () => {
    const normalized = normalizePersistedState({
      assumptions: { stateTaxRatePercent: 5.75, projectionMonths: 40 },
      setupGuideDismissed: true,
    })

    expect(normalized.assumptions.stateTaxRatePercent).toBe(5.75)
    expect(normalized.assumptions.projectionMonths).toBe(24)
    expect(normalized.setupGuideDismissed).toBe(true)
  })

  it('rejects negative tax rates', () => {
    const normalized = normalizePersistedState({
      assumptions: { stateTaxRatePercent: -2, projectionMonths: 6 },
    })

    expect(normalized.assumptions.stateTaxRatePercent).toBe(
      DEFAULT_ASSUMPTIONS.stateTaxRatePercent,
    )
  })
})

describe('mergePersistedStates', () => {
  it('prefers customized local assumptions over remote ones', () => {
    const merged = mergePersistedStates(
      { assumptions: { stateTaxRatePercent: 3, projectionMonths: 9 } },
      { assumptions: { stateTaxRatePercent: 5, projectionMonths: 12 } },
    )

    expect(merged.assumptions).toEqual({
      stateTaxRatePercent: 5,
      projectionMonths: 12,
    })
  })

  it('falls back to remote assumptions when local ones are the defaults', () => {
    const merged = mergePersistedStates(
      { assumptions: { stateTaxRatePercent: 3, projectionMonths: 9 } },
      { assumptions: { ...DEFAULT_ASSUMPTIONS } },
    )

    expect(merged.assumptions).toEqual({
      stateTaxRatePercent: 3,
      projectionMonths: 9,
    })
  })

  it('keeps the setup guide dismissed if either side dismissed it', () => {
    expect(
      mergePersistedStates({ setupGuideDismissed: true }, {}).setupGuideDismissed,
    ).toBe(true)
    expect(
      mergePersistedStates({}, { setupGuideDismissed: true }).setupGuideDismissed,
    ).toBe(true)
    expect(mergePersistedStates({}, {}).setupGuideDismissed).toBe(false)
  })

  it('merges list entries by id', () => {
    const remoteGoal = { id: 1, title: 'Remote', cost: 100, targetDate: '2027-01-01' }
    const localGoal = { id: 2, title: 'Local', cost: 200, targetDate: '2027-02-01' }
    const merged = mergePersistedStates(
      { purchaseGoals: [remoteGoal] },
      { purchaseGoals: [localGoal] },
    )

    expect(merged.purchaseGoals).toHaveLength(2)
  })

  it('round-trips the default state unchanged', () => {
    expect(normalizePersistedState(getDefaultPersistedState())).toEqual(
      getDefaultPersistedState(),
    )
  })
})
