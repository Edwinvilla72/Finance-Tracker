# Issue 002: UX audit, unified paycheck entry, and Apple-style dashboard

Status: Closed
Opened: 2026-08-31
Closed: 2026-08-31

## Outcome

Shipped in full, plus one scope addition requested mid-work: every money field accepts decimal cents (`step="0.01"`), and the currency formatter shows cents only when an amount has them.
Root causes found during the audit:

- Sign-up never passed `emailRedirectTo`, so verification emails pointed at the Supabase project default instead of the running app, and link errors were dropped silently.
  Fixed in `AuthPage.tsx`; the required Supabase redirect-URL setting is documented in the README.
- `buildCalendarOccurrences` generated recurring items only through the visible month (or the furthest debt or target date), so projections and feasibility silently missed future recurring bills and paychecks.
  Fixed with a six-month minimum horizon that also covers purchase-goal dates, with regression tests.
- Recurring adds failed silently on missing day-of-month or weekdays.
  Native `required` validation and a weekday hint now explain the problem.
- Paycheck creation differed by entry point.
  One paycheck modal now has a Quick add and a Salary & taxes tab, prefills saved income either way, and both tabs share the scheduled-paychecks list.
- The dashboard was rebuilt to a stat band (balance, income, expenses, net), the calendar, and the upcoming list, in an Apple-style system: system fonts, sentence-case labels, hairline separators, segmented navigation, no badges or caption subtext on the dashboard.
- Modals close on Escape and declare `role="dialog"`; past calendar days no longer show a misleading end-of-day balance; the seven-column month grid is kept on phones.

## Problems

1. The account verification email can send users to the wrong place.
   Sign-up never passes a redirect target, so Supabase falls back to its configured Site URL, and the app never surfaces link errors (expired or invalid tokens) after redirect.
2. Paycheck creation differs by entry point.
   The dashboard leads with the tax-modeling form while Cash Flow leads with the simple scheduled-paycheck form, which is confusing.
   The simple form should be the default everywhere, with a toggle to the salary-and-taxes estimate.
3. Recurring payments do not reliably appear as recurring on the calendar, and form validation failures are silent.
   Forms return early on missing input with no feedback, so an incomplete recurring entry looks like a bug.
4. The dashboard is overloaded.
   It should show only: navbar, balance, this month's income, this month's expenses, month-end net (grouped in one area), the calendar, and upcoming transactions.
   The feel should be Apple-like: no subtext captions, no pill badges, generous whitespace, simple type.

## Planned changes

- Auth: pass `emailRedirectTo` on sign-up, show a clear "check your email" message, and surface auth errors carried back in the URL hash after clicking a verification link.
- Merge the paycheck and income-model modals into one paycheck modal with a Simple / Salary-and-taxes toggle, reused by every entry point.
- Fix recurring calendar generation issues found in testing and add native `required` validation so incomplete forms explain themselves.
- Rebuild the dashboard home to a single stats band (balance, income, expenses, net) plus calendar and upcoming list; drop the hero, goal strip, quick actions, and extra stat cards.
- Remove the debt section from the dashboard sidebar (it lives on Goals).
- Restyle toward an Apple-like system: system font stack, quieter labels (no uppercase micro-labels), hairline borders, 12px radii, segmented-control navigation, no decorative pills on the dashboard.
- Modal accessibility: Escape closes, dialog role.

## Out of scope

- Supabase dashboard configuration (Site URL and redirect allowlist) is documented, not automated.
- No data model changes.
