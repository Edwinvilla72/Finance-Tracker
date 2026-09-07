-- 20260907090000: tables for the planning features (income model, benefits,
-- retirement, investments, net worth, scenarios, emergency fund, assumptions)
-- that until now lived only inside the dashboard_states JSON blob, plus a
-- re-runnable importer that carries blob data into the normalized tables.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Columns added to tables created by the earlier migrations
-- ---------------------------------------------------------------------------
alter table public.finance_settings
  add column if not exists bank_balance_source text not null default 'manual',
  add column if not exists state_tax_rate_percent numeric(8, 3) not null default 4,
  add column if not exists projection_months smallint not null default 6,
  add column if not exists setup_guide_dismissed boolean not null default false,
  add column if not exists legacy_synced_at timestamptz;

comment on column public.finance_settings.legacy_synced_at is 'Last time app_internal.import_legacy_dashboard_states() copied this user''s blob data. Only legacy items newer than this are imported on later runs.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'finance_settings_bank_balance_source_check') then
    alter table public.finance_settings
      add constraint finance_settings_bank_balance_source_check
      check (bank_balance_source in ('manual', 'linked'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'finance_settings_projection_months_check') then
    alter table public.finance_settings
      add constraint finance_settings_projection_months_check
      check (projection_months between 1 and 24);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'finance_settings_state_tax_rate_percent_check') then
    alter table public.finance_settings
      add constraint finance_settings_state_tax_rate_percent_check
      check (state_tax_rate_percent >= 0);
  end if;
end $$;

alter table public.recurring_transactions
  add column if not exists category text;

alter table public.debt_plans
  add column if not exists apr numeric(8, 3),
  add column if not exists extra_payment numeric(14, 2);

