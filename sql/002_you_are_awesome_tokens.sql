-- You Are Awesome tokens — Presence public journey + Laser ops cockpit
-- First pilot: Vidalia, GA. Production of coins is managed in Laser Engraving.
-- Apply on the shared LPL Supabase. Idempotent.

create extension if not exists pgcrypto;

-- ── Communities (a town / local initiative) ───────────────────────────────
create table if not exists public.presence_communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  region text,
  status text not null default 'pilot'
    check (status in ('pilot', 'active', 'paused')),
  notes text,
  created_at timestamptz not null default now()
);

-- ── Places (wonder spots + restaurants) ───────────────────────────────────
create table if not exists public.presence_places (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.presence_communities(id) on delete cascade,
  kind text not null check (kind in ('wonder', 'table')),
  name text not null,
  address text,
  city text,
  notice_prompt text,
  best_time text,
  contact_name text,
  contact_phone text,
  contact_email text,
  outreach_status text not null default 'not_contacted'
    check (outreach_status in ('not_contacted', 'introduced', 'confirmed', 'paused', 'declined')),
  last_contacted_at timestamptz,
  outreach_notes text,
  use_count int not null default 0,
  last_used_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists presence_places_community_idx
  on public.presence_places (community_id, kind, active);

-- ── Phrases (front/back engraving + the longer web message) ───────────────
create table if not exists public.presence_phrases (
  id uuid primary key default gen_random_uuid(),
  front_text text not null,
  back_text text,
  web_message text not null,
  kind text not null default 'any'
    check (kind in ('notice', 'place', 'table', 'any')),
  use_count int not null default 0,
  last_used_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (front_text, kind)
);

-- ── Waves (one engraving batch / one QR) ─────────────────────────────────
create table if not exists public.presence_waves (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.presence_communities(id) on delete restrict,
  code text not null unique,
  kind text not null check (kind in ('notice', 'place', 'table')),
  status text not null default 'draft'
    check (status in ('draft', 'engraving', 'planted', 'live', 'closed')),
  title text,
  phrase_id uuid references public.presence_phrases(id) on delete set null,
  place_id uuid references public.presence_places(id) on delete set null,
  quantity int not null default 25 check (quantity > 0),
  material text not null default 'wood coin',
  front_text text not null,
  back_text text,
  web_message text not null,
  invite_at timestamptz,
  invite_notes text,
  restaurant_status text not null default 'not_needed'
    check (restaurant_status in ('not_needed', 'not_contacted', 'introduced', 'confirmed', 'declined')),
  plant_notes text,
  planted_at timestamptz,
  found_count int not null default 0,
  sponsor_name text,
  sponsor_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists presence_waves_community_idx
  on public.presence_waves (community_id, status, invite_at);
create index if not exists presence_waves_code_idx
  on public.presence_waves (code);

-- ── Experiences (finder shares what they noticed) ─────────────────────────
create table if not exists public.presence_experiences (
  id uuid primary key default gen_random_uuid(),
  wave_id uuid not null references public.presence_waves(id) on delete cascade,
  auth_user_id uuid,
  display_name text,
  what_noticed text not null,
  created_at timestamptz not null default now()
);

create index if not exists presence_experiences_wave_idx
  on public.presence_experiences (wave_id, created_at desc);

-- ── Table-night RSVPs ─────────────────────────────────────────────────────
create table if not exists public.presence_wave_rsvps (
  id uuid primary key default gen_random_uuid(),
  wave_id uuid not null references public.presence_waves(id) on delete cascade,
  auth_user_id uuid not null,
  display_name text,
  status text not null default 'going'
    check (status in ('going', 'maybe', 'cant')),
  created_at timestamptz not null default now(),
  unique (wave_id, auth_user_id)
);

-- ── Staff tasks (engrave, call restaurant, plant, follow up) ──────────────
create table if not exists public.presence_staff_tasks (
  id uuid primary key default gen_random_uuid(),
  wave_id uuid references public.presence_waves(id) on delete cascade,
  community_id uuid references public.presence_communities(id) on delete cascade,
  kind text not null check (kind in ('engrave', 'call_restaurant', 'plant', 'follow_up')),
  title text not null,
  detail text,
  status text not null default 'open'
    check (status in ('open', 'done', 'skipped')),
  due_on date,
  assigned_to text,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists presence_staff_tasks_open_idx
  on public.presence_staff_tasks (status, due_on);

alter table public.presence_communities enable row level security;
alter table public.presence_places enable row level security;
alter table public.presence_phrases enable row level security;
alter table public.presence_waves enable row level security;
alter table public.presence_experiences enable row level security;
alter table public.presence_wave_rsvps enable row level security;
alter table public.presence_staff_tasks enable row level security;

-- Public reads go through Presence API (service role). Authenticated people
-- may read live waves and insert their own experience / RSVP from the client
-- if we ever wire it that way; Laser admin uses service role and bypasses RLS.

drop policy if exists presence_waves_public_read on public.presence_waves;
create policy presence_waves_public_read
  on public.presence_waves for select
  to anon, authenticated
  using (status in ('engraving', 'planted', 'live', 'closed'));

drop policy if exists presence_phrases_public_read on public.presence_phrases;
create policy presence_phrases_public_read
  on public.presence_phrases for select
  to anon, authenticated
  using (active = true);

drop policy if exists presence_places_public_read on public.presence_places;
create policy presence_places_public_read
  on public.presence_places for select
  to anon, authenticated
  using (active = true);

drop policy if exists presence_communities_public_read on public.presence_communities;
create policy presence_communities_public_read
  on public.presence_communities for select
  to anon, authenticated
  using (true);

drop policy if exists presence_experiences_public_read on public.presence_experiences;
create policy presence_experiences_public_read
  on public.presence_experiences for select
  to anon, authenticated
  using (true);

drop policy if exists presence_experiences_own_insert on public.presence_experiences;
create policy presence_experiences_own_insert
  on public.presence_experiences for insert
  to authenticated
  with check (auth.uid() = auth_user_id);

drop policy if exists presence_rsvps_own_read on public.presence_wave_rsvps;
create policy presence_rsvps_own_read
  on public.presence_wave_rsvps for select
  to authenticated
  using (auth.uid() = auth_user_id);

drop policy if exists presence_rsvps_own_write on public.presence_wave_rsvps;
create policy presence_rsvps_own_write
  on public.presence_wave_rsvps for insert
  to authenticated
  with check (auth.uid() = auth_user_id);

drop policy if exists presence_rsvps_own_update on public.presence_wave_rsvps;
create policy presence_rsvps_own_update
  on public.presence_wave_rsvps for update
  to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

grant select on public.presence_communities to anon, authenticated;
grant select on public.presence_places to anon, authenticated;
grant select on public.presence_phrases to anon, authenticated;
grant select on public.presence_waves to anon, authenticated;
grant select on public.presence_experiences to anon, authenticated;
grant select, insert, update on public.presence_wave_rsvps to authenticated;
grant insert on public.presence_experiences to authenticated;

-- ── Seed: Vidalia, GA ─────────────────────────────────────────────────────
insert into public.presence_communities (id, slug, name, region, status, notes)
values (
  '00000000-0000-4000-a000-000000000001',
  'vidalia-ga',
  'Vidalia, Georgia',
  'Toombs County, GA',
  'pilot',
  'First You Are Awesome pilot. Tokens find people; Presence is the door; Laser runs production and the weekly memory.'
)
on conflict (slug) do update set
  name = excluded.name,
  region = excluded.region,
  notes = excluded.notes;

-- Wonder places (real public spots — not invented). Prompts invite noticing, not a scavenger hunt.
insert into public.presence_places (
  id, community_id, kind, name, address, city, notice_prompt, best_time, outreach_status, active
) values
  (
    '00000000-0000-4000-a000-000000000201',
    '00000000-0000-4000-a000-000000000001',
    'wonder',
    'Vidalia Onion Fountain',
    'Behind City Hall, 114 Jackson Street',
    'Vidalia, GA',
    'Stay for the stainless-steel onion in the basin. After dark the lights and water do a quiet little show. Let it interrupt whatever you were carrying.',
    'After dark, or a slow afternoon',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000202',
    '00000000-0000-4000-a000-000000000001',
    'wonder',
    'Be Sweet mural & downtown streets',
    'Downtown historic district',
    'Vidalia, GA',
    'Walk the historic block. Look up at the brick, the mural, the oaks. Small-town beauty is easy to rush past.',
    'Late afternoon light',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000203',
    '00000000-0000-4000-a000-000000000001',
    'wonder',
    'Ben Smith Park',
    'Thompson Street between NW Main and Pine',
    'Vidalia, GA',
    'A simple park. In summer the splash pad lights up at night. Any evening, sit still long enough to hear kids, birds, or just the quiet.',
    'Evening, especially in splash-pad season (Memorial Day–Labor Day)',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000204',
    '00000000-0000-4000-a000-000000000001',
    'wonder',
    'PAL Theatre',
    'Downtown Vidalia',
    'Vidalia, GA',
    'A 1927 theater still doing its work. Even from the sidewalk, notice that people have gathered here for almost a hundred years.',
    'When the marquee is lit',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000205',
    '00000000-0000-4000-a000-000000000001',
    'wonder',
    'Altama Museum of Art & History (Brazell House)',
    'Neoclassical Brazell House, Vidalia',
    'Vidalia, GA',
    'The house itself is worth a look. Slow down for the porch, the trees, the fact that beauty was built here on purpose.',
    'Open museum hours, or a walk-by any day',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000206',
    '00000000-0000-4000-a000-000000000001',
    'wonder',
    'Ed Smith Complex walking trail',
    'Ed Smith Recreational Complex',
    'Vidalia, GA',
    'Walk the trail without headphones if you can. Let your body move. Notice the sky changing.',
    'Sunrise or sunset',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000207',
    '00000000-0000-4000-a000-000000000001',
    'wonder',
    'West sky over downtown',
    'Any west-facing street or parking edge downtown',
    'Vidalia, GA',
    'You do not need a famous overlook. Face west near dusk. Watch the color change. Wonder is not a luxury.',
    'Dusk, about 20 minutes before sunset',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000208',
    '00000000-0000-4000-a000-000000000001',
    'wonder',
    'Altamaha River (short drive)',
    'Outfitters within about 20 minutes of Vidalia',
    'Near Vidalia, GA',
    'Georgia''s "Little Amazon" — cypress, Spanish moss, sometimes eagles. Even from a bank, the river is older than the worry you brought.',
    'Daylight; go with someone if you paddle',
    'not_contacted',
    true
  )
on conflict (id) do update set
  notice_prompt = excluded.notice_prompt,
  best_time = excluded.best_time,
  address = excluded.address;

-- Restaurants: local names, honestly uncontacted. Do not present as partners.
insert into public.presence_places (
  id, community_id, kind, name, address, city, notice_prompt, best_time, outreach_status, active
) values
  (
    '00000000-0000-4000-a000-000000000301',
    '00000000-0000-4000-a000-000000000001',
    'table',
    'Rialto',
    '120 Jackson Street',
    'Vidalia, GA',
    'Downtown Italian. A table is the point — not a performance.',
    'Dinner, about 7:00 p.m.',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000302',
    '00000000-0000-4000-a000-000000000001',
    'table',
    'Tappas',
    '201 W Main Street',
    'Vidalia, GA',
    'A small downtown cafe. Easy to find, easy to sit.',
    'Lunch or early dinner',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000303',
    '00000000-0000-4000-a000-000000000001',
    'table',
    'Downtown Bistro & Catering',
    '101 E Meadows Street',
    'Vidalia, GA',
    'Local and unhurried. A handful of people can share a table without taking over the room.',
    'Dinner',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000304',
    '00000000-0000-4000-a000-000000000001',
    'table',
    'Ohoopee River Brewing Co',
    'Downtown Vidalia',
    'Vidalia, GA',
    'Local gathering place. Keep the invitation small and honest — a few people, paying for their own food.',
    'Early evening',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000305',
    '00000000-0000-4000-a000-000000000001',
    'table',
    'The Sandwiche Shoppe',
    '213 Green Street',
    'Vidalia, GA',
    'A loved local lunch counter. Better for a noon table than a late dinner.',
    'Lunch',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000306',
    '00000000-0000-4000-a000-000000000001',
    'table',
    'Kountry Kafe',
    '115 SE Main Street',
    'Vidalia, GA',
    'Breakfast and simple plates. A morning table can be as much belonging as dinner.',
    'Breakfast or lunch',
    'not_contacted',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000307',
    '00000000-0000-4000-a000-000000000001',
    'table',
    'Hardware Pizza (Lyons)',
    'Lyons, a short drive from Vidalia',
    'Lyons, GA',
    'Nearby, well-loved. Use when Vidalia tables are already in rotation this month.',
    'Dinner',
    'not_contacted',
    true
  )
on conflict (id) do update set
  address = excluded.address,
  notice_prompt = excluded.notice_prompt,
  best_time = excluded.best_time;

-- Phrases. Front text is what the laser actually burns (keep short).
insert into public.presence_phrases (id, front_text, back_text, web_message, kind, active) values
  (
    '00000000-0000-4000-a000-000000000101',
    'YOU ARE AWESOME',
    'Look up · scan',
    'You are awesome. Not later — now. Take a minute. Look up. Notice one good thing around you: the sky, a tree, a kind face, a warm meal. When you see it, let it take some of the weight off. You are not alone in this place, and you are not alone in this town.',
    'any',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000102',
    'LOOK UP',
    'Scan me',
    'Look up. The sky is still doing its work. Pause long enough to see something beautiful that was already here before the stress was. You do not have to fix everything in this minute. You only have to notice.',
    'notice',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000103',
    'YOU ARE WANTED',
    'Come as you are',
    'Someone made this so it could find you. You are wanted. You are appreciated. If you want a table with other people who found a coin like this, the next invitation is on this page. Come as you are. You do not have to be impressive.',
    'table',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000104',
    'YOU ARE NOT ALONE',
    'Look around',
    'You are not alone in this place, in this town, or in this life. Look around. There is goodness already moving — in nature, in a stranger''s kindness, in people who would be glad you showed up. Take one next step when you are ready.',
    'any',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000105',
    'TAKE A MINUTE',
    'Notice one good thing',
    'Take a minute. Not a self-improvement project. Just a minute. Breathe. Look. Let something beautiful interrupt the noise. Then keep going, a little lighter.',
    'notice',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000106',
    'NOTICE THE GOOD',
    'It was already here',
    'The good things do not shout. They wait to be noticed: light on a building, moss on an oak, someone holding a door, a sunset you almost drove past. Notice one. That is enough for now.',
    'notice',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000107',
    'PAUSE HERE',
    'Stay a minute',
    'Pause here. You found this for a reason. Stay long enough to see the place you are standing. Beauty is a kind of help. Let it help.',
    'place',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000108',
    'COME TO THE TABLE',
    'You don''t have to know anyone',
    'A table is waiting. You do not have to know anyone. You do not have to be impressive. Show up. Receive a seat. Belonging starts with one yes — and the win is the table, not this screen.',
    'table',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000109',
    'SEE THE SKY',
    'Dusk is enough',
    'See the sky. Same sky over everyone in town tonight. If you can, go watch it change color. Wonder is not a luxury. It is how hope gets back in.',
    'notice',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000110',
    'SOMEONE SEES YOU',
    'You matter',
    'Someone sees you. This little coin is a reminder, not a demand. You matter. If you want people who will build you up, there is a next step on this page when you are ready. No rush. No score.',
    'any',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000111',
    'LOOK AROUND',
    'The good is nearby',
    'Look around. The world is not only the thing that is stressing you. There is still a tree, a sky, a meal, a person. Start with one of them.',
    'notice',
    true
  ),
  (
    '00000000-0000-4000-a000-000000000112',
    'SLOW DOWN',
    'One beautiful thing',
    'Slow down. One beautiful thing is enough: a porch, a riverbank, a plate of food, a face that is glad you came. Put the phone down after you read this. The moment is out there.',
    'any',
    true
  )
on conflict (id) do update set
  back_text = excluded.back_text,
  web_message = excluded.web_message,
  kind = excluded.kind,
  active = excluded.active;

-- A live notice wave so the first QR path works before any restaurant is confirmed.
insert into public.presence_waves (
  id, community_id, code, kind, status, title, phrase_id, place_id,
  quantity, material, front_text, back_text, web_message, restaurant_status,
  plant_notes
) values (
  '00000000-0000-4000-a000-000000000501',
  '00000000-0000-4000-a000-000000000001',
  'LOOKUP',
  'notice',
  'live',
  'Vidalia — look up',
  '00000000-0000-4000-a000-000000000102',
  '00000000-0000-4000-a000-000000000207',
  25,
  'wood coin',
  'LOOK UP',
  'Scan me',
  'Look up. The sky is still doing its work. Pause long enough to see something beautiful that was already here before the stress was. You do not have to fix everything in this minute. You only have to notice.',
  'not_needed',
  'Plant a few downtown, a few near the onion fountain, a few where people actually sit — benches, park edges, not private property.'
)
on conflict (code) do update set
  web_message = excluded.web_message,
  plant_notes = excluded.plant_notes,
  status = excluded.status;
