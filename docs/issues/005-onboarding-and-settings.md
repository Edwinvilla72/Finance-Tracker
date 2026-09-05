# Issue 005: First-run setup guide and assumption settings

Status: Closed
Opened: 2026-09-05
Closed: 2026-09-05

## Outcome

Shipped in full.
Settings opens from the navbar with the two assumptions, saved with the dashboard payload and normalized with clamping for legacy data; the horizon flows through occurrence generation, the projection, the surplus average, the scenario window, and every label, verified live (a 12-month setting produced a 12-bar cash trend, "next 12 scheduled months" goal copy, and 12-month scenario labels), and a 5.75% Georgia rate produced $521.85 taxes per biweekly check on a $62,000 salary, matching hand math.
The setup guide shows four steps for incomplete accounts, checks off from real data regardless of which entry point completed a step, and its dismissal persists.
The mobile navigation breakpoint moved up to 980px so mid widths get the collapsed menu instead of a wrapped navbar, and opening Settings closes the menu.
New tests cover assumption normalization, clamping, merge behavior, and the horizon-parameterized scenario math.

## Problems

1. A new user lands on an empty dashboard with zero balances and no guidance on where to start.
2. Two planning assumptions are hardcoded and invisible: the flat state income tax rate (4%) and the projection horizon (6 months) that drives the balance forecast, the goal-feasibility surplus, and the scenario math.

## Planned changes

- Add a `Settings` entry point in the navbar that opens a settings modal with two assumptions, persisted with the rest of the dashboard state:
  - State income tax rate (percent, ignored in no-income-tax states).
  - Projection horizon in months (clamped 1 to 24, default 6), which flows into occurrence generation, the monthly projection, the surplus average, the scenario window, and every label that previously said "6-month".
- Add a dismissible "Set up your planner" checklist to the dashboard for accounts that are missing basics: balance, a paycheck, recurring bills, and a goal.
  Each step opens the matching modal and checks itself off from real data; the guide hides when complete or when dismissed, and the dismissal persists.
- Normalize and merge the new fields in `dashboardStateService` so legacy payloads keep working, with tests for the normalize defaults, clamping, and merge behavior.
- Parameterize `projectScenarioImpact` over the horizon months with tests.

## Out of scope

- A full multi-step onboarding wizard.
- Real state tax tables (the rate stays a single flat assumption).
- Per-account investment return defaults (each account already has its own rate).
