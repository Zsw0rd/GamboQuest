-- Gambo: server-authoritative balance adjustments
-- Only callable with the service role (via Next.js API routes).

create or replace function public.adjust_balance(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
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

  if char_length(coalesce(p_reason, '')) = 0 then
    raise exception 'Reason is required';
  end if;

  -- Per-request cap to limit abuse until full server-side game engine exists
  if abs(p_amount) > 50000 then
    raise exception 'Amount exceeds per-transaction limit';
  end if;

  update public.profiles
  set balance = balance + p_amount
  where id = p_user_id
  returning balance into v_new_balance;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_new_balance < 0 then
    raise exception 'Insufficient funds';
  end if;

  insert into public.balance_transactions (user_id, amount, balance_after, reason, metadata)
  values (p_user_id, p_amount, v_new_balance, p_reason, coalesce(p_metadata, '{}'::jsonb));

  return v_new_balance;
end;
$$;

revoke all on function public.adjust_balance(uuid, integer, text, jsonb) from public;
revoke all on function public.adjust_balance(uuid, integer, text, jsonb) from anon;
revoke all on function public.adjust_balance(uuid, integer, text, jsonb) from authenticated;

-- Daily welcome bonus: one claim per user per UTC day
create table if not exists public.daily_bonuses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  claim_date date not null default (timezone('utc', now()))::date,
  amount integer not null default 100,
  primary key (user_id, claim_date)
);

alter table public.daily_bonuses enable row level security;

create or replace function public.claim_daily_bonus(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('utc', now()))::date;
  v_new_balance integer;
begin
  insert into public.daily_bonuses (user_id, claim_date, amount)
  values (p_user_id, v_today, 100)
  on conflict do nothing;

  if not found then
    raise exception 'Daily bonus already claimed';
  end if;

  select public.adjust_balance(p_user_id, 100, 'daily_bonus', jsonb_build_object('claim_date', v_today))
  into v_new_balance;

  return v_new_balance;
end;
$$;

revoke all on function public.claim_daily_bonus(uuid) from public;
revoke all on function public.claim_daily_bonus(uuid) from anon;
revoke all on function public.claim_daily_bonus(uuid) from authenticated;
