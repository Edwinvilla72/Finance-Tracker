# Finance-Tracker Revamp Plan

Finance-Tracker is moving from a manual finance calendar into a personal financial planning platform. The current app already handles auth, scheduled transactions, recurring expenses, paycheck rules, debt plans, purchase goals, and simple projections. The revamp should preserve those working goals while creating a cleaner architecture for income, taxes, benefits, retirement, net worth, and scenarios.

## Milestones

1. Refactor architecture without changing behavior. Completed as the first compatibility pass.
2. Redesign the dashboard and navigation. Started with the financial cockpit overview, then simplified the app into six top-level tabs: Dashboard, Calendar, Cash Flow, Planning, Scenarios, and Insights.
3. Add income, paycheck, tax, deduction, and benefit modeling. Started with salary/hourly income modeling, filing status/state assumptions, federal/FICA/state tax estimates, benefits, retirement contributions, and net paycheck estimates.
4. Add debt APR, emergency fund, savings, investment, retirement, and net worth projections. Started with APR-aware debt estimates, emergency fund targets, investment growth projections, and net worth tracking.
5. Add scenario planning and advanced insights. Started with baseline-vs-scenario inputs plus chart-style insight views for cash trends, spending mix, and scenario impact.
6. Polish UX, validation, tests, documentation, loading states, error states, and financial disclaimers.
7. Goal-centered revamp (issue 001, completed 2026-08-30): flat design system, page-first navigation instead of modal-first, a unified Goals page with per-goal and portfolio feasibility verdicts (see GOALS.md), inline lists on Cash Flow and Scenarios, inline charts on Insights, and vitest coverage for the goals engine.
8. UX audit and Apple-style dashboard (issue 002, completed 2026-08-31): verified email links redirect back to the app with errors surfaced, one paycheck modal with a quick-add/salary-and-taxes toggle, recurring occurrences generated through the full projection horizon, native required validation on forms, cents supported in every money field, and a simplified dashboard (stat band, calendar, upcoming).
9. Persistence trust (issue 003, completed 2026-09-05): a failed cloud load no longer lets autosave overwrite the cloud payload with defaults, load failures show a retryable error panel, hydration shows a skeleton, and a navbar indicator reports save status with retry for signed-in sessions.
10. Tax model correctness (issue 004, completed 2026-09-05): per-filing-status 2026 federal brackets and standard deductions, the 2026 Social Security wage base, the additional Medicare tax, a FICA-versus-income-tax deduction split for benefits and retirement, a visible tax year in the UI, and test coverage for the tax and paycheck math.
11. Onboarding and settings (issue 005, completed 2026-09-05): a persisted Settings modal for the state tax rate and projection horizon assumptions threaded through projections, feasibility, scenarios, and labels, plus a dismissible first-run setup guide on the dashboard.
12. Feedback and normalized persistence (issue 006, completed 2026-09-07): an in-app feedback form with an admin inbox and status workflow backed by `profiles.role`, and the move from the single JSON blob to one Supabase table per kind of data with row level security, uuid ids, a diff-based autosave, a migration runner, and a re-runnable legacy importer.

## Architecture Direction

- Keep Supabase Auth.
- Persist to one table per kind of data (done in milestone 12); `dashboard_states.payload` remains only as a read-only backup until it is dropped.
- Keep the compatibility layer that normalizes legacy payloads for local mode.
- Move domain types into `src/types`.
- Move pure financial logic into `src/calculations`.
- Move shared formatting and date helpers into `src/utils`.
- Move persistence details into `src/services`.
- Split future screens into focused page folders instead of one large dashboard file.

## Future Pages

- Dashboard
- Onboarding
- Income & Paychecks
- Taxes & Deductions
- Benefits
- Cash Flow
- Debt
- Goals
- Investments & Retirement
- Net Worth
- Scenarios
- Settings & Assumptions

## Data Migration Strategy

Completed in milestone 12. The normalized tables are:

- profiles (with `role`)
- finance_settings (balance, balance source, balance target, planning assumptions, setup guide flag)
- financial_profiles, income_sources, benefit_elections, retirement_contributions
- scheduled_transactions, recurring_transactions, paycheck_rules
- debt_plans, purchase_goals, emergency_fund_plans
- investment_accounts, net_worth_items, scenario_plans
- feedback

`app_internal.import_legacy_dashboard_states()` (run with `npm run db:import-legacy`) copies anything still in the old blob into these tables and can be re-run safely; `supabase/maintenance/drop_legacy_tables.sql` removes the blob once the cutover is confirmed.
