import type { BenefitElection } from '../types/finance'

export function totalBenefitDeductions(
  benefits: BenefitElection[],
  taxTreatment?: BenefitElection['taxTreatment'],
) {
  return benefits
    .filter((benefit) => !taxTreatment || benefit.taxTreatment === taxTreatment)
    .reduce((sum, benefit) => sum + benefit.amountPerPaycheck, 0)
}
