# Goal feasibility model

The Goals page judges every goal against real scheduled cash flow instead of showing raw numbers.
This document explains the model so future changes keep the assumptions honest.
The logic lives in `src/calculations/goals.ts` and is covered by `src/calculations/goals.test.ts`.

## Inputs

- **Monthly surplus**: the average saving pace over the projection horizon (configurable in Settings, default six months).
  It is computed as `(projected balance at the horizon - current balance) / horizon months` from the calendar forecast.
  This is steadier than a single month's net, which swings with paycheck timing and one-time expenses.
- **Projected balance at target date**: the calendar forecast projected to the goal's target date.
- **Months until target**: whole months from today through the target month, minimum one.
  A target inside the current month still counts as one saving opportunity.

## Goal kinds

`src/pages/dashboard/goalItems.ts` normalizes four goal shapes into one list:

| Kind | Source | Progress shown | Notes |
| --- | --- | --- | --- |
| Purchase | `purchaseGoals` | Projected cash at target versus cost | Cash forecast counts toward funding |
| Balance target | `financePlan` | Projected cash at target versus target amount | Only when amount and date are set |
| Debt payoff | `debtPlans` with a `payoffDate` | None | Judged purely on required payment pace |
| Emergency fund | `emergencyFundPlan` | Saved amount versus target | See below |

The emergency fund has no deadline, so feasibility is judged against a 12-month build pace.
Its savings are tracked outside the cash flow forecast, so the projected balance does not count toward it.

## Per-goal status

- **Funded**: the projected balance at the target date already covers the amount.
  A funded goal requires no extra monthly saving.
- **On track**: the monthly surplus covers the required monthly saving (`amount / months until target`).
- **Stretch**: the surplus covers at least 60% of the required saving.
- **At risk**: the surplus covers less than 60% of the required saving.

Each unfunded goal also gets an **earliest feasible date**: the first month-end by which the amount is covered if the full surplus went to that goal alone.
This is a guide for moving a target date, not a promise, because the surplus is shared across goals.

## Portfolio status

The summary across all goals compares total required monthly saving with the monthly surplus:

- **Comfortable**: goals need at most 70% of the surplus.
- **Tight**: goals fit inside the surplus but use more than 70% of it.
- **Overcommitted**: goals need more than the surplus, or there is no surplus.

## Known limitations

- The surplus window assumes the current schedule continues through the projection horizon.
- Purchase goals and the balance target both draw on the same projected cash, so several "funded" goals can overlap the same dollars.
  The portfolio's required-saving total avoids this for unfunded goals, but funded goals are not cross-checked against each other.
- Debt interest (APR) is not part of the required payment pace on the Goals page.
  The debt modal's amortization estimate remains the APR-aware view.
