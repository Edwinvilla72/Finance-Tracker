create extension if not exists pgcrypto;

create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id text not null unique,
  access_token text not null,
  institution_id text,
  institution_name text,
  last_transactions_cursor text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists plaid_items_user_item_idx
  on public.plaid_items (user_id, plaid_item_id);

create table if not exists public.plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items (id) on delete cascade,
  plaid_account_id text not null unique,
  name text not null,
  official_name text,
  mask text,
  type text not null,
  subtype text,
  current_balance numeric not null default 0,
  available_balance numeric,
  iso_currency_code text,
  institution_name text,
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists plaid_accounts_user_idx
  on public.plaid_accounts (user_id);

create table if not exists public.plaid_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items (id) on delete cascade,
  plaid_account_id text not null,
  plaid_transaction_id text not null unique,
  account_name text not null,
  name text not null,
  merchant_name text,
  amount numeric not null,
  iso_currency_code text,
  pending boolean not null default false,
  authorized_date date,
  posted_date date not null,
  category_primary text,
  institution_name text,
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists plaid_transactions_user_date_idx
  on public.plaid_transactions (user_id, posted_date desc);

alter table public.plaid_items enable row level security;
alter table public.plaid_accounts enable row level security;
alter table public.plaid_transactions enable row level security;

drop policy if exists "Users can view their plaid accounts" on public.plaid_accounts;
create policy "Users can view their plaid accounts"
  on public.plaid_accounts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view their plaid transactions" on public.plaid_transactions;
create policy "Users can view their plaid transactions"
  on public.plaid_transactions
  for select
  to authenticated
  using (auth.uid() = user_id);
