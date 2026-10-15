-- Presence Connect: opt-in 1:1 "coffee / bar / meal this week".
-- Idempotent. Applied to shared LPL Supabase (uqhqulrqcygsmmzdzemx) as migration presence_connect_003.
-- Not run by any build script. Apply by hand (see sql/apply.sh pattern).
-- Privacy: exact lat/lng (ZIP center, rounded ~1 km) never leave the owner row; others only get a
-- distance band (public.geo_distance_band) via SECURITY DEFINER RPCs. No email/SMS anywhere.
-- Rollback: sql/003_connect_rollback.sql

create table if not exists public.presence_connect_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 40),
  interests text[] not null default '{}',
  value_tags text[] not null default '{}',
  zip text,
  city text,
  lat double precision,
  lng double precision,
  connect_on boolean not null default false,
  connect_on_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.presence_connect_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.presence_connect_proposals (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('coffee','bar','meal')),
  place_name text not null check (char_length(place_name) between 1 and 120),
  place_address text check (char_length(place_address) <= 200),
  times timestamptz[] not null,
  chosen_time timestamptz,
  status text not null default 'proposed'
    check (status in ('proposed','confirmed','declined','expired','cancelled')),
  expires_at timestamptz not null,
  proposer_happened_at timestamptz,
  recipient_happened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposer_id <> recipient_id)
);
create index if not exists presence_connect_proposals_proposer on public.presence_connect_proposals(proposer_id, status);
create index if not exists presence_connect_proposals_recipient on public.presence_connect_proposals(recipient_id, status);

create table if not exists public.presence_connect_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid references public.presence_connect_proposals(id) on delete cascade,
  kind text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists presence_connect_notices_user on public.presence_connect_notices(user_id, read, created_at desc);

alter table public.presence_connect_profiles enable row level security;
alter table public.presence_connect_blocks enable row level security;
alter table public.presence_connect_proposals enable row level security;
alter table public.presence_connect_notices enable row level security;

-- Own profile only. Other people's fields come only from presence_connect_matches().
drop policy if exists pcp_own on public.presence_connect_profiles;
create policy pcp_own on public.presence_connect_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists pcb_own on public.presence_connect_blocks;
create policy pcb_own on public.presence_connect_blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Proposals: read your own; all writes go through RPCs.
drop policy if exists pcpr_read on public.presence_connect_proposals;
create policy pcpr_read on public.presence_connect_proposals for select to authenticated
  using (auth.uid() in (proposer_id, recipient_id));

drop policy if exists pcn_read on public.presence_connect_notices;
create policy pcn_read on public.presence_connect_notices for select to authenticated
  using (user_id = auth.uid());
drop policy if exists pcn_mark on public.presence_connect_notices;
create policy pcn_mark on public.presence_connect_notices for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.presence_connect_profiles, public.presence_connect_blocks,
  public.presence_connect_proposals, public.presence_connect_notices from anon;
grant select, insert, update, delete on public.presence_connect_profiles to authenticated;
grant select, insert, delete on public.presence_connect_blocks to authenticated;
grant select on public.presence_connect_proposals to authenticated;
grant select, update (read) on public.presence_connect_notices to authenticated;

-- On = toggled on within the last 7 days (gentle re-confirm after that).
create or replace function public.presence_connect_is_on(p public.presence_connect_profiles)
returns boolean language sql stable as $$
  select p.connect_on and p.connect_on_since > now() - interval '7 days'
$$;

create or replace function public.presence_connect_miles(alat float8, alng float8, blat float8, blng float8)
returns float8 language sql immutable as $$
  select 3958.8 * 2 * asin(sqrt(
    power(sin(radians(blat - alat) / 2), 2) +
    cos(radians(alat)) * cos(radians(blat)) * power(sin(radians(blng - alng) / 2), 2)))
$$;

create or replace function public.presence_connect_set(p_on boolean)
returns public.presence_connect_profiles language plpgsql security definer set search_path = public as $$
declare r public.presence_connect_profiles;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into presence_connect_profiles (user_id, connect_on, connect_on_since)
  values (auth.uid(), p_on, case when p_on then now() end)
  on conflict (user_id) do update set connect_on = p_on,
    connect_on_since = case when p_on then now() else null end, updated_at = now()
  returning * into r;
  return r;
end $$;

-- Lazy expiry, run from the read/write RPCs.
create or replace function public.presence_connect_expire()
returns void language plpgsql security definer set search_path = public as $$
declare x record;
begin
  for x in update presence_connect_proposals set status = 'expired', updated_at = now()
    where status = 'proposed' and expires_at <= now()
    returning id, proposer_id, recipient_id loop
    insert into presence_connect_notices (user_id, proposal_id, kind, message)
    values (x.proposer_id, x.id, 'expired', 'A proposal expired without a confirmed time. No worries — try again anytime.');
  end loop;
