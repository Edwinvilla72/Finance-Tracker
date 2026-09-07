-- 0002: one table per kind of user data, replacing the dashboard_states JSON blob.
-- Safe to run more than once. The backfill only copies data for users who have
-- nothing in the new tables yet, and it leaves dashboard_states untouched so the
-- old data stays available until you drop it (supabase/maintenance/drop_legacy_tables.sql).

-- ---------------------------------------------------------------------------
-- 1. Tables. Every row belongs to a profile; deleting the auth user cascades.
--    Primary keys are uuids so the client can create ids optimistically.
-- ---------------------------------------------------------------------------
create table if not exists public.finance_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_balance numeric(14, 2) not null default 0,
  target_amount numeric(14, 2) not null default 0,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.finance_settings is 'One row per user: the available balance plus the savings target shown as "Finance plan".';

create table if not exists public.scheduled_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  amount numeric(14, 2) not null check (amount >= 0),
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('income', 'expense', 'transfer', 'debt')),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.scheduled_transactions is 'One-time transactions placed on a specific calendar day.';
create index if not exists scheduled_transactions_user_date_idx
  on public.scheduled_transactions (user_id, transaction_date);

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  amount numeric(14, 2) not null check (amount >= 0),
  frequency text not null check (frequency in ('monthly', 'weekly')),
  day_of_month smallint check (day_of_month between 1 and 31),
  weekdays smallint[] check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  transaction_type text not null check (transaction_type in ('expense', 'transfer', 'debt')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.recurring_transactions is 'Repeating outgoing transactions. Monthly rules use day_of_month; weekly rules use weekdays (0 = Sunday).';
create index if not exists recurring_transactions_user_idx
  on public.recurring_transactions (user_id);

create table if not exists public.paycheck_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  amount numeric(14, 2) not null check (amount >= 0),
  frequency text not null check (frequency in ('monthly', 'weekly', 'biweekly')),
  day_of_month smallint check (day_of_month between 1 and 31),
  weekday smallint check (weekday between 0 and 6),
  start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.paycheck_rules is 'Income schedules. Monthly rules use day_of_month; weekly and biweekly rules use weekday (0 = Sunday) anchored at start_date.';
create index if not exists paycheck_rules_user_idx
  on public.paycheck_rules (user_id);

create table if not exists public.debt_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  balance numeric(14, 2) not null check (balance >= 0),
  minimum_due numeric(14, 2) not null default 0 check (minimum_due >= 0),
  due_date date not null,
  payoff_date date,
  payoff_cadence text check (payoff_cadence in ('weekly', 'biweekly', 'monthly')),
  payoff_mode text check (payoff_mode in ('amount', 'percent')),
  payoff_value numeric(14, 2) check (payoff_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.debt_plans is 'Debts with their due date and optional payoff plan.';
create index if not exists debt_plans_user_idx
  on public.debt_plans (user_id);

create table if not exists public.purchase_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  cost numeric(14, 2) not null check (cost >= 0),
  target_date date not null,
  savings_cadence text not null default 'monthly' check (savings_cadence in ('weekly', 'biweekly', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.purchase_goals is 'Things the user is saving up for.';
create index if not exists purchase_goals_user_idx
  on public.purchase_goals (user_id);

-- ---------------------------------------------------------------------------
-- 2. updated_at triggers, row level security, and grants. Identical for every
--    finance table: a user can only see and change their own rows, and admins
--    get no special access to anyone's finances.
-- ---------------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'finance_settings',
    'scheduled_transactions',
    'recurring_transactions',
    'paycheck_rules',
    'debt_plans',
    'purchase_goals'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );

    execute format('drop policy if exists "Users manage own rows" on public.%I', table_name);
    execute format(
      'create policy "Users manage own rows" on public.%I for all to authenticated '
      'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );

    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Backfill from the legacy dashboard_states blob.
--    Legacy values were untyped JSON, so every field goes through a tolerant
--    cast; anything unusable becomes null or a sensible default instead of
--    failing the migration. Legacy ids were Date.now() and become created_at.
-- ---------------------------------------------------------------------------
create or replace function public._legacy_numeric(value text)
returns numeric
language plpgsql
as $$
begin
  return nullif(btrim(value), '')::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public._legacy_date(value text)
returns date
language plpgsql
as $$
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return value::date;
exception when others then
  return null;
end;
$$;

create or replace function public._legacy_small_int(value text, low int, high int)
returns smallint
language plpgsql
as $$
declare
  parsed numeric;
begin
  parsed := nullif(btrim(value), '')::numeric;
  if parsed is null or parsed <> floor(parsed) or parsed < low or parsed > high then
    return null;
  end if;
  return parsed::smallint;
exception when others then
  return null;
end;
$$;

create or replace function public._legacy_created_at(legacy_id text, fallback timestamptz)
returns timestamptz
language plpgsql
as $$
declare
  millis numeric;
begin
  millis := nullif(btrim(legacy_id), '')::numeric;
  -- Only trust values that look like Date.now() between 2020 and 2100.
  if millis is null or millis < 1577836800000 or millis > 4102444800000 then
    return fallback;
  end if;
  return to_timestamp(millis / 1000.0);
exception when others then
  return fallback;
end;
$$;

do $$
begin
  if to_regclass('public.dashboard_states') is null then
    raise notice 'No legacy dashboard_states table found; nothing to backfill.';
    return;
  end if;

  -- Balance and finance plan -------------------------------------------------
  insert into public.finance_settings (user_id, current_balance, target_amount, target_date, created_at, updated_at)
  select ds.user_id,
         coalesce(public._legacy_numeric(ds.payload ->> 'currentBalanceInput'), 0),
         coalesce(public._legacy_numeric(ds.payload -> 'financePlan' ->> 'targetAmount'), 0),
         public._legacy_date(ds.payload -> 'financePlan' ->> 'targetDate'),
         ds.updated_at,
         ds.updated_at
  from public.dashboard_states ds
  where jsonb_typeof(ds.payload) = 'object'
    and exists (select 1 from public.profiles p where p.id = ds.user_id)
  on conflict (user_id) do nothing;

  -- One-time transactions ----------------------------------------------------
  insert into public.scheduled_transactions
    (user_id, title, amount, transaction_date, transaction_type, category, created_at, updated_at)
  select ds.user_id,
         coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
         abs(coalesce(public._legacy_numeric(item ->> 'amount'), 0)),
         public._legacy_date(item ->> 'date'),
         case when item ->> 'type' in ('income', 'expense', 'transfer', 'debt') then item ->> 'type' else 'expense' end,
         nullif(btrim(item ->> 'category'), ''),
         public._legacy_created_at(item ->> 'id', ds.updated_at),
         ds.updated_at
  from public.dashboard_states ds
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(ds.payload -> 'scheduledTransactions') = 'array'
         then ds.payload -> 'scheduledTransactions'
         else '[]'::jsonb end
  ) as item
  where jsonb_typeof(item) = 'object'
    and public._legacy_date(item ->> 'date') is not null
    and exists (select 1 from public.profiles p where p.id = ds.user_id)
    and not exists (select 1 from public.scheduled_transactions existing where existing.user_id = ds.user_id);

  -- Recurring transactions ---------------------------------------------------
  insert into public.recurring_transactions
    (user_id, title, amount, frequency, day_of_month, weekdays, transaction_type, start_date, end_date, created_at, updated_at)
  select ds.user_id,
         coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
         abs(coalesce(public._legacy_numeric(item ->> 'amount'), 0)),
         case when item ->> 'frequency' = 'weekly' then 'weekly' else 'monthly' end,
         case when item ->> 'frequency' = 'weekly' then null
              else public._legacy_small_int(item ->> 'dayOfMonth', 1, 31) end,
         case when item ->> 'frequency' = 'weekly' and jsonb_typeof(item -> 'weekdays') = 'array' then (
                select array_agg(distinct weekday.value::smallint order by weekday.value::smallint)
                from jsonb_array_elements_text(item -> 'weekdays') as weekday(value)
                where weekday.value ~ '^[0-6]$'
              )
              else null end,
         case when item ->> 'type' in ('expense', 'transfer', 'debt') then item ->> 'type' else 'expense' end,
         public._legacy_date(item ->> 'startDate'),
         public._legacy_date(item ->> 'endDate'),
         public._legacy_created_at(item ->> 'id', ds.updated_at),
         ds.updated_at
  from public.dashboard_states ds
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(ds.payload -> 'recurringTransactions') = 'array'
         then ds.payload -> 'recurringTransactions'
         else '[]'::jsonb end
  ) as item
  where jsonb_typeof(item) = 'object'
    and exists (select 1 from public.profiles p where p.id = ds.user_id)
    and not exists (select 1 from public.recurring_transactions existing where existing.user_id = ds.user_id);

  -- Paycheck rules -----------------------------------------------------------
  insert into public.paycheck_rules
    (user_id, title, amount, frequency, day_of_month, weekday, start_date, created_at, updated_at)
  select ds.user_id,
         coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Paycheck'),
         abs(coalesce(public._legacy_numeric(item ->> 'amount'), 0)),
         case when item ->> 'frequency' in ('weekly', 'biweekly') then item ->> 'frequency' else 'monthly' end,
         case when item ->> 'frequency' in ('weekly', 'biweekly') then null
              else public._legacy_small_int(item ->> 'dayOfMonth', 1, 31) end,
         case when item ->> 'frequency' in ('weekly', 'biweekly')
              then public._legacy_small_int(item ->> 'weekday', 0, 6)
              else null end,
         public._legacy_date(item ->> 'startDate'),
         public._legacy_created_at(item ->> 'id', ds.updated_at),
         ds.updated_at
  from public.dashboard_states ds
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(ds.payload -> 'paycheckRules') = 'array'
         then ds.payload -> 'paycheckRules'
         else '[]'::jsonb end
  ) as item
  where jsonb_typeof(item) = 'object'
    and exists (select 1 from public.profiles p where p.id = ds.user_id)
    and not exists (select 1 from public.paycheck_rules existing where existing.user_id = ds.user_id);

  -- Debt plans ---------------------------------------------------------------
  insert into public.debt_plans
    (user_id, title, balance, minimum_due, due_date, payoff_date, payoff_cadence, payoff_mode, payoff_value, created_at, updated_at)
  select ds.user_id,
         coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
         abs(coalesce(public._legacy_numeric(item ->> 'balance'), 0)),
         abs(coalesce(public._legacy_numeric(item ->> 'minimumDue'), 0)),
         public._legacy_date(item ->> 'dueDate'),
         public._legacy_date(item ->> 'payoffDate'),
         case when item ->> 'payoffCadence' in ('weekly', 'biweekly', 'monthly') then item ->> 'payoffCadence' end,
         case when item ->> 'payoffMode' in ('amount', 'percent') then item ->> 'payoffMode' end,
         abs(public._legacy_numeric(item ->> 'payoffValue')),
         public._legacy_created_at(item ->> 'id', ds.updated_at),
         ds.updated_at
  from public.dashboard_states ds
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(ds.payload -> 'debtPlans') = 'array'
         then ds.payload -> 'debtPlans'
         else '[]'::jsonb end
  ) as item
  where jsonb_typeof(item) = 'object'
    and public._legacy_date(item ->> 'dueDate') is not null
    and exists (select 1 from public.profiles p where p.id = ds.user_id)
    and not exists (select 1 from public.debt_plans existing where existing.user_id = ds.user_id);

  -- Purchase goals -----------------------------------------------------------
  insert into public.purchase_goals
    (user_id, title, cost, target_date, savings_cadence, created_at, updated_at)
  select ds.user_id,
         coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
         abs(coalesce(public._legacy_numeric(item ->> 'cost'), 0)),
         public._legacy_date(item ->> 'targetDate'),
         case when item ->> 'savingsCadence' in ('weekly', 'biweekly', 'monthly') then item ->> 'savingsCadence' else 'monthly' end,
         public._legacy_created_at(item ->> 'id', ds.updated_at),
         ds.updated_at
  from public.dashboard_states ds
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(ds.payload -> 'purchaseGoals') = 'array'
         then ds.payload -> 'purchaseGoals'
         else '[]'::jsonb end
  ) as item
  where jsonb_typeof(item) = 'object'
    and public._legacy_date(item ->> 'targetDate') is not null
    and exists (select 1 from public.profiles p where p.id = ds.user_id)
    and not exists (select 1 from public.purchase_goals existing where existing.user_id = ds.user_id);
end $$;

drop function if exists public._legacy_numeric(text);
drop function if exists public._legacy_date(text);
drop function if exists public._legacy_small_int(text, int, int);
drop function if exists public._legacy_created_at(text, timestamptz);

-- Let PostgREST pick up the new tables right away.
notify pgrst, 'reload schema';
