# Finance Tracker

A personal financial planning app for tracking spending, scheduling income and bills, and judging whether financial goals are actually achievable.

## What it does

- **Dashboard**: balance, this month's income, expenses, and net, plus the transaction calendar and upcoming items.
- **Cash Flow**: paychecks (quick add, or estimated from salary, taxes, benefits, and retirement), recurring bills, one-time transactions, and Plaid bank sync.
- **Goals**: purchase goals, a balance target, an emergency fund, and debt payoff plans, each with a feasibility verdict computed from projected cash flow.
  See [docs/GOALS.md](docs/GOALS.md) for the model.
- **Scenarios**: baseline-versus-what-if comparisons for income, rent, benefits, debt, and investing changes.
- **Insights**: projected balance trend, spending mix, and scenario impact charts.

## Stack

- React 19 + TypeScript + Vite.
- Supabase for auth and state persistence (a local dev mode runs entirely on localStorage).
- Supabase Edge Functions for Plaid bank sync (see [docs/PLAID_SETUP.md](docs/PLAID_SETUP.md)).
- Vitest for unit tests over the pure calculation modules in `src/calculations`.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run unit tests
npm run lint     # eslint
npm run build    # typecheck and production build
```

Supabase mode needs a `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
Without it, switch to local dev mode on the sign-in screen.

Account verification emails redirect back to wherever the app is running (`window.location.origin`).
For that link to work, add each app URL (for example `http://localhost:5173` and the production URL) to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
Expired or invalid verification links show their error message on the sign-in screen.

## Project layout

- `src/calculations`: pure financial math (cash flow, goals, taxes, debt, investments).
- `src/pages/dashboard/pages`: one component per top-level page.
- `src/pages/dashboard/DashboardModalContent.tsx`: add and edit forms, shown in modals.
- `src/services`: persistence and bank sync.
- `docs/issues`: feature issues tracked in-repo.
