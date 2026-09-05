import type { FilingStatus } from '../types/finance'

// Federal figures for tax year 2026, from IRS Rev. Proc. 2025-32 and the 2026
// Social Security wage base announcement. Update these once per year.
export const TAX_YEAR = 2026

export const NO_STATE_INCOME_TAX_STATES = new Set([
  'AK',
  'FL',
  'NV',
  'NH',
  'SD',
  'TN',
  'TX',
  'WA',
  'WY',
])

export type TaxEstimateInput = {
  annualGrossIncome: number
  // Reduces federal taxable income (for example 401(k) and cafeteria benefits).
  preTaxDeductions?: number
  // Reduces Social Security and Medicare wages. Cafeteria-plan benefits
  // qualify; traditional 401(k) contributions do not.
  ficaExemptDeductions?: number
  state?: string
  filingStatus?: FilingStatus
  stateTaxRate?: number
}

export type TaxEstimate = {
  taxableFederalIncome: number
  estimatedFederalTax: number
  estimatedStateTax: number
  socialSecurityTax: number
  medicareTax: number
  totalEstimatedTax: number
}

const STANDARD_DEDUCTIONS: Record<FilingStatus, number> = {
  single: 16100,
  married_joint: 32200,
  married_separate: 16100,
  head_of_household: 24150,
}

type TaxBracket = {
  upTo: number
  rate: number
}

const FEDERAL_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { upTo: 12400, rate: 0.1 },
    { upTo: 50400, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256225, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
  ],
  married_joint: [
    { upTo: 24800, rate: 0.1 },
    { upTo: 100800, rate: 0.12 },
    { upTo: 211400, rate: 0.22 },
    { upTo: 403550, rate: 0.24 },
    { upTo: 512450, rate: 0.32 },
    { upTo: 768700, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
  ],
  married_separate: [
    { upTo: 12400, rate: 0.1 },
    { upTo: 50400, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256225, rate: 0.32 },
    { upTo: 384350, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
  ],
  head_of_household: [
    { upTo: 17700, rate: 0.1 },
    { upTo: 67450, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201750, rate: 0.24 },
    { upTo: 256200, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
  ],
}

const SOCIAL_SECURITY_WAGE_BASE = 184500
const SOCIAL_SECURITY_RATE = 0.062
const MEDICARE_RATE = 0.0145
const ADDITIONAL_MEDICARE_RATE = 0.009

// Statutory thresholds, not inflation adjusted.
const ADDITIONAL_MEDICARE_THRESHOLDS: Record<FilingStatus, number> = {
  single: 200000,
  married_joint: 250000,
  married_separate: 125000,
  head_of_household: 200000,
}

function estimateProgressiveTax(taxableIncome: number, brackets: TaxBracket[]) {
  let remaining = Math.max(0, taxableIncome)
  let previousLimit = 0
  let tax = 0

  for (const bracket of brackets) {
    const taxableAtBracket = Math.min(remaining, bracket.upTo - previousLimit)

    if (taxableAtBracket <= 0) {
      break
    }

    tax += taxableAtBracket * bracket.rate
    remaining -= taxableAtBracket
    previousLimit = bracket.upTo
  }

  return tax
}

export function estimateAnnualTaxes({
  annualGrossIncome,
  preTaxDeductions = 0,
  ficaExemptDeductions = 0,
  state = '',
  filingStatus = 'single',
  stateTaxRate = 0.04,
}: TaxEstimateInput): TaxEstimate {
  const normalizedState = state.trim().toUpperCase()
  const adjustedGrossIncome = Math.max(0, annualGrossIncome - preTaxDeductions)
  const ficaWages = Math.max(0, annualGrossIncome - ficaExemptDeductions)
  const taxableFederalIncome = Math.max(
    0,
    adjustedGrossIncome - STANDARD_DEDUCTIONS[filingStatus],
  )
  const estimatedFederalTax = estimateProgressiveTax(
    taxableFederalIncome,
    FEDERAL_BRACKETS[filingStatus],
  )
  const estimatedStateTax = NO_STATE_INCOME_TAX_STATES.has(normalizedState)
    ? 0
    : adjustedGrossIncome * stateTaxRate
  const socialSecurityTax =
    Math.min(ficaWages, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE
  const medicareTax =
    ficaWages * MEDICARE_RATE +
    Math.max(0, ficaWages - ADDITIONAL_MEDICARE_THRESHOLDS[filingStatus]) *
      ADDITIONAL_MEDICARE_RATE

  return {
    taxableFederalIncome,
    estimatedFederalTax,
    estimatedStateTax,
    socialSecurityTax,
    medicareTax,
    totalEstimatedTax:
      estimatedFederalTax + estimatedStateTax + socialSecurityTax + medicareTax,
  }
}
