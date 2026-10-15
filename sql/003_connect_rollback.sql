-- Rollback for 003_connect.sql (drops Connect data).
drop function if exists public.presence_connect_status_by_email(text), public.presence_connect_my_proposals(),
  public.presence_connect_happened(uuid), public.presence_connect_cancel(uuid), public.presence_connect_respond(uuid, timestamptz),
  public.presence_connect_propose(uuid, text, text, text, timestamptz[]), public.presence_connect_matches(),
  public.presence_connect_expire(), public.presence_connect_set(boolean),
  public.presence_connect_miles(float8, float8, float8, float8), public.presence_connect_is_on(public.presence_connect_profiles);
drop table if exists public.presence_connect_notices, public.presence_connect_proposals,
  public.presence_connect_blocks, public.presence_connect_profiles;
