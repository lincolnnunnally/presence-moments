-- Token impact: what was made, where it went, who it reached, and how it helped.
-- So a church or foundation can be told honestly: this many coins, these towns,
-- this many people found one, this many said it helped, this many connected.
-- Writes go through the Presence API and Laser admin (service role). Nothing is
-- granted to anon or authenticated. Applied to LPL as migration
-- presence_token_impact. Idempotent.

-- Where a scan came from (Vercel geo headers: town, region, country; no IP kept).
alter table public.presence_coin_scans add column if not exists city text;
alter table public.presence_coin_scans add column if not exists region text;
alter table public.presence_coin_scans add column if not exists country text;

-- What a finder did on the page: did it help, what they were carrying, what they tapped.
create table if not exists public.presence_coin_events (
  id uuid primary key default gen_random_uuid(),
  coin_id uuid not null references public.presence_coins(id) on delete cascade,
  batch_id uuid references public.presence_coin_batches(id) on delete cascade,
  kind text not null check (kind in (
    'helped', 'carrying',
    'click_facebook', 'click_instagram', 'click_meetup', 'click_church', 'click_give', 'click_order', 'share'
  )),
  detail text check (detail is null or char_length(detail) <= 40),
  ip_hash text,
  city text,
  region text,
  country text,
  created_at timestamptz not null default now()
);
create index if not exists presence_coin_events_batch_idx on public.presence_coin_events (batch_id, kind, created_at desc);
create index if not exists presence_coin_events_ip_idx on public.presence_coin_events (ip_hash, kind, created_at desc);

-- The coin log: made in the shop, planted around town, or given to a group.
create table if not exists public.presence_coin_drops (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.presence_coin_batches(id) on delete set null,
  order_id uuid,
  kind text not null check (kind in ('made', 'planted', 'given')),
  quantity int not null check (quantity > 0 and quantity <= 100000),
  city text,
  state text,
  place_note text,
  happened_on date not null default current_date,
  note text,
  logged_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists presence_coin_drops_batch_idx on public.presence_coin_drops (batch_id, kind, happened_on desc);

-- Coin requests: a person, church, or group asks for coins; Lincoln delivers.
-- A gift toward the cost is optional and happens on the giving page, not here.
create table if not exists public.presence_coin_orders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (phone is null or char_length(phone) <= 40),
  organization text check (organization is null or char_length(organization) <= 160),
  city text check (city is null or char_length(city) <= 80),
  state text check (state is null or char_length(state) <= 40),
  quantity int not null check (quantity between 1 and 100000),
  themes text[] not null default '{}',
  wording text check (wording is null or char_length(wording) <= 500),
  purpose text check (purpose is null or char_length(purpose) <= 2000),
  needed_by date,
  will_give boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'making', 'delivered', 'declined')),
  admin_note text,
  notified_at timestamptz,
  delivered_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists presence_coin_orders_status_idx on public.presence_coin_orders (status, created_at desc);

