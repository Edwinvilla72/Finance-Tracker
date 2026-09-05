# Issue 004: Tax model correctness and coverage

Status: Closed
Opened: 2026-09-05
Closed: 2026-09-05

## Outcome

Shipped in full.
`taxes.ts` now carries per-filing-status 2026 brackets and standard deductions (verified against IRS Rev. Proc. 2025-32 coverage), the $184,500 Social Security wage base, and the additional 0.9% Medicare tax with statutory thresholds.
`TAX_YEAR` is exported and shown in the paycheck estimate copy.
FICA and federal deductions are now split: cafeteria benefits reduce both, traditional retirement contributions reduce federal taxable income only.
Fifteen new tests cover bracket math for each filing status, the deduction split, the wage base cap, additional Medicare, and pay-frequency splits; verified live in the browser, where a $62,000 single filer in FL shows $384.73 taxes per biweekly check and switching to married filing jointly drops it to $300.88, matching hand-computed figures.

## Problems

1. The federal estimate applies the single-filer brackets to every filing status, so married filing jointly and head of household take-home estimates are meaningfully wrong.
2. The constants are stale 2024 figures (standard deductions, bracket thresholds, Social Security wage base), and the UI never says which tax year the estimate uses.
3. FICA is computed after subtracting all pre-tax deductions, but traditional 401(k) contributions are income-tax exempt and NOT FICA exempt.
   Only cafeteria-plan benefits (health, HSA, FSA) reduce Social Security and Medicare wages.
4. The additional 0.9% Medicare tax above the statutory thresholds is not modeled.
5. None of the tax or paycheck math has test coverage.

## Planned changes

- Rewrite `src/calculations/taxes.ts` with per-filing-status 2026 brackets and standard deductions (IRS Rev. Proc. 2025-32), the 2026 Social Security wage base ($184,500), and the additional Medicare tax with statutory thresholds per filing status.
- Export a `TAX_YEAR` constant and show it in the paycheck estimate UI.
- Split deduction inputs: `preTaxDeductions` reduces federal taxable income; `ficaExemptDeductions` reduces Social Security and Medicare wages.
  `src/calculations/paycheck.ts` passes benefits as FICA exempt and retirement as income-tax exempt only.
- Add vitest coverage for `taxes.ts` and `paycheck.ts`: bracket math per filing status, standard deductions, the wage base cap, additional Medicare, no-income-tax states, and the deduction split.

## Out of scope

- Real state tax tables (the flat-rate estimate stays; a configurable rate belongs to the future Settings & Assumptions page).
- Itemized deductions, credits, and multi-income households.
