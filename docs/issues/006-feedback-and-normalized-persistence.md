# Issue 006: In-app feedback and normalized persistence

Status: Closed
Opened: 2026-09-06
Closed: 2026-09-07

## Outcome

Shipped in full.
Signed-in users can send feedback from a floating button or the navbar; the form requires a type, a title, and a description, takes optional additional details, and lists everything the user has sent with its status and any admin note.
Accounts with `role = 'admin'` in `profiles` get an "Admin inbox" navbar entry (with an open-item badge) that opens a wide modal listing every submission, colour-coded by status, filterable by status or type, with one-click status changes (open, in progress, resolved, won't fix) and a note to the submitter.
Persistence moved off the single `dashboard_states.payload` JSON blob onto one table per kind of data (see the table in the README).
The dashboard still works with one `PersistedState` object; `financeDataService` loads it from the tables and, on autosave, diffs it against the last synced snapshot and writes only the rows that changed, so the existing save indicator, retry, and load-error behaviour from issue 003 are unchanged.
Ids are uuids generated in the browser instead of `Date.now()` numbers, so an item keeps one primary key for life; local-mode payloads with numeric ids are coerced on load.
Row level security covers every table (owner-only finances, admin-visible feedback, no anonymous access) and the `role` column is not writable through the API.
Existing blob data was copied into the tables and verified row for row (counts and amount totals match); the blob table stays as a backup and a re-runnable importer carries over anything written by the old build before the cutover.
Verified in a real browser against the live project with a throwaway account: sign-in, feedback submission, admin triage, a one-time transaction round-trip to `scheduled_transactions`, and a balance save to `finance_settings`; the account was deleted afterwards.

## Problems

1. There was no way for family members to ask for a feature or report a bug except out of band, and no place for the admin to track what was asked, decided, or fixed.
2. All of a user's data lived in one JSON column, so every keystroke rewrote the whole blob, two devices could silently overwrite each other's edits, nothing could be queried or constrained in SQL, and the schema drifted with every app version.
3. `Date.now()` ids collided in principle and could not serve as database keys.

## Planned changes

- `feedback` table with status workflow, `profiles.role`, `is_admin()` helper, and policies: users insert (always `open`) and read their own rows; admins read, update, and delete everything.
- Feedback modal (type chips, required title and description, optional details, own-history list) and an admin inbox modal (status filters with counts, type filter, status buttons, admin note), both using the existing modal, badge, chip, and callout primitives.
- Tables `finance_settings`, `scheduled_transactions`, `recurring_transactions`, `paycheck_rules`, `debt_plans`, `purchase_goals`, `financial_profiles`, `income_sources`, `benefit_elections`, `retirement_contributions`, `emergency_fund_plans`, `investment_accounts`, `net_worth_items`, `scenario_plans`, each with owner-only row level security and `updated_at` triggers.
- `financeDataService` (load, diff, apply) wired into the existing debounced autosave; `dashboardStateService` keeps local mode on localStorage.
- `scripts/db`: a migration runner recording applied files, a legacy importer, and an admin promotion script; migrations follow the existing timestamped naming.
- Vitest coverage for the diff planner.

## Out of scope

- Editing a submitted feedback item, or letting users delete their own.
- Real-time updates between devices (last write wins per row).
- Dropping `dashboard_states`; see `supabase/maintenance/drop_legacy_tables.sql` once the cutover is confirmed.

## Verification limits

Local mode was verified by typecheck, lint, and tests only; the browser run used a signed-in Supabase session created directly in the auth tables and removed afterwards.
