# Issue 001: Goal-centered revamp with flat design

Status: Open
Opened: 2026-08-30

## Problem

The app currently buries almost all functionality inside 18 modal views.
Top-level pages are grids of buttons that only open those modals, so users cannot see their data in context.
The dashboard is a wall of 14 visually identical metric cards with no hierarchy.
Goals exist in three disconnected shapes (purchase goals, a single finance target, and an emergency fund) with no answer to the core question: "is this goal actually achievable, and what would it take?"
The visual design leans on gradients, glassmorphism, and blur, which the owner wants replaced with a flat design.

## Goals of this revamp

1. Make the app friendlier to navigate: each tab becomes a real page that shows data inline, with modals reserved for add and edit forms.
2. Give users tools to understand financial goals and their feasibility:
   - A per-goal feasibility assessment (funded, on track, stretch, at risk) computed from projected cash flow.
   - Required saving per month versus available monthly surplus, with a monthly shortfall figure.
   - The earliest realistic date for a goal at the current surplus.
   - A portfolio view answering whether all goals together fit inside the monthly surplus.
3. Replace the visual design with a flat one: solid surfaces, single accent color, 1px borders, no gradients, no backdrop blur, smaller radii.

## Planned changes

### Calculations

- Add `src/calculations/goals.ts` with pure functions: `assessGoalFeasibility`, `summarizeGoalPortfolio`, and cadence-to-monthly conversion helpers.
- Add vitest as a dev dependency and cover the new module with unit tests.

### Pages

- Split `DashboardPageContent.tsx` into focused page components under `src/pages/dashboard/pages/`.
- Rename the Planning tab to Goals and build it around inline goal cards with feasibility verdicts.
- Cash Flow page lists paycheck rules, recurring transactions, and scheduled transactions inline with remove actions.
- Scenarios page lists saved scenarios and shows the baseline-versus-scenario comparison inline.
- Insights page renders the projection, spending, and scenario charts inline, replacing the insights modal.
- Dashboard home gets clear sections: status hero, this-month stats, goal progress strip, calendar, and upcoming items.

### Design

- Rewrite `src/index.css` design tokens and `src/App.css` for the flat design.
- Keep the expense damage animation but restyle it to match.

### Docs

- Update README project description.
- Add `docs/GOALS.md` documenting the feasibility model and its assumptions.
- Record progress in `docs/REVAMP_PLAN.md`.

## Out of scope

- Normalized Supabase tables (tracked in REVAMP_PLAN data migration strategy).
- Changes to Plaid bank sync behavior.
- Tax model changes.
