-- GAMBOQUEST: server-side game engine (guest sessions + session state)

create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  balance integer not null default 1000 check (balance >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists guest_sessions_token_idx on public.guest_sessions (token);
create index if not exists guest_sessions_expires_idx on public.guest_sessions (expires_at);

alter table public.guest_sessions enable row level security;

-- Extend game_sessions for server-side state
alter table public.game_sessions
  alter column user_id drop not null;

alter table public.game_sessions
  add column if not exists guest_token text references public.guest_sessions (token) on delete cascade;

alter table public.game_sessions
  drop constraint if exists game_sessions_owner_check;

alter table public.game_sessions
  add constraint game_sessions_owner_check
  check (
    (user_id is not null and guest_token is null)
    or (user_id is null and guest_token is not null)
  );

create index if not exists game_sessions_guest_token_idx
  on public.game_sessions (guest_token, status);

-- Guest balance adjustment (service role only)
create or replace function public.adjust_guest_balance(
  p_token text,
  p_amount integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_amount = 0 then
    raise exception 'Amount cannot be zero';
  end if;

  if abs(p_amount) > 50000 then
    raise exception 'Amount exceeds per-transaction limit';
  end if;

  update public.guest_sessions
  set balance = balance + p_amount
  where token = p_token
    and expires_at > now()
  returning balance into v_new_balance;

  if not found then
    raise exception 'Guest session not found or expired';
  end if;

  if v_new_balance < 0 then
    raise exception 'Insufficient funds';
  end if;

  return v_new_balance;
end;
$$;

revoke all on function public.adjust_guest_balance(text, integer, text) from public;
revoke all on function public.adjust_guest_balance(text, integer, text) from anon;
revoke all on function public.adjust_guest_balance(text, integer, text) from authenticated;
