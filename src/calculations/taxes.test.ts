import { describe, expect, it } from 'vitest'
import { estimateAnnualTaxes } from './taxes'

describe('estimateAnnualTaxes', () => {
  it('returns zero taxes for zero income', () => {
    const result = estimateAnnualTaxes({ annualGrossIncome: 0, state: 'FL' })

    expect(result.totalEstimatedTax).toBe(0)
  })

  it('owes no federal tax below the standard deduction', () => {
    const result = estimateAnnualTaxes({
      annualGrossIncome: 16000,
      state: 'FL',
      filingStatus: 'single',
    })

    expect(result.taxableFederalIncome).toBe(0)
    expect(result.estimatedFederalTax).toBe(0)
    // FICA still applies from the first dollar.
    expect(result.socialSecurityTax).toBeCloseTo(16000 * 0.062, 2)
    expect(result.medicareTax).toBeCloseTo(16000 * 0.0145, 2)
  })

  it('applies the 2026 single brackets progressively', () => {
    // 76,100 gross - 16,100 standard deduction = 60,000 taxable.
    const result = estimateAnnualTaxes({
      annualGrossIncome: 76100,
      state: 'FL',
      filingStatus: 'single',
    })

    const expectedFederal =
      12400 * 0.1 + (50400 - 12400) * 0.12 + (60000 - 50400) * 0.22

    expect(result.taxableFederalIncome).toBe(60000)
    expect(result.estimatedFederalTax).toBeCloseTo(expectedFederal, 2)
  })

  it('uses the married filing jointly brackets and deduction', () => {
    // 76,100 gross - 32,200 standard deduction = 43,900 taxable.
    const result = estimateAnnualTaxes({
      annualGrossIncome: 76100,
      state: 'FL',
      filingStatus: 'married_joint',
    })

    const expectedFederal = 24800 * 0.1 + (43900 - 24800) * 0.12

    expect(result.taxableFederalIncome).toBe(43900)
    expect(result.estimatedFederalTax).toBeCloseTo(expectedFederal, 2)

    const single = estimateAnnualTaxes({
      annualGrossIncome: 76100,
      state: 'FL',
      filingStatus: 'single',
    })

    expect(result.estimatedFederalTax).toBeLessThan(single.estimatedFederalTax)
  })

  it('uses the head of household brackets and deduction', () => {
    // 44,150 gross - 24,150 standard deduction = 20,000 taxable.
    const result = estimateAnnualTaxes({
      annualGrossIncome: 44150,
      state: 'FL',
      filingStatus: 'head_of_household',
    })

    const expectedFederal = 17700 * 0.1 + (20000 - 17700) * 0.12

    expect(result.estimatedFederalTax).toBeCloseTo(expectedFederal, 2)
  })

  it('caps Social Security at the 2026 wage base', () => {
    const result = estimateAnnualTaxes({
      annualGrossIncome: 300000,
      state: 'FL',
      filingStatus: 'single',
    })

    expect(result.socialSecurityTax).toBeCloseTo(184500 * 0.062, 2)
  })

  it('adds the additional Medicare tax above the threshold', () => {
    const result = estimateAnnualTaxes({
      annualGrossIncome: 300000,
      state: 'FL',
      filingStatus: 'single',
    })

    expect(result.medicareTax).toBeCloseTo(300000 * 0.0145 + 100000 * 0.009, 2)
  })

  it('skips state tax in no-income-tax states and applies the flat rate elsewhere', () => {
    const florida = estimateAnnualTaxes({ annualGrossIncome: 80000, state: 'fl' })
    const georgia = estimateAnnualTaxes({ annualGrossIncome: 80000, state: 'GA' })

    expect(florida.estimatedStateTax).toBe(0)
    expect(georgia.estimatedStateTax).toBeCloseTo(80000 * 0.04, 2)
  })

  it('keeps FICA on retirement contributions while exempting cafeteria benefits', () => {
    const result = estimateAnnualTaxes({
      annualGrossIncome: 100000,
      // 6,000 retirement + 4,000 benefits reduce federal taxable income.
      preTaxDeductions: 10000,
      // Only the 4,000 in benefits reduces FICA wages.
      ficaExemptDeductions: 4000,
      state: 'FL',
      filingStatus: 'single',
    })

    expect(result.taxableFederalIncome).toBe(100000 - 10000 - 16100)
    expect(result.socialSecurityTax).toBeCloseTo(96000 * 0.062, 2)
    expect(result.medicareTax).toBeCloseTo(96000 * 0.0145, 2)
  })
})