-- Phrases Lincoln writes himself in Laser (the built-in library lives in Laser code).
create table if not exists public.presence_coin_phrases (
  id uuid primary key default gen_random_uuid(),
  front_text text not null check (char_length(front_text) between 2 and 40),
  back_text text check (back_text is null or char_length(back_text) <= 60),
  web_message text not null check (char_length(web_message) between 3 and 1000),
  theme text not null default 'any',
  design text,
  verse_ref text,
  verse_text text,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.presence_coin_events enable row level security;
alter table public.presence_coin_drops enable row level security;
alter table public.presence_coin_orders enable row level security;
alter table public.presence_coin_phrases enable row level security;
revoke all on public.presence_coin_events, public.presence_coin_drops,
  public.presence_coin_orders, public.presence_coin_phrases from anon, authenticated;

-- One call for the whole impact picture over a date range (null = all time).
-- Aggregates only: no names, emails, or note text leave this function.
create or replace function public.presence_token_impact(p_since date default null, p_until date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
rng as (
  select coalesce(p_since, date '1900-01-01') as a, coalesce(p_until, date '2999-12-31') as b
),
runs as (
  select b.id, b.city, b.state, c.id as coin_id, c.front_text, c.moment_id
  from presence_coin_batches b
  left join presence_coins c on c.batch_id = b.id and c.serial = 1
),
drops as (
  select d.kind, d.quantity, d.batch_id, d.happened_on,
         coalesce(nullif(d.city, ''), r.city) as town, coalesce(nullif(d.state, ''), r.state) as st,
         r.front_text
  from presence_coin_drops d left join runs r on r.id = d.batch_id, rng
  where d.happened_on between rng.a and rng.b
),
finds as (
  select s.ip_hash, s.created_at, r.id as batch_id, r.city as town, r.state as st, r.front_text,
         nullif(s.city, '') as geo_city, nullif(s.region, '') as geo_region
  from presence_coin_scans s join runs r on r.coin_id = s.coin_id, rng
  where s.kind = 'found' and s.created_at::date between rng.a and rng.b
),
notes as (
  select e.created_at, r.id as batch_id, r.city as town, r.state as st, r.front_text
  from presence_coin_encouragements e join runs r on r.id = e.batch_id, rng
  where e.status = 'shown' and e.created_at::date between rng.a and rng.b
),
ev as (
  select e.kind, e.detail, e.ip_hash, e.created_at, r.city as town, r.state as st, r.front_text
  from presence_coin_events e join runs r on r.id = e.batch_id, rng
  where e.created_at::date between rng.a and rng.b
),
helped as (
  select * from ev where kind = 'helped' and detail in ('yes', 'a_little')
),
ord as (
  select o.* from presence_coin_orders o, rng where o.created_at::date between rng.a and rng.b
),
rsvp as (
  select count(*) as n from presence_join_requests j
  join runs r on r.moment_id = j.moment_id, rng
  where j.status = 'accepted' and j.created_at::date between rng.a and rng.b
),
towns as (
  select town, st from drops where kind in ('planted', 'given') and town is not null
  union select town, st from finds where town is not null
  union select geo_city, geo_region from finds where geo_city is not null
)
select jsonb_build_object(
  'since', p_since,
  'until', p_until,
  'coins_made', coalesce((select sum(quantity) from drops where kind = 'made'), 0),
  'coins_planted', coalesce((select sum(quantity) from drops where kind = 'planted'), 0),
  'coins_given', coalesce((select sum(quantity) from drops where kind = 'given'), 0),
  'coins_out', coalesce((select sum(quantity) from drops where kind in ('planted', 'given')), 0),
  'runs', (select count(distinct batch_id) from drops),
  'phrases', (select count(distinct front_text) from drops where front_text is not null),
  'towns', (select count(*) from (select distinct lower(town), lower(coalesce(st, '')) from towns) t),
  'finds', (select count(*) from finds),
  'finders', (select count(distinct ip_hash) from finds where ip_hash is not null),
  'notes', (select count(*) from notes),
  'helped', jsonb_build_object(
    'yes', (select count(*) from ev where kind = 'helped' and detail = 'yes'),
    'a_little', (select count(*) from ev where kind = 'helped' and detail = 'a_little'),
    'not_today', (select count(*) from ev where kind = 'helped' and detail = 'not_today')
  ),
  'carrying', coalesce((select jsonb_object_agg(detail, n) from (
      select detail, count(*) as n from ev where kind = 'carrying' and detail is not null group by detail) c), '{}'::jsonb),
  'connections', jsonb_build_object(
    'facebook', (select count(*) from ev where kind = 'click_facebook'),
    'instagram', (select count(*) from ev where kind = 'click_instagram'),
    'meetup', (select count(*) from ev where kind = 'click_meetup'),
    'church', (select count(*) from ev where kind = 'click_church'),
    'give', (select count(*) from ev where kind = 'click_give'),
    'share', (select count(*) from ev where kind = 'share'),
    'table_rsvps', (select n from rsvp)
  ),
  'orders', jsonb_build_object(
    'requests', (select count(*) from ord),
    'coins_requested', coalesce((select sum(quantity) from ord where status <> 'declined'), 0),
    'delivered', (select count(*) from ord where status = 'delivered')
  ),
  'by_town', coalesce((select jsonb_agg(t order by t.coins_out desc, t.finds desc) from (
      select k.town, k.st as state,
        coalesce((select sum(quantity) from drops d where d.kind in ('planted', 'given') and lower(d.town) = lower(k.town) and lower(coalesce(d.st, '')) = lower(coalesce(k.st, ''))), 0) as coins_out,
        (select count(*) from finds f where lower(f.town) = lower(k.town) and lower(coalesce(f.st, '')) = lower(coalesce(k.st, ''))) as finds,
        (select count(*) from notes n where lower(n.town) = lower(k.town) and lower(coalesce(n.st, '')) = lower(coalesce(k.st, ''))) as notes,
        (select count(*) from helped h where lower(h.town) = lower(k.town) and lower(coalesce(h.st, '')) = lower(coalesce(k.st, ''))) as helped
      from (select distinct on (lower(town), lower(coalesce(st, ''))) town, st from (
              select town, st from drops where town is not null
              union all select town, st from finds where town is not null) x) k) t), '[]'::jsonb),
  'by_phrase', coalesce((select jsonb_agg(p order by p.coins_out desc, p.finds desc) from (
      select k.front_text,
        (select count(distinct id) from runs r where r.front_text = k.front_text) as runs,
        coalesce((select sum(quantity) from drops d where d.kind in ('planted', 'given') and d.front_text = k.front_text), 0) as coins_out,
        (select count(*) from finds f where f.front_text = k.front_text) as finds,
        (select count(*) from notes n where n.front_text = k.front_text) as notes,
        (select count(*) from helped h where h.front_text = k.front_text) as helped
      from (select distinct front_text from drops where front_text is not null
            union select distinct front_text from finds where front_text is not null) k) p), '[]'::jsonb),
  'by_month', coalesce((select jsonb_agg(m order by m.month) from (
      select k.month,
        coalesce((select sum(quantity) from drops d where d.kind in ('planted', 'given') and to_char(d.happened_on, 'YYYY-MM') = k.month), 0) as coins_out,
        (select count(*) from finds f where to_char(f.created_at, 'YYYY-MM') = k.month) as finds,
        (select count(*) from notes n where to_char(n.created_at, 'YYYY-MM') = k.month) as notes,
        (select count(*) from helped h where to_char(h.created_at, 'YYYY-MM') = k.month) as helped
      from (select to_char(happened_on, 'YYYY-MM') as month from drops
            union select to_char(created_at, 'YYYY-MM') from finds
            union select to_char(created_at, 'YYYY-MM') from notes) k) m), '[]'::jsonb),
  'first_day', (select min(d) from (
      select min(happened_on) as d from drops union all select min(created_at)::date from finds) z)
);
$$;

revoke all on function public.presence_token_impact(date, date) from public, anon, authenticated;
grant execute on function public.presence_token_impact(date, date) to service_role;
