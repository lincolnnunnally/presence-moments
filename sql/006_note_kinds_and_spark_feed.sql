-- Note kinds, and a read-only feed of shown notes for Spark of Hope.
-- Owner direction, 2026-11-11: a "Thankful = Joyful" coin asks finders what they
-- are thankful for, lets them share something hard (kept private in Spark of
-- Hope, or shared after a person reads it), and the notes that are shown become
-- real hopeful content on spark-of-hope.com.
-- Applied to LPL as migration presence_note_kinds_and_spark_feed. Additive and idempotent.
--
-- Rollback:
--   drop function if exists public.spark_hope_notes(int);
--   alter table public.presence_coin_encouragements drop column if exists kind;

alter table public.presence_coin_encouragements
  add column if not exists kind text not null default 'encouragement';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'presence_coin_encouragements_kind_check'
  ) then
    alter table public.presence_coin_encouragements
      add constraint presence_coin_encouragements_kind_check
      check (kind in ('encouragement', 'thankful', 'struggle'));
  end if;
end $$;

-- Spark of Hope reads this with the public (anon) key. It returns only notes a
-- finder chose to post and that are currently shown: the same words, name and
-- time already public on the coin's own page. No ids of people, no ip hashes,
-- nothing held or hidden. The table itself stays closed to anon.
create or replace function public.spark_hope_notes(max_rows int default 24)
returns table (
  id uuid,
  kind text,
  message text,
  display_name text,
  created_at timestamptz,
  coin_words text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id,
         e.kind,
         e.message,
         coalesce(nullif(btrim(e.display_name), ''), 'A neighbor'),
         e.created_at,
         c.front_text
  from public.presence_coin_encouragements e
  join public.presence_coins c on c.id = e.coin_id
  where e.status = 'shown'
  order by e.created_at desc
  limit least(greatest(coalesce(max_rows, 24), 1), 60);
$$;

revoke all on function public.spark_hope_notes(int) from public;
grant execute on function public.spark_hope_notes(int) to anon, authenticated;