-- ---------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------
create table if not exists public.financial_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  state text not null default 'FL' check (char_length(state) between 1 and 40),
  filing_status text not null default 'single'
    check (filing_status in ('single', 'married_joint', 'married_separate', 'head_of_household')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.financial_profiles is 'One row per user: tax state and filing status used by the paycheck estimate.';

create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  income_type text not null check (income_type in ('salary', 'hourly', 'contract', 'other')),
  amount numeric(14, 2) not null,
  hours_per_week numeric(6, 2),
  pay_frequency text not null check (pay_frequency in ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.income_sources is 'Salary or hourly income used to model take-home pay. The app treats the oldest row as the primary income.';
create index if not exists income_sources_user_idx on public.income_sources (user_id);

create table if not exists public.benefit_elections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  benefit_type text not null check (benefit_type in (
    'health', 'dental', 'vision', 'life', 'disability', 'accident',
    'critical_illness', 'hospital_indemnity', 'hsa', 'fsa', 'other'
  )),
  amount_per_paycheck numeric(14, 2) not null,
  tax_treatment text not null check (tax_treatment in ('pre_tax', 'post_tax')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.benefit_elections is 'Per-paycheck benefit deductions (insurance, HSA/FSA, ...).';
create index if not exists benefit_elections_user_idx on public.benefit_elections (user_id);

create table if not exists public.retirement_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_type text not null
    check (account_type in ('traditional_401k', 'roth_401k', 'traditional_ira', 'roth_ira')),
  contribution_mode text not null check (contribution_mode in ('percent', 'amount')),
  contribution_value numeric(14, 2) not null,
  employer_match_percent numeric(8, 3),
  employer_match_limit_percent numeric(8, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.retirement_contributions is 'Retirement contributions per paycheck. The app treats the oldest row as the active one.';
create index if not exists retirement_contributions_user_idx on public.retirement_contributions (user_id);

create table if not exists public.emergency_fund_plans (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_savings numeric(14, 2) not null default 0,
  monthly_essential_expenses numeric(14, 2) not null default 0,
  target_months smallint not null default 3 check (target_months between 0 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.emergency_fund_plans is 'One row per user: emergency fund savings and target.';

create table if not exists public.investment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  account_type text not null check (account_type in (
    'brokerage', 'traditional_401k', 'roth_401k', 'ira', 'roth_ira', 'hsa', 'other'
  )),
  balance numeric(14, 2) not null,
  monthly_contribution numeric(14, 2) not null default 0,
  annual_return_rate numeric(8, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.investment_accounts is 'Investment and retirement accounts with contribution and growth assumptions.';
create index if not exists investment_accounts_user_idx on public.investment_accounts (user_id);

create table if not exists public.net_worth_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  balance numeric(14, 2) not null,
  kind text not null check (kind in ('asset', 'liability')),
  category text not null
    check (category in ('cash', 'investment', 'property', 'vehicle', 'debt', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.net_worth_items is 'Manually tracked assets and liabilities outside the cash flow model.';
create index if not exists net_worth_items_user_idx on public.net_worth_items (user_id);

create table if not exists public.scenario_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  income_change_percent numeric(8, 3) not null default 0,
  rent_change numeric(14, 2) not null default 0,
  benefit_change_per_paycheck numeric(14, 2) not null default 0,
  retirement_contribution_change_percent numeric(8, 3) not null default 0,
  extra_debt_payment numeric(14, 2) not null default 0,
  one_time_purchase numeric(14, 2) not null default 0,
  investment_contribution_change numeric(14, 2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.scenario_plans is 'What-if scenarios. position 0 is the active scenario shown on the Scenarios and Insights pages.';
create index if not exists scenario_plans_user_position_idx on public.scenario_plans (user_id, position);

-- ---------------------------------------------------------------------------
-- 3. updated_at triggers, row level security, grants (same rules as the other
--    finance tables: owner-only, no admin access, nothing for anon).
-- ---------------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'financial_profiles',
    'income_sources',
    'benefit_elections',
    'retirement_contributions',
    'emergency_fund_plans',
    'investment_accounts',
    'net_worth_items',
    'scenario_plans'
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
-- 4. Legacy import. Lives in app_internal so it is never exposed through the
--    API. Re-runnable: every write inside one run stamps updated_at with the
--    same transaction time that is stored in finance_settings.legacy_synced_at,
--    so a singleton row is refreshed from the blob only while
--    updated_at <= legacy_synced_at (nothing but the importer has written it).
--    List items are matched on (user, legacy timestamp, title) so nothing is
--    imported twice, and items whose legacy id (a Date.now() value) is older
--    than the last import are skipped, so something deleted in the new app does
--    not come back.
-- ---------------------------------------------------------------------------
create schema if not exists app_internal;

create or replace function app_internal.legacy_numeric(value text)
returns numeric
language plpgsql
as $$
begin
  return nullif(btrim(value), '')::numeric;
exception when others then
  return null;
end;
$$;

create or replace function app_internal.legacy_date(value text)
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

create or replace function app_internal.legacy_int(value text, low int, high int)
returns int
language plpgsql
as $$
declare
  parsed numeric;
begin
  parsed := nullif(btrim(value), '')::numeric;
  if parsed is null or parsed <> floor(parsed) or parsed < low or parsed > high then
    return null;
  end if;
  return parsed::int;
exception when others then
  return null;
end;
$$;

create or replace function app_internal.legacy_created_at(legacy_id text, fallback timestamptz)
returns timestamptz
language plpgsql
as $$
declare
  millis numeric;
begin
  millis := nullif(btrim(legacy_id), '')::numeric;
  if millis is null or millis < 1577836800000 or millis > 4102444800000 then
    return fallback;
  end if;
  return to_timestamp(millis / 1000.0);
exception when others then
  return fallback;
end;
$$;

create or replace function app_internal.legacy_items(payload jsonb, key text)
returns setof jsonb
language sql
immutable
as $$
  select item
  from jsonb_array_elements(
    case when jsonb_typeof(payload -> key) = 'array' then payload -> key else '[]'::jsonb end
  ) as item
  where jsonb_typeof(item) = 'object';
$$;

create or replace function app_internal.import_legacy_dashboard_states()
returns table (imported_user uuid, table_name text, rows_written bigint)
language plpgsql
as $$
declare
  ds record;
  since timestamptz;
  written bigint;
  legacy_state text;
  legacy_filing text;
  legacy_source text;
begin
  if to_regclass('public.dashboard_states') is null then
    return;
  end if;

  for ds in
    select d.user_id, d.payload, d.updated_at
    from public.dashboard_states d
    where jsonb_typeof(d.payload) = 'object'
      and exists (select 1 from public.profiles p where p.id = d.user_id)
  loop
    -- Settings row: create if missing, then refresh it from the blob unless the
    -- new app has written it since the last import.
    insert into public.finance_settings (user_id, created_at, updated_at)
    values (ds.user_id, ds.updated_at, ds.updated_at)
    on conflict (user_id) do nothing;

    select fs.legacy_synced_at into since
    from public.finance_settings fs
    where fs.user_id = ds.user_id;

    legacy_source := ds.payload ->> 'bankBalanceSource';

    update public.finance_settings fs
    set current_balance = coalesce(app_internal.legacy_numeric(ds.payload ->> 'currentBalanceInput'), 0),
        target_amount = coalesce(app_internal.legacy_numeric(ds.payload -> 'financePlan' ->> 'targetAmount'), 0),
        target_date = app_internal.legacy_date(ds.payload -> 'financePlan' ->> 'targetDate'),
        bank_balance_source = case when legacy_source in ('manual', 'linked') then legacy_source else 'manual' end,
        state_tax_rate_percent = greatest(0, coalesce(
          app_internal.legacy_numeric(ds.payload -> 'assumptions' ->> 'stateTaxRatePercent'), 4)),
        projection_months = coalesce(
          app_internal.legacy_int(ds.payload -> 'assumptions' ->> 'projectionMonths', 1, 24), 6),
        setup_guide_dismissed = coalesce(ds.payload ->> 'setupGuideDismissed', 'false') = 'true'
    where fs.user_id = ds.user_id
      and (since is null or fs.updated_at <= since);
    get diagnostics written = row_count;
    imported_user := ds.user_id; table_name := 'finance_settings'; rows_written := written; return next;

    -- Emergency fund (singleton)
    insert into public.emergency_fund_plans as efp (user_id, current_savings, monthly_essential_expenses, target_months, created_at, updated_at)
    select ds.user_id,
           coalesce(app_internal.legacy_numeric(ds.payload -> 'emergencyFundPlan' ->> 'currentSavings'), 0),
           coalesce(app_internal.legacy_numeric(ds.payload -> 'emergencyFundPlan' ->> 'monthlyEssentialExpenses'), 0),
           coalesce(app_internal.legacy_int(ds.payload -> 'emergencyFundPlan' ->> 'targetMonths', 0, 120), 3),
           ds.updated_at, ds.updated_at
    where jsonb_typeof(ds.payload -> 'emergencyFundPlan') = 'object'
    on conflict (user_id) do update
      set current_savings = excluded.current_savings,
          monthly_essential_expenses = excluded.monthly_essential_expenses,
          target_months = excluded.target_months
      where since is null or efp.updated_at <= since;
    get diagnostics written = row_count;
    table_name := 'emergency_fund_plans'; rows_written := written; return next;

    -- Financial profile (singleton)
    legacy_state := nullif(left(btrim(ds.payload -> 'financialProfile' ->> 'state'), 40), '');
    legacy_filing := ds.payload -> 'financialProfile' ->> 'filingStatus';

    insert into public.financial_profiles as fp (user_id, state, filing_status, created_at, updated_at)
    select ds.user_id,
           coalesce(legacy_state, 'FL'),
           case when legacy_filing in ('single', 'married_joint', 'married_separate', 'head_of_household')
                then legacy_filing else 'single' end,
           ds.updated_at, ds.updated_at
    where jsonb_typeof(ds.payload -> 'financialProfile') = 'object'
    on conflict (user_id) do update
      set state = excluded.state,
          filing_status = excluded.filing_status
      where since is null or fp.updated_at <= since;
    get diagnostics written = row_count;
    table_name := 'financial_profiles'; rows_written := written; return next;

    -- One-time transactions
    insert into public.scheduled_transactions
      (user_id, title, amount, transaction_date, transaction_type, category, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
           abs(coalesce(app_internal.legacy_numeric(item ->> 'amount'), 0)),
           app_internal.legacy_date(item ->> 'date'),
           case when item ->> 'type' in ('income', 'expense', 'transfer', 'debt') then item ->> 'type' else 'expense' end,
           nullif(btrim(item ->> 'category'), ''),
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload, 'scheduledTransactions') as item
    where app_internal.legacy_date(item ->> 'date') is not null
      and (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.scheduled_transactions t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled')
      );
    get diagnostics written = row_count;
    table_name := 'scheduled_transactions'; rows_written := written; return next;

    -- Recurring transactions (also fills category on rows imported before the column existed)
    update public.recurring_transactions r
    set category = nullif(btrim(item ->> 'category'), '')
    from app_internal.legacy_items(ds.payload, 'recurringTransactions') as item
    where r.user_id = ds.user_id
      and r.category is null
      and r.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
      and r.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled')
      and nullif(btrim(item ->> 'category'), '') is not null;

    insert into public.recurring_transactions
      (user_id, title, amount, frequency, day_of_month, weekdays, transaction_type, category, start_date, end_date, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
           abs(coalesce(app_internal.legacy_numeric(item ->> 'amount'), 0)),
           case when item ->> 'frequency' = 'weekly' then 'weekly' else 'monthly' end,
           case when item ->> 'frequency' = 'weekly' then null
                else app_internal.legacy_int(item ->> 'dayOfMonth', 1, 31) end,
           case when item ->> 'frequency' = 'weekly' and jsonb_typeof(item -> 'weekdays') = 'array' then (
                  select array_agg(distinct weekday.value::smallint order by weekday.value::smallint)
                  from jsonb_array_elements_text(item -> 'weekdays') as weekday(value)
                  where weekday.value ~ '^[0-6]$'
                )
                else null end,
           case when item ->> 'type' in ('expense', 'transfer', 'debt') then item ->> 'type' else 'expense' end,
           nullif(btrim(item ->> 'category'), ''),
           app_internal.legacy_date(item ->> 'startDate'),
           app_internal.legacy_date(item ->> 'endDate'),
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload, 'recurringTransactions') as item
    where (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.recurring_transactions t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled')
      );
    get diagnostics written = row_count;
    table_name := 'recurring_transactions'; rows_written := written; return next;

    -- Paycheck rules
    insert into public.paycheck_rules
      (user_id, title, amount, frequency, day_of_month, weekday, start_date, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Paycheck'),
           abs(coalesce(app_internal.legacy_numeric(item ->> 'amount'), 0)),
           case when item ->> 'frequency' in ('weekly', 'biweekly') then item ->> 'frequency' else 'monthly' end,
           case when item ->> 'frequency' in ('weekly', 'biweekly') then null
                else app_internal.legacy_int(item ->> 'dayOfMonth', 1, 31) end,
           case when item ->> 'frequency' in ('weekly', 'biweekly')
                then app_internal.legacy_int(item ->> 'weekday', 0, 6) else null end,
           app_internal.legacy_date(item ->> 'startDate'),
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload, 'paycheckRules') as item
    where (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.paycheck_rules t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Paycheck')
      );
    get diagnostics written = row_count;
    table_name := 'paycheck_rules'; rows_written := written; return next;

    -- Debt plans (also fills apr / extra_payment on rows imported before the columns existed)
    update public.debt_plans d
    set apr = coalesce(d.apr, app_internal.legacy_numeric(item ->> 'apr')),
        extra_payment = coalesce(d.extra_payment, app_internal.legacy_numeric(item ->> 'extraPayment'))
    from app_internal.legacy_items(ds.payload, 'debtPlans') as item
    where d.user_id = ds.user_id
      and (d.apr is null or d.extra_payment is null)
      and d.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
      and d.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled');

    insert into public.debt_plans
      (user_id, title, balance, minimum_due, due_date, payoff_date, payoff_cadence, payoff_mode, payoff_value, apr, extra_payment, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
           abs(coalesce(app_internal.legacy_numeric(item ->> 'balance'), 0)),
           abs(coalesce(app_internal.legacy_numeric(item ->> 'minimumDue'), 0)),
           app_internal.legacy_date(item ->> 'dueDate'),
           app_internal.legacy_date(item ->> 'payoffDate'),
           case when item ->> 'payoffCadence' in ('weekly', 'biweekly', 'monthly') then item ->> 'payoffCadence' end,
           case when item ->> 'payoffMode' in ('amount', 'percent') then item ->> 'payoffMode' end,
           abs(app_internal.legacy_numeric(item ->> 'payoffValue')),
           app_internal.legacy_numeric(item ->> 'apr'),
           app_internal.legacy_numeric(item ->> 'extraPayment'),
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload, 'debtPlans') as item
    where app_internal.legacy_date(item ->> 'dueDate') is not null
      and (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.debt_plans t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled')
      );
    get diagnostics written = row_count;
    table_name := 'debt_plans'; rows_written := written; return next;

    -- Purchase goals
    insert into public.purchase_goals
      (user_id, title, cost, target_date, savings_cadence, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
           abs(coalesce(app_internal.legacy_numeric(item ->> 'cost'), 0)),
           app_internal.legacy_date(item ->> 'targetDate'),
           case when item ->> 'savingsCadence' in ('weekly', 'biweekly', 'monthly') then item ->> 'savingsCadence' else 'monthly' end,
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload, 'purchaseGoals') as item
    where app_internal.legacy_date(item ->> 'targetDate') is not null
      and (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.purchase_goals t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled')
      );
    get diagnostics written = row_count;
    table_name := 'purchase_goals'; rows_written := written; return next;

    -- Income sources
    insert into public.income_sources
      (user_id, name, income_type, amount, hours_per_week, pay_frequency, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'name'), 200), ''), 'Primary income'),
           case when item ->> 'type' in ('salary', 'hourly', 'contract', 'other') then item ->> 'type' else 'salary' end,
           coalesce(app_internal.legacy_numeric(item ->> 'amount'), 0),
           app_internal.legacy_numeric(item ->> 'hoursPerWeek'),
           case when item ->> 'payFrequency' in ('weekly', 'biweekly', 'semimonthly', 'monthly') then item ->> 'payFrequency' else 'biweekly' end,
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload -> 'financialProfile', 'incomeSources') as item
    where (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.income_sources t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.name = coalesce(nullif(left(btrim(item ->> 'name'), 200), ''), 'Primary income')
      );
    get diagnostics written = row_count;
    table_name := 'income_sources'; rows_written := written; return next;

    -- Benefit elections
    insert into public.benefit_elections
      (user_id, name, benefit_type, amount_per_paycheck, tax_treatment, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'name'), 200), ''), 'Benefit'),
           case when item ->> 'type' in ('health', 'dental', 'vision', 'life', 'disability', 'accident',
                                         'critical_illness', 'hospital_indemnity', 'hsa', 'fsa', 'other')
                then item ->> 'type' else 'other' end,
           coalesce(app_internal.legacy_numeric(item ->> 'amountPerPaycheck'), 0),
           case when item ->> 'taxTreatment' in ('pre_tax', 'post_tax') then item ->> 'taxTreatment' else 'pre_tax' end,
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload -> 'financialProfile', 'benefitElections') as item
    where (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.benefit_elections t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.name = coalesce(nullif(left(btrim(item ->> 'name'), 200), ''), 'Benefit')
      );
    get diagnostics written = row_count;
    table_name := 'benefit_elections'; rows_written := written; return next;

    -- Retirement contributions
    insert into public.retirement_contributions
      (user_id, account_type, contribution_mode, contribution_value, employer_match_percent, employer_match_limit_percent, created_at, updated_at)
    select ds.user_id,
           case when item ->> 'accountType' in ('traditional_401k', 'roth_401k', 'traditional_ira', 'roth_ira')
                then item ->> 'accountType' else 'traditional_401k' end,
           case when item ->> 'contributionMode' in ('percent', 'amount') then item ->> 'contributionMode' else 'percent' end,
           coalesce(app_internal.legacy_numeric(item ->> 'contributionValue'), 0),
           app_internal.legacy_numeric(item ->> 'employerMatchPercent'),
           app_internal.legacy_numeric(item ->> 'employerMatchLimitPercent'),
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload -> 'financialProfile', 'retirementContributions') as item
    where (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.retirement_contributions t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
      );
    get diagnostics written = row_count;
    table_name := 'retirement_contributions'; rows_written := written; return next;

    -- Investment accounts
    insert into public.investment_accounts
      (user_id, title, account_type, balance, monthly_contribution, annual_return_rate, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
           case when item ->> 'accountType' in ('brokerage', 'traditional_401k', 'roth_401k', 'ira', 'roth_ira', 'hsa', 'other')
                then item ->> 'accountType' else 'other' end,
           coalesce(app_internal.legacy_numeric(item ->> 'balance'), 0),
           coalesce(app_internal.legacy_numeric(item ->> 'monthlyContribution'), 0),
           coalesce(app_internal.legacy_numeric(item ->> 'annualReturnRate'), 0),
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload, 'investmentAccounts') as item
    where (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.investment_accounts t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled')
      );
    get diagnostics written = row_count;
    table_name := 'investment_accounts'; rows_written := written; return next;

    -- Net worth items
    insert into public.net_worth_items
      (user_id, title, balance, kind, category, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled'),
           coalesce(app_internal.legacy_numeric(item ->> 'balance'), 0),
           case when item ->> 'kind' = 'liability' then 'liability' else 'asset' end,
           case when item ->> 'category' in ('cash', 'investment', 'property', 'vehicle', 'debt', 'other')
                then item ->> 'category' else 'other' end,
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from app_internal.legacy_items(ds.payload, 'netWorthItems') as item
    where (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.net_worth_items t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'Untitled')
      );
    get diagnostics written = row_count;
    table_name := 'net_worth_items'; rows_written := written; return next;

    -- Scenario plans (array order is the position; index 0 is active)
    insert into public.scenario_plans
      (user_id, title, income_change_percent, rent_change, benefit_change_per_paycheck,
       retirement_contribution_change_percent, extra_debt_payment, one_time_purchase,
       investment_contribution_change, position, created_at, updated_at)
    select ds.user_id,
           coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'What if scenario'),
           coalesce(app_internal.legacy_numeric(item ->> 'incomeChangePercent'), 0),
           coalesce(app_internal.legacy_numeric(item ->> 'rentChange'), 0),
           coalesce(app_internal.legacy_numeric(item ->> 'benefitChangePerPaycheck'), 0),
           coalesce(app_internal.legacy_numeric(item ->> 'retirementContributionChangePercent'), 0),
           coalesce(app_internal.legacy_numeric(item ->> 'extraDebtPayment'), 0),
           coalesce(app_internal.legacy_numeric(item ->> 'oneTimePurchase'), 0),
           coalesce(app_internal.legacy_numeric(item ->> 'investmentContributionChange'), 0),
           (ordinality - 1)::int,
           app_internal.legacy_created_at(item ->> 'id', ds.updated_at),
           ds.updated_at
    from jsonb_array_elements(
           case when jsonb_typeof(ds.payload -> 'scenarioPlans') = 'array' then ds.payload -> 'scenarioPlans' else '[]'::jsonb end
         ) with ordinality as scenarios(item, ordinality)
    where jsonb_typeof(item) = 'object'
      and (since is null or app_internal.legacy_created_at(item ->> 'id', ds.updated_at) > since)
      and not exists (
        select 1 from public.scenario_plans t
        where t.user_id = ds.user_id
          and t.created_at = app_internal.legacy_created_at(item ->> 'id', ds.updated_at)
          and t.title = coalesce(nullif(left(btrim(item ->> 'title'), 200), ''), 'What if scenario')
      );
    get diagnostics written = row_count;
    table_name := 'scenario_plans'; rows_written := written; return next;

    update public.finance_settings fs
    set legacy_synced_at = now()
    where fs.user_id = ds.user_id;
  end loop;
end;
$$;

revoke all on function app_internal.import_legacy_dashboard_states() from public;

-- Run the import now so existing planning data is available immediately.
select count(*) from app_internal.import_legacy_dashboard_states();

notify pgrst, 'reload schema';
