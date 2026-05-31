-- Gambo: wallet safety hardening
-- Replaces balance mutation functions so insufficient funds fail cleanly before
-- row-level check constraints are hit.

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

  if abs(p_amount) > 50000 then
    raise exception 'Amount exceeds per-transaction limit';
  end if;

  update public.profiles
  set balance = balance + p_amount
  where id = p_user_id
    and balance + p_amount >= 0
  returning balance into v_new_balance;

  if not found then
    if exists (select 1 from public.profiles where id = p_user_id) then
      raise exception 'Insufficient funds';
    end if;
    raise exception 'User profile not found';
  end if;

  insert into public.balance_transactions (user_id, amount, balance_after, reason, metadata)
  values (p_user_id, p_amount, v_new_balance, p_reason, coalesce(p_metadata, '{}'::jsonb));

  return v_new_balance;
end;
$$;

revoke all on function public.adjust_balance(uuid, integer, text, jsonb) from public;
revoke all on function public.adjust_balance(uuid, integer, text, jsonb) from anon;
revoke all on function public.adjust_balance(uuid, integer, text, jsonb) from authenticated;

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

  if char_length(coalesce(p_reason, '')) = 0 then
    raise exception 'Reason is required';
  end if;

  if abs(p_amount) > 50000 then
    raise exception 'Amount exceeds per-transaction limit';
  end if;

  update public.guest_sessions
  set balance = balance + p_amount
  where token = p_token
    and expires_at > now()
    and balance + p_amount >= 0
  returning balance into v_new_balance;

  if not found then
    if exists (
      select 1
      from public.guest_sessions
      where token = p_token
        and expires_at > now()
    ) then
      raise exception 'Insufficient funds';
    end if;
    raise exception 'Guest session not found or expired';
  end if;

  return v_new_balance;
end;
$$;

revoke all on function public.adjust_guest_balance(text, integer, text) from public;
revoke all on function public.adjust_guest_balance(text, integer, text) from anon;
revoke all on function public.adjust_guest_balance(text, integer, text) from authenticated;
