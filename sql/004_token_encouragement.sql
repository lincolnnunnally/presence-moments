-- Token encouragement wall — public notes left on a coin run's page.
-- Every coin in a run (one presence_coin_batches row) shares one /t/{code} page,
-- so the wall is keyed to the batch. Writes and reads go through the Presence API
-- (service role); nothing here is granted to anon or authenticated.
-- Applied to LPL as migration presence_token_encouragement. Idempotent.

create table if not exists public.presence_coin_encouragements (
  id uuid primary key default gen_random_uuid(),
  coin_id uuid not null references public.presence_coins(id) on delete cascade,
  batch_id uuid references public.presence_coin_batches(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  message text not null check (char_length(message) between 3 and 500),
  auth_user_id uuid,
  ip_hash text,
  status text not null default 'shown' check (status in ('shown', 'held', 'hidden')),
  held_reason text,
  report_count int not null default 0,
  reporter_hashes text[] not null default '{}',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists presence_coin_encouragements_batch_idx
  on public.presence_coin_encouragements (batch_id, status, created_at desc);
create index if not exists presence_coin_encouragements_coin_idx
  on public.presence_coin_encouragements (coin_id, status, created_at desc);
create index if not exists presence_coin_encouragements_ip_idx
  on public.presence_coin_encouragements (ip_hash, created_at desc);

alter table public.presence_coin_encouragements
  add column if not exists reporter_hashes text[] not null default '{}';

alter table public.presence_coin_encouragements enable row level security;
revoke all on public.presence_coin_encouragements from anon, authenticated;