end $$;

create or replace function public.presence_connect_matches()
returns table (user_id uuid, first_name text, shared text[], distance text)
language plpgsql stable security definer set search_path = public as $$
declare me public.presence_connect_profiles;
begin
  select * into me from presence_connect_profiles where presence_connect_profiles.user_id = auth.uid();
  if me.user_id is null or not presence_connect_is_on(me) or me.lat is null then return; end if;
  return query
  select o.user_id, split_part(trim(o.first_name), ' ', 1),
    array(select unnest(o.interests || o.value_tags) intersect select unnest(me.interests || me.value_tags)),
    geo_distance_band(presence_connect_miles(me.lat, me.lng, o.lat, o.lng) * 1609.34)
  from presence_connect_profiles o
  where o.user_id <> me.user_id and presence_connect_is_on(o) and o.lat is not null
    and (o.interests || o.value_tags) && (me.interests || me.value_tags)
    and presence_connect_miles(me.lat, me.lng, o.lat, o.lng) <= 25
    and not exists (select 1 from presence_connect_blocks b
      where (b.blocker_id = me.user_id and b.blocked_id = o.user_id)
         or (b.blocker_id = o.user_id and b.blocked_id = me.user_id))
  order by presence_connect_miles(me.lat, me.lng, o.lat, o.lng)
  limit 12;
end $$;

-- Rate limit: 3 open proposals per proposer; one open proposal per pair.
create or replace function public.presence_connect_propose(
  p_recipient uuid, p_kind text, p_place_name text, p_place_address text, p_times timestamptz[])
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; n int;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not exists (select 1 from presence_connect_matches() m where m.user_id = p_recipient) then
    raise exception 'That person is not available to connect right now.';
  end if;
  if coalesce(array_length(p_times, 1), 0) not between 1 and 3 then raise exception 'Offer 1 to 3 times.'; end if;
  if exists (select 1 from unnest(p_times) t where t <= now() or t > now() + interval '8 days') then
    raise exception 'Times must be within the next week.';
  end if;
  perform presence_connect_expire();
  select count(*) into n from presence_connect_proposals where proposer_id = auth.uid() and status = 'proposed';
  if n >= 3 then raise exception 'You already have 3 open proposals. Wait for an answer first.'; end if;
  if exists (select 1 from presence_connect_proposals where status = 'proposed'
      and ((proposer_id = auth.uid() and recipient_id = p_recipient) or (proposer_id = p_recipient and recipient_id = auth.uid()))) then
    raise exception 'There is already an open proposal between you two.';
  end if;
  insert into presence_connect_proposals (proposer_id, recipient_id, kind, place_name, place_address, times, expires_at)
  values (auth.uid(), p_recipient, p_kind, left(trim(p_place_name), 120), left(trim(p_place_address), 200),
    (select array_agg(t order by t) from unnest(p_times) t),
    least((select min(t) from unnest(p_times) t), now() + interval '72 hours'))
  returning id into pid;
  insert into presence_connect_notices (user_id, proposal_id, kind, message)
  select p_recipient, pid, 'proposal',
    coalesce(nullif(split_part(trim(first_name), ' ', 1), ''), 'Someone nearby') || ' invited you for ' || p_kind || ' at ' || left(trim(p_place_name), 120) || '. Pick a time or decline.'
  from presence_connect_profiles where user_id = auth.uid();
  return pid;
end $$;

