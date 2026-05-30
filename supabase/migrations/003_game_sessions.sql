-- Gambo: foundation for future server-side game validation
-- Not wired to the client yet; prepares fair-play architecture.

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_type text not null,
  bet_amount integer not null check (bet_amount > 0),
  status text not null default 'active'
    check (status in ('active', 'won', 'lost', 'cancelled', 'cashed_out')),
  server_seed_hash text,
  client_seed text,
  nonce integer not null default 0,
  payout integer not null default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists game_sessions_user_id_idx
  on public.game_sessions (user_id, created_at desc);

alter table public.game_sessions enable row level security;

create policy "game_sessions_select_own"
  on public.game_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserts/updates reserved for service role via API routes.
