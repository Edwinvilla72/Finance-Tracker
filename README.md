# Finance Tracker

A personal financial planning app for tracking spending, scheduling income and bills, and judging whether financial goals are actually achievable.

## What it does

- **Dashboard**: balance, this month's income, expenses, and net, plus the transaction calendar and upcoming items.
- **Cash Flow**: paychecks (quick add, or estimated from salary, taxes, benefits, and retirement), recurring bills, one-time transactions, and Plaid bank sync.
- **Goals**: purchase goals, a balance target, an emergency fund, and debt payoff plans, each with a feasibility verdict computed from projected cash flow.
  See [docs/GOALS.md](docs/GOALS.md) for the model.
- **Scenarios**: baseline-versus-what-if comparisons for income, rent, benefits, debt, and investing changes.
- **Insights**: projected balance trend, spending mix, and scenario impact charts.
- **Settings**: planning assumptions (flat state tax rate and the projection horizon) that flow through every estimate.
- **Feedback**: a feedback button on every page for feature requests and bug reports, and an admin inbox to triage them.
- A dismissible setup guide walks new accounts through balance, paycheck, bills, and a first goal.

## Stack

- React 19 + TypeScript + Vite.
- Supabase for auth and persistence, with one Postgres table per kind of data and row level security (a local dev mode runs entirely on localStorage).
- Supabase Edge Functions for Plaid bank sync (see [docs/PLAID_SETUP.md](docs/PLAID_SETUP.md)).
- Vitest for unit tests over the pure calculation modules in `src/calculations` and the persistence diff in `src/services`.

## Development

```bash
npm install
npm run dev              # start the dev server
npm test                 # run unit tests
npm run lint             # eslint
npm run build            # typecheck and production build
npm run db:migrate       # apply pending SQL migrations
```

Supabase mode needs a `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
Without it, switch to local dev mode on the sign-in screen.
The database scripts also need `DATABASE_URL` (and usually `DATABASE_POOLER_URL`); see `.env.example` for where each value lives in the Supabase dashboard.

Account verification emails redirect back to wherever the app is running (`window.location.origin`).
For that link to work, add each app URL (for example `http://localhost:5173` and the production URL) to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
Expired or invalid verification links show their error message on the sign-in screen.

## Database

Every kind of user data has its own table. Rows belong to a profile and disappear with the auth user.

| Table | One row per | Holds |
| --- | --- | --- |
| `profiles` | user | Email, display name, and `role` (`user` or `admin`) |
| `finance_settings` | user | Balance, balance source, balance target, tax rate and projection horizon assumptions, setup guide flag |
| `financial_profiles` | user | Tax state and filing status |
| `emergency_fund_plans` | user | Emergency fund savings and target |
| `scheduled_transactions` | item | One-time transactions on a date |
| `recurring_transactions` | item | Monthly or weekly repeating bills |
| `paycheck_rules` | item | Monthly, weekly, or biweekly income |
| `income_sources`, `benefit_elections`, `retirement_contributions` | item | Inputs to the take-home estimate |
| `debt_plans`, `purchase_goals` | item | Goal-shaped things with dates |
| `investment_accounts`, `net_worth_items`, `scenario_plans` | item | Investments, manual assets and liabilities, what-if scenarios |
| `feedback` | item | Feature requests and bug reports with status and admin notes |
| `plaid_items`, `plaid_accounts`, `plaid_transactions` | item | Bank sync data written by the edge functions |

In the app, `src/services/financeDataService.ts` loads all of a user's rows into one `PersistedState`, and on autosave diffs the current state against the last synced snapshot and writes only the rows that changed.
Ids are uuids created in the browser, so a new item has its final primary key immediately.
Local dev mode keeps saving the whole state to localStorage through `dashboardStateService`.

### Security

Row level security is on for every table.

- Finance tables: users read and write only their own rows. Admins get no extra access to anyone's finances.
- `feedback`: users create (always as `open`) and read their own items; admins read everything and are the only ones who can change status, leave notes, or delete.
- `profiles`: users see their own row and can change only the display name; admins see all rows. The `role` column is never writable through the API.
- `public.is_admin()` backs the admin policies; it runs as the table owner so the profiles policy can call it without recursion.

### Migrations

SQL files in `supabase/migrations` run in name order, each in a transaction, and are recorded in `app_internal.schema_migrations` (a schema the API cannot see). All are written to be safe to run twice.

```bash
npm run db:migrate            # apply pending migrations
npm run db:migrate:status     # show applied and pending files
```

The direct Supabase host is IPv6-only on most networks; when `DATABASE_URL` is unreachable the scripts fall back to `DATABASE_POOLER_URL` (the "Session pooler" string under Connect in the Supabase dashboard).

### Cutting over from the old blob

Before this version, everything lived in `dashboard_states.payload`. The migrations copied that data into the tables and left the blob in place as a backup. Anything the old build writes after that point can be carried over at any time with

```bash
npm run db:import-legacy
```

which only adds legacy items newer than the last import and never overwrites rows the new app has already written. Run it once more right before deploying this version, then, when everyone's data looks right, remove the blob and the unused early `transactions` table with `supabase/maintenance/drop_legacy_tables.sql` in the SQL editor.

### Making someone an admin

```bash
npm run db:promote-admin -- you@example.com          # grant
npm run db:promote-admin -- you@example.com --demote # revoke
npm run db:promote-admin -- --list
```

The account must already exist. Admins see an "Admin inbox" entry in the navbar with a badge for open items.

## Feedback

Signed-in users can open the feedback form from the floating button in the bottom-right corner or from "Feedback" in the navbar. It asks for a type (feature request, bug, other), a required title and description, and optional additional details, and lists everything the user has sent with its current status and any note from the admin. Local dev mode has no feedback, since submissions belong to an account.

Admins open "Admin inbox" to see every item colour-coded by status, filter by status (open, in progress, resolved, won't fix) or type, change the status with one click, and leave a note the submitter can read.

## Project layout

- `src/calculations`: pure financial math (cash flow, goals, taxes, debt, investments).
- `src/pages/dashboard/pages`: one component per top-level page.
- `src/pages/dashboard/DashboardModalContent.tsx`: add and edit forms, shown in modals; `FeedbackModal.tsx` and `AdminFeedbackModal.tsx` are the feedback modals.
- `src/services`: persistence (`financeDataService` for Supabase, `dashboardStateService` for local mode), feedback, profiles, and bank sync.
- `scripts/db`: migration runner, legacy importer, and admin promotion.
- `supabase/migrations`: SQL migrations; `supabase/functions`: Plaid edge functions.
- `docs/issues`: feature issues tracked in-repo.
