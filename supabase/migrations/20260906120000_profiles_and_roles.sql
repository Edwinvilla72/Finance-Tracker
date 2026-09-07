-- 0001: profiles get a role, an admin helper, and hardened API grants.
-- Safe to run more than once. Applied by `npm run db:migrate`.

-- ---------------------------------------------------------------------------
-- 1. profiles: one row per auth user. Already exists on the live project; the
--    create is here so a fresh environment gets the same shape.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin'));
  end if;
end $$;

comment on table public.profiles is 'Application profile for each auth user. role controls access to admin-only features such as the feedback inbox.';
comment on column public.profiles.role is '''user'' or ''admin''. Change it with `npm run db:promote-admin -- email@example.com`; the API cannot modify it.';

-- ---------------------------------------------------------------------------
-- 2. Shared trigger that stamps updated_at on any table that has the column.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Keep profiles in sync with auth.users (create on signup, follow email changes).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- auth.users is owned by supabase_auth_admin, so triggers on it are created only
-- when missing rather than dropped and recreated. The existing signup trigger
-- already calls handle_new_user(), whose body was just replaced above.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_email_updated' and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_email_updated
      after update of email on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- Backfill profiles for accounts created before the trigger existed.
insert into public.profiles (id, email, created_at)
select u.id, u.email, u.created_at
from auth.users u
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. is_admin(): used inside row level security policies. SECURITY DEFINER so
--    the policy on profiles can call it without recursing into itself.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Row level security on profiles.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "users can view own profile" on public.profiles;
drop policy if exists "users can insert own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can view own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "Admins can view all profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- The API may read profiles and change the display name only. Rows are created
-- by the auth trigger, and the role column is never writable through the API,
-- so a user cannot promote themselves.
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The legacy public.transactions table has no owner column and had RLS off,
--    which let anyone with the anon key write to it. It is empty and unused by
--    the app; lock it down here and drop it with supabase/maintenance/drop_legacy_tables.sql.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.transactions') is not null then
    execute 'alter table public.transactions enable row level security';
    execute 'revoke all on table public.transactions from anon, authenticated';
  end if;
end $$;
