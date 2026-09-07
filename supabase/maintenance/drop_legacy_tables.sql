-- Run this by hand (Supabase SQL editor) ONLY after you have confirmed the app
-- shows everyone's data correctly from the normalized tables.
--
-- dashboard_states : the old one-JSON-blob-per-user table. Migration 0002 copied
--                    its contents into the per-entity tables but left it in place
--                    as a backup.
-- transactions     : an early experiment that the app never used (0 rows).

drop table if exists public.dashboard_states;
drop table if exists public.transactions;

notify pgrst, 'reload schema';
