-- Gambo: initial schema for Supabase Auth + profiles
-- Run via Supabase CLI or SQL Editor after enabling Auth (email/password).

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  balance integer not null default 1000 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 2 and 32),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]+$')
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- Audit log for balance changes
-- ---------------------------------------------------------------------------
create table if not exists public.balance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists balance_transactions_user_id_idx
  on public.balance_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Auto-create profile when a user signs up via Supabase Auth
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, username, balance)
  values (new.id, v_username, 1000);

  insert into public.balance_transactions (user_id, amount, balance_after, reason)
  values (new.id, 1000, 1000, 'signup_bonus');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
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
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.balance_transactions enable row level security;

-- Users may read their own profile only
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Users may read their own transaction history
create policy "balance_transactions_select_own"
  on public.balance_transactions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No direct insert/update/delete on profiles or transactions for clients.
-- Balance changes go through service-role API routes calling adjust_balance().
