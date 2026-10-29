-- Individual Bills upgrade (additive).
-- Run this in Supabase -> SQL Editor -> New query BEFORE deploying the app
-- version that can write Individual Bills expenses.
--
-- 0001_init.sql is already applied in production and is NOT modified here.

-- 1. Split mode on existing expenses. Every pre-existing row becomes 'equal',
--    so all historical expenses keep their current meaning and maths.
alter table public.expenses
  add column if not exists split_mode text not null default 'equal';

alter table public.expenses
  drop constraint if exists expenses_split_mode_check;
alter table public.expenses
  add constraint expenses_split_mode_check
  check (split_mode in ('equal', 'individual'));

-- 2. Exact per-participant shares. Rows exist ONLY for 'individual' expenses;
--    'equal' expenses keep deriving shares from amount_paisa + participant_ids.
create table if not exists public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_paisa bigint not null
    check (amount_paisa >= 0 and amount_paisa <= 1000000000000),
  primary key (expense_id, user_id)
);
-- The primary key's leading column already indexes lookups by expense_id.

-- All database access goes through the authorized Next.js server boundary.
-- No anon/authenticated policies: the server-only secret client bypasses RLS
-- after explicit leader/membership checks.
alter table public.expense_shares enable row level security;

-- 3. Atomic write for individual-bill expenses: the expense row and all of its
--    share rows commit together, or neither is written.
create or replace function public.create_expense_with_shares(
  p_tour_id uuid,
  p_title text,
  p_amount_paisa bigint,
  p_participant_ids uuid[],
  p_contributions jsonb,
  p_created_by uuid,
  p_split_mode text,
  p_shares jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expense_id uuid;
begin
  insert into public.expenses (
    tour_id, title, amount_paisa, participant_ids,
    contributions, created_by, split_mode
  ) values (
    p_tour_id, p_title, p_amount_paisa, p_participant_ids,
    p_contributions, p_created_by, p_split_mode
  )
  returning id into v_expense_id;

  insert into public.expense_shares (expense_id, user_id, amount_paisa)
  select v_expense_id,
         (entry ->> 'user_id')::uuid,
         (entry ->> 'amount_paisa')::bigint
  from jsonb_array_elements(p_shares) as entry;

  return v_expense_id;
end;
$$;

-- Only the server-only secret/service role may call it.
revoke all on function public.create_expense_with_shares(
  uuid, text, bigint, uuid[], jsonb, uuid, text, jsonb
) from public, anon, authenticated;
