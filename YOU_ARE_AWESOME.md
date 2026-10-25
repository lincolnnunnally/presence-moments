# You Are Awesome tokens

Physical coins and trinkets find people. Presence is the door. Laser remembers the work.

This is **not** a new app and **not** a scavenger hunt. A token is an invitation that finds someone: look up, notice the good, maybe sit at a table. The win is off the screen.

## Who owns what

| Concern | Home |
|---|---|
| Public QR, encouragement, share what you noticed, table RSVP, next step into Spark / Kindred / Neighborly / ChurchConnect | **Presence** (`presence.unitedundergod.org/t/{code}`) |
| Phrase library, restaurant schedule, dates on coins, what is overdone, engraving jobs, staff tasks, florist samples, shop pages, prices | **Laser Engraving** admin → **Tokens** and **Drops** |
| Shared identity | LPL `person` / GoTrue — one login |
| First pilot | Vidalia, Georgia |

Lincoln does not bounce to Presence to manage laser products. Presence only receives the scan.

Do not build a third "Moments" product. Presence already is the moments app for people gathering. Laser Engrave already is the moments catalog for physical pieces.

## Coin kinds

- **Notice** — look up, right where you are.
- **Place** — go notice a real public spot (fountain, mural, dusk sky).
- **Table** — a dated meal at a real restaurant. Honest headcount. People pay for their own food.

One QR per wave (same design on every coin in the batch). Unique-per-coin engraving is later if staff can bear it.

## The run page (`/t/{code}`)

A **run** is one `presence_coin_batches` row: print 100 of the same coin, one QR, and every finder lands on the same page. Top to bottom:

1. **The coin, mirrored.** Front picture (`design`: flower, cross, heart, sun, leaf, none) and front text, then the back (`verse_text` + `verse_ref`, or `back_text`).
2. **A little more about this message** (`story`, blank lines split paragraphs). Hidden when empty.
3. **Encouragement wall.** Anyone can leave a note without an account (`presence_coin_encouragements`, keyed to the batch so the whole run shares it). Lincoln asked for this on 2026-10-25: people saying the coin made their day, and encouraging the next finder. It stays bounded: the latest 30, no likes, no counts to chase.
   - Shows at once unless it has a link, email, phone number, @handle, crude language, or all caps. Then it is **held** for a person in Laser → Tokens.
   - 3 per person per hour. Three different people flagging a note holds it, unless a person already reviewed and kept it.
4. **Find each other.** Facebook / Instagram group links (`facebook_url`, `instagram_url`, which must be https on those hosts), plus meeting up in person and finding a church. A group link that does not exist yet is not shown. Empty boards stay empty.
5. **Pass it on.** Share sheet, or "leave it where someone else will find it".
6. **Why we are doing this + Support this ministry.** `why_text` (default in `lib/tokens.ts`), `donate_url` (default `https://unitedundergod.org/give`), and `sponsor_name` if a sponsor paid for the run.

All of these live in the batch's `notes` JSON, the same place Laser already keeps `kind`, `material`, and `sponsor_name`. Scripture is Berean Standard Bible, copied from bereanbible.com/bsb.txt and never written from memory. The page carries the BSB line whenever a verse is shown.

Finds: each scan logs one `presence_coin_scans` row with `kind='found'` (once per browser session, and once per person per day), so a run can say how many people found one.

## Restaurant outreach

The app drafts the call/email. A human sends it. Status stays **not contacted** until someone logs the call. Never present a restaurant as a partner before they said yes. Never promise a crowd.

## Money (owner-gated)

The run page links to United Under God's existing giving page. That is a donation, not a sale, and nothing has to be fulfilled. Sponsoring a wave, selling plant-packs to other towns, and paid community management are still **not live**. Capture a sponsor name on a wave if someone offers. Do not take payment until fulfillment is proven.

## Doctrine checks

Honor the first notice. Send people off the screen. No courage streaks. Friendship before dating (Kindred, not Aligned Souls, on day one). Empty boards stay empty.
