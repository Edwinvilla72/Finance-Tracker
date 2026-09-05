import { describe, expect, it } from 'vitest'
import { estimateAnnualTaxes } from './taxes'
import { estimatePaycheck, getAnnualGrossIncome } from './paycheck'
import type { IncomeSource } from '../types/finance'

const salary: IncomeSource = {
  id: 1,
  name: 'Job',
  type: 'salary',
  amount: 62400,
  payFrequency: 'biweekly',
}

describe('getAnnualGrossIncome', () => {
  it('returns the salary amount directly', () => {
    expect(getAnnualGrossIncome(salary)).toBe(62400)
  })

  it('annualizes hourly income from rate and weekly hours', () => {
    expect(
      getAnnualGrossIncome({
        id: 2,
        name: 'Hourly job',
        type: 'hourly',
        amount: 25,
        hoursPerWeek: 40,
        payFrequency: 'weekly',
      }),
    ).toBe(25 * 40 * 52)
  })

  it('defaults hourly income to 40 hours per week', () => {
    expect(
      getAnnualGrossIncome({
        id: 3,
        name: 'Hourly job',
        type: 'hourly',
        amount: 30,
        payFrequency: 'weekly',
      }),
    ).toBe(30 * 40 * 52)
  })
})

describe('estimatePaycheck', () => {
  it('splits gross pay by pay frequency', () => {
    const biweekly = estimatePaycheck({ income: salary, state: 'FL' })
    const semimonthly = estimatePaycheck({
      income: { ...salary, payFrequency: 'semimonthly' },
      state: 'FL',
    })

    expect(biweekly.grossPerPaycheck).toBeCloseTo(62400 / 26, 2)
    expect(semimonthly.grossPerPaycheck).toBeCloseTo(62400 / 24, 2)
  })

  it('nets out taxes and deductions per paycheck', () => {
    const result = estimatePaycheck({
      income: salary,
      state: 'FL',
      filingStatus: 'single',
      benefitElections: [
        {
          id: 1,
          name: 'Health',
          type: 'health',
          amountPerPaycheck: 100,
          taxTreatment: 'pre_tax',
        },
        {
          id: 2,
          name: 'Life',
          type: 'life',
          amountPerPaycheck: 20,
          taxTreatment: 'post_tax',
        },
      ],
      retirementContributions: [
        {
          id: 3,
          accountType: 'traditional_401k',
          contributionMode: 'percent',
          contributionValue: 5,
        },
      ],
    })

    const grossPerPaycheck = 62400 / 26
    const retirementPerPaycheck = grossPerPaycheck * 0.05
    const expectedTaxes = estimateAnnualTaxes({
      annualGrossIncome: 62400,
      preTaxDeductions: (100 + retirementPerPaycheck) * 26,
      ficaExemptDeductions: 100 * 26,
      state: 'FL',
      filingStatus: 'single',
    })

    expect(result.preTaxDeductionsPerPaycheck).toBe(100)
    expect(result.postTaxDeductionsPerPaycheck).toBe(20)
    expect(result.retirementContributionPerPaycheck).toBeCloseTo(
      retirementPerPaycheck,
      2,
    )
    expect(result.estimatedTaxPerPaycheck).toBeCloseTo(
      expectedTaxes.totalEstimatedTax / 26,
      2,
    )
    expect(result.estimatedNetPaycheck).toBeCloseTo(
      grossPerPaycheck -
        expectedTaxes.totalEstimatedTax / 26 -
        100 -
        20 -
        retirementPerPaycheck,
      2,
    )
  })

  it('keeps FICA on retirement contributions', () => {
    const withRetirement = estimatePaycheck({
      income: salary,
      state: 'FL',
      retirementContributions: [
        {
          id: 1,
          accountType: 'traditional_401k',
          contributionMode: 'amount',
          contributionValue: 200,
        },
      ],
    })
    const withBenefit = estimatePaycheck({
      income: salary,
      state: 'FL',
      benefitElections: [
        {
          id: 1,
          name: 'Health',
          type: 'health',
          amountPerPaycheck: 200,
          taxTreatment: 'pre_tax',
        },
      ],
    })

    // Same federal treatment, but the benefit also skips FICA, so the
    // retirement version pays more total tax.
    expect(withRetirement.estimatedTaxPerPaycheck).toBeGreaterThan(
      withBenefit.estimatedTaxPerPaycheck,
    )
    expect(
      withRetirement.estimatedTaxPerPaycheck - withBenefit.estimatedTaxPerPaycheck,
    ).toBeCloseTo(200 * 0.0765, 2)
  })
})
