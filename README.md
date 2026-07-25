# Presence

**Come as you are. Leave less alone.**

A small app for hosting and joining low-pressure, accepting local moments — coffee, walks, meals, game nights — with a clear culture of presence over performance and acceptance as the default.

Part of the **Life Produces Life** ecosystem. Accounts, identity, and the growth journey are shared across the family of apps, so a person is one person everywhere.

## What it does

- A cultural charter every host agrees to
- Host a Moment in under a minute (activity, time, place, vibes, charter agreement)
- Browse & filter real, cross-user Moments near you
- Request to join a Moment; the host reviews and accepts/declines
- Contributes to the shared UUG growth journey (hosting = giving, joining = receiving)

## Stack

- Next.js 15 (App Router) + TypeScript
- Shared Life Produces Life Supabase (LPL) — accounts, `presence_moments`,
  `presence_join_requests`, all with row-level security keyed to `auth.uid()`
- Shared identity via `lpl_people`; growth-journey via `uug_journey_*`
- Self-hosted Inter + Playfair Display via `next/font`

## Data model (LPL Supabase)

- `presence_moments` — a hosted moment (host, activity, time, place, city, vibes, capacity)
- `presence_join_requests` — a guest's request to join (status: requested / accepted / declined)

RLS: any signed-in person can discover open moments; only the host can edit their
own; guests see their own requests, hosts see requests to their moments.

## Local development

```bash
npm install
# .env.local needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY (shared LPL values)
npm run dev
```

## Next steps

- Post-moment feedback for culture health
- Reputation based on showing up + acceptance signals
- Location/map view and true "nearby"
- Chat that opens once a host accepts
- Church / outreach "open table" mode

Built with care for real human connection.
