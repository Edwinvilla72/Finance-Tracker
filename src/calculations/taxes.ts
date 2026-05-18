import type { FilingStatus } from '../types/finance'

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
  preTaxDeductions?: number
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
  single: 14600,
  married_joint: 29200,
  married_separate: 14600,
  head_of_household: 21900,
}

const SINGLE_BRACKETS = [
  { upTo: 11600, rate: 0.1 },
  { upTo: 47150, rate: 0.12 },
  { upTo: 100525, rate: 0.22 },
  { upTo: 191950, rate: 0.24 },
  { upTo: 243725, rate: 0.32 },
  { upTo: 609350, rate: 0.35 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.37 },
]

function estimateProgressiveTax(taxableIncome: number) {
  let remaining = Math.max(0, taxableIncome)
  let previousLimit = 0
  let tax = 0

  for (const bracket of SINGLE_BRACKETS) {
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
  state = '',
  filingStatus = 'single',
  stateTaxRate = 0.04,
}: TaxEstimateInput): TaxEstimate {
  const normalizedState = state.trim().toUpperCase()
  const adjustedGrossIncome = Math.max(0, annualGrossIncome - preTaxDeductions)
  const taxableFederalIncome = Math.max(
    0,
    adjustedGrossIncome - STANDARD_DEDUCTIONS[filingStatus],
  )
  const estimatedFederalTax = estimateProgressiveTax(taxableFederalIncome)
  const estimatedStateTax = NO_STATE_INCOME_TAX_STATES.has(normalizedState)
    ? 0
    : adjustedGrossIncome * stateTaxRate
  const socialSecurityTax = Math.min(adjustedGrossIncome, 168600) * 0.062
  const medicareTax = adjustedGrossIncome * 0.0145

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
