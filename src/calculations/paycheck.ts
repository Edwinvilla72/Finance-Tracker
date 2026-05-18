import type { BenefitElection, IncomeSource, RetirementContribution } from '../types/finance'
import type { FilingStatus } from '../types/finance'
import { totalBenefitDeductions } from './benefits'
import { estimateAnnualTaxes } from './taxes'

export type PaycheckEstimateInput = {
  income: IncomeSource
  state: string
  filingStatus?: FilingStatus
  benefitElections?: BenefitElection[]
  retirementContributions?: RetirementContribution[]
}

export type PaycheckEstimate = {
  annualGrossIncome: number
  grossPerPaycheck: number
  estimatedTaxPerPaycheck: number
  preTaxDeductionsPerPaycheck: number
  postTaxDeductionsPerPaycheck: number
  retirementContributionPerPaycheck: number
  estimatedNetPaycheck: number
}

const PAYCHECKS_PER_YEAR: Record<IncomeSource['payFrequency'], number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
}

export function getAnnualGrossIncome(income: IncomeSource) {
  if (income.type === 'hourly') {
    return income.amount * (income.hoursPerWeek ?? 40) * 52
  }

  return income.amount
}

export function estimatePaycheck({
  income,
  state,
  filingStatus = 'single',
  benefitElections = [],
  retirementContributions = [],
}: PaycheckEstimateInput): PaycheckEstimate {
  const paychecksPerYear = PAYCHECKS_PER_YEAR[income.payFrequency]
  const annualGrossIncome = getAnnualGrossIncome(income)
  const grossPerPaycheck = annualGrossIncome / paychecksPerYear
  const preTaxDeductionsPerPaycheck = totalBenefitDeductions(
    benefitElections,
    'pre_tax',
  )
  const postTaxDeductionsPerPaycheck = totalBenefitDeductions(
    benefitElections,
    'post_tax',
  )
  const retirementContributionPerPaycheck = retirementContributions.reduce(
    (sum, contribution) =>
      sum +
      (contribution.contributionMode === 'percent'
        ? grossPerPaycheck * (contribution.contributionValue / 100)
        : contribution.contributionValue),
    0,
  )
  const annualPreTaxDeductions =
    (preTaxDeductionsPerPaycheck + retirementContributionPerPaycheck) *
    paychecksPerYear
  const taxes = estimateAnnualTaxes({
    annualGrossIncome,
    preTaxDeductions: annualPreTaxDeductions,
    state,
    filingStatus,
  })
  const estimatedTaxPerPaycheck = taxes.totalEstimatedTax / paychecksPerYear

  return {
    annualGrossIncome,
    grossPerPaycheck,
    estimatedTaxPerPaycheck,
    preTaxDeductionsPerPaycheck,
    postTaxDeductionsPerPaycheck,
    retirementContributionPerPaycheck,
    estimatedNetPaycheck:
      grossPerPaycheck -
      estimatedTaxPerPaycheck -
      preTaxDeductionsPerPaycheck -
      postTaxDeductionsPerPaycheck -
      retirementContributionPerPaycheck,
  }
}