-- p_time null = decline.
create or replace function public.presence_connect_respond(p_id uuid, p_time timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare pr public.presence_connect_proposals; nm text;
begin
  perform presence_connect_expire();
  select * into pr from presence_connect_proposals where id = p_id and recipient_id = auth.uid() for update;
  if pr.id is null then raise exception 'Not found.'; end if;
  if pr.status <> 'proposed' then raise exception 'This proposal is %.', pr.status; end if;
  select coalesce(nullif(split_part(trim(first_name), ' ', 1), ''), 'They') into nm from presence_connect_profiles where user_id = auth.uid();
  if p_time is null then
    update presence_connect_proposals set status = 'declined', updated_at = now() where id = p_id;
    insert into presence_connect_notices (user_id, proposal_id, kind, message)
    values (pr.proposer_id, p_id, 'declined', coalesce(nm, 'They') || ' can''t make it this time. That is okay.');
    return 'declined';
  end if;
  if not (p_time = any(pr.times)) or p_time <= now() then raise exception 'Pick one of the offered times.'; end if;
  update presence_connect_proposals set status = 'confirmed', chosen_time = p_time, updated_at = now() where id = p_id;
  insert into presence_connect_notices (user_id, proposal_id, kind, message)
  values (pr.proposer_id, p_id, 'confirmed', coalesce(nm, 'They') || ' said yes: ' || pr.kind || ' at ' || pr.place_name || '.');
  return 'confirmed';
end $$;

create or replace function public.presence_connect_cancel(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pr public.presence_connect_proposals;
begin
  update presence_connect_proposals set status = 'cancelled', updated_at = now()
  where id = p_id and auth.uid() in (proposer_id, recipient_id) and status in ('proposed','confirmed')
    and (chosen_time is null or chosen_time > now())
  returning * into pr;
  if pr.id is null then raise exception 'Nothing to cancel.'; end if;
  insert into presence_connect_notices (user_id, proposal_id, kind, message)
  values (case when pr.proposer_id = auth.uid() then pr.recipient_id else pr.proposer_id end, p_id, 'cancelled',
    'A ' || pr.kind || ' plan at ' || pr.place_name || ' was cancelled.');
end $$;

-- Per-person "it happened", only after the confirmed time.
create or replace function public.presence_connect_happened(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update presence_connect_proposals set
    proposer_happened_at = case when proposer_id = auth.uid() then coalesce(proposer_happened_at, now()) else proposer_happened_at end,
    recipient_happened_at = case when recipient_id = auth.uid() then coalesce(recipient_happened_at, now()) else recipient_happened_at end,
    updated_at = now()
  where id = p_id and auth.uid() in (proposer_id, recipient_id) and status = 'confirmed' and chosen_time <= now();
  if not found then raise exception 'You can mark it after the meetup time.'; end if;
end $$;

-- My proposals with the other person's first name only.
create or replace function public.presence_connect_my_proposals()
returns table (id uuid, role text, other_name text, kind text, place_name text, place_address text,
  times timestamptz[], chosen_time timestamptz, status text, expires_at timestamptz,
  i_marked_happened boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform presence_connect_expire();
  return query
  select p.id, case when p.proposer_id = auth.uid() then 'proposer' else 'recipient' end,
    coalesce(nullif(split_part(trim(o.first_name), ' ', 1), ''), 'Neighbor'),
    p.kind, p.place_name, p.place_address, p.times, p.chosen_time, p.status, p.expires_at,
    (case when p.proposer_id = auth.uid() then p.proposer_happened_at else p.recipient_happened_at end) is not null,
    p.created_at
  from presence_connect_proposals p
  left join presence_connect_profiles o on o.user_id = case when p.proposer_id = auth.uid() then p.recipient_id else p.proposer_id end
  where auth.uid() in (p.proposer_id, p.recipient_id)
  order by p.created_at desc limit 30;
end $$;

-- Neighborly door: status by email. Server-side only (not exposed to anon/authenticated).
create or replace function public.presence_connect_status_by_email(p_email text)
returns table (connect_on boolean, connect_on_since timestamptz, expired boolean, open_proposals int)
language sql stable security definer set search_path = public as $$
  select coalesce(c.connect_on, false), c.connect_on_since,
    coalesce(c.connect_on and c.connect_on_since <= now() - interval '7 days', false),
    (select count(*)::int from presence_connect_proposals p where u.id in (p.proposer_id, p.recipient_id) and p.status in ('proposed','confirmed') and coalesce(p.chosen_time, p.expires_at) > now())
  from auth.users u left join presence_connect_profiles c on c.user_id = u.id
  where lower(u.email) = lower(trim(p_email)) limit 1
$$;

revoke all on function public.presence_connect_status_by_email(text) from public, anon, authenticated;
revoke all on function public.presence_connect_expire() from public, anon;
revoke all on function public.presence_connect_set(boolean), public.presence_connect_matches(),
  public.presence_connect_propose(uuid, text, text, text, timestamptz[]), public.presence_connect_respond(uuid, timestamptz),
  public.presence_connect_cancel(uuid), public.presence_connect_happened(uuid), public.presence_connect_my_proposals()
  from public, anon;
grant execute on function public.presence_connect_set(boolean), public.presence_connect_matches(),
  public.presence_connect_propose(uuid, text, text, text, timestamptz[]), public.presence_connect_respond(uuid, timestamptz),
  public.presence_connect_cancel(uuid), public.presence_connect_happened(uuid), public.presence_connect_my_proposals(),
  public.presence_connect_expire()
  to authenticated;
