# Plaid Setup

This app now includes a Plaid-through-Supabase integration for linked balances and synced transactions.

## What Was Added

- Supabase migration: `supabase/migrations/20260603210000_add_plaid_sync.sql`
- Edge functions:
  - `plaid-create-link-token`
  - `plaid-exchange-public-token`
  - `plaid-sync`
- Frontend linked-banking UI in the dashboard

## Required Secrets

Set these in your Supabase project for Edge Functions:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV`
  - Use `sandbox`, `development`, or `production`

Your frontend still needs the existing Vite/Supabase env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

## Deploy Steps

1. Run the new SQL migration against your Supabase database.
2. Deploy the Edge Functions in `supabase/functions`.
3. Set the Plaid secrets in Supabase.
4. Make sure you are signed into the app in Supabase mode.
5. Open `Linked accounts` in the dashboard and connect your bank.

## Behavior Notes

- The planner keeps linked bank data separate from scheduled forecast transactions.
- You can switch the dashboard's current cash source between:
  - manual balance entry
  - linked depository balances
- Linked transactions are shown as actual posted activity, not future scheduled items.
- USAA support is expected to work through Plaid, but pending transactions may be missing or delayed.
