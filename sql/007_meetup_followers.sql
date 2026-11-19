-- Weekly meetups on a Presence coin run (owner, 2026-11-19: "every Monday at
-- Birdies 10 am ... have people enter their email address so they can get
-- updates about meetings, reminder if they want ... if we are not meeting one
-- week I need to let people know").
--
-- The schedule, weeks off and details live in the run's batch notes, edited in
-- Laser Engraving -> Tokens. These tables hold who asked to hear about it and
-- what was already sent. Writes go through Presence and Laser with the service
-- role; nothing is granted to anon or authenticated.
-- Applied to LPL as migration presence_meetup_followers. Additive and idempotent.
-- Rollback: drop table public.presence_meetup_sends; drop table public.presence_meetup_followers;

create table if not exists public.presence_meetup_followers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.presence_coin_batches(id) on delete cascade,
  email text not null check (char_length(email) between 5 and 254),
  wants_reminder boolean not null default true,
  unsubscribe_token text not null default encode(gen_random_bytes(18), 'hex'),
  ip_hash text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists presence_meetup_followers_email_idx
  on public.presence_meetup_followers (batch_id, lower(email));
create unique index if not exists presence_meetup_followers_token_idx
  on public.presence_meetup_followers (unsubscribe_token);
create index if not exists presence_meetup_followers_ip_idx
  on public.presence_meetup_followers (ip_hash, created_at desc);

-- One row per email send, so a reminder for a date goes out once.
create table if not exists public.presence_meetup_sends (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.presence_coin_batches(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'week_off', 'back_on', 'update')),
  meeting_on date,
  recipients integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists presence_meetup_sends_reminder_idx
  on public.presence_meetup_sends (batch_id, meeting_on)
  where kind = 'reminder';

alter table public.presence_meetup_followers enable row level security;
alter table public.presence_meetup_sends enable row level security;
revoke all on public.presence_meetup_followers from anon, authenticated;
revoke all on public.presence_meetup_sends from anon, authenticated;
