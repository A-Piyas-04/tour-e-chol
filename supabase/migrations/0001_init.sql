create extension if not exists pgcrypto;

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  join_code text not null unique check (join_code ~ '^[0-9]{8}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.tour_members (
  tour_id uuid not null references public.tours(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  role text not null default 'member'
    check (role in ('owner', 'leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (tour_id, user_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  amount_paisa bigint not null
    check (amount_paisa > 0 and amount_paisa <= 1000000000000),
  participant_ids uuid[] not null
    check (cardinality(participant_ids) > 0),
  contributions jsonb not null
    check (jsonb_typeof(contributions) = 'array'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index expenses_tour_created_idx
  on public.expenses (tour_id, created_at desc);

create index tour_members_user_idx
  on public.tour_members (user_id);

-- All database operations use the authorized Next.js server boundary.
-- Direct browser queries with a publishable key must not be allowed.
alter table public.tours enable row level security;
alter table public.tour_members enable row level security;
alter table public.expenses enable row level security;

-- Do not add permissive anon/authenticated RLS policies.
-- The server-only secret/admin client bypasses RLS after explicit checks.
