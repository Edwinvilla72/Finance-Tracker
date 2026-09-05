# Issue 003: Persistence trust - loading, saving, and error states

Status: Closed
Opened: 2026-09-05
Closed: 2026-09-05

## Outcome

Shipped in full.
A failed cloud load now blocks autosave entirely and shows an error panel with the failure message and a Try again action, which re-runs hydration.
The debounced upsert reports its status through a quiet navbar indicator (Saving..., Saved, or a red "Couldn't save - Retry" button) for signed-in Supabase sessions, with a sequence guard so overlapping saves cannot report stale results.
Hydration shows a pulsing stat-band and calendar skeleton instead of zeroed data.
Local mode behavior is unchanged and was verified end to end in the browser; the loading, load-error, retry, and indicator states were verified visually by temporarily forcing each state (reverted before commit), since agent testing cannot sign in to a Supabase session.

## Problems

1. A failed cloud load can destroy data.
   When `hydrateFromCloud` fails, the app still marks itself ready while holding default empty state, and the debounced autosave then upserts those defaults over the user's real cloud payload.
   A transient network error on startup can wipe the account's data.
2. Save failures are invisible.
   Every persistence error only reaches `console.error`, so a user whose saves are failing believes their changes are stored.
3. There is no loading state.
   While cloud hydration runs, the dashboard renders zero balances and an empty calendar, then pops to real data.

## Planned changes

- Never enable autosave after a failed load.
  On load failure, show an error panel with the failure message and a Retry action instead of the app content.
- Track save status (saving, saved, error) around the debounced upsert and show a quiet indicator in the navbar for signed-in Supabase sessions, with a Retry action when a save fails.
  Ignore stale results when saves overlap so the indicator reflects the latest save.
- Show a lightweight skeleton (stat band and calendar placeholders) while hydration is in progress.
- Local mode keeps its current behavior: hydration is immediate and localStorage saves stay silent.

## Out of scope

- Multi-device conflict resolution (last-write-wins remains until the normalized-table migration).
- Bank sync error handling (already surfaced inside the bank modal).

## Verification limits

The cloud paths require a signed-in Supabase session, which agent testing cannot create.
Local mode is verified end to end in the browser; cloud paths are verified by review, typecheck, lint, and build.
