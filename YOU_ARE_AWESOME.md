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

All of these live in the batch's `notes` JSON, the same place Laser already keeps `kind`, `material`, and `sponsor_name`.

**Scripture is paraphrased** (owner direction, 2026-10-25). Coins are small, and the point is hope for someone lonely, anxious, afraid, down, or worn out, so the words are plain and short. `verse_style: "paraphrase"` makes the page say "Inspired by Isaiah 41:10" with a link to read the full verse. Each paraphrase in Laser's library was checked against the Berean text so it says what the verse says. Older runs without `verse_style` are treated as exact Berean quotes and keep the BSB line.

**The address follows the wording.** A new run gets `/t/you-are-loved`; if that is taken, `you-are-loved-vidalia`, then `-2`. Lookups are case-insensitive. Shorter words make a smaller QR, which matters on a small coin.

Finds: each scan logs one `presence_coin_scans` row with `kind='found'` (once per browser session, and once per person per day), so a run can say how many people found one.

## Keeping count (for a church or foundation)

| What | Where it is recorded |
|---|---|
| Coins made, planted, given to a group | `presence_coin_drops`, logged in Laser → Tokens → a wave → Log coins (or automatically when a request is marked delivered) |
| A person opening a coin's page | `presence_coin_scans` kind `found`, once per person per day, with town/region/country from Vercel geo headers. No IP kept. |
| Did it help, what they were carrying, taps on group / meetup / church / give / share / request | `presence_coin_events`, anonymous, once per kind per person per run per day |
| Notes left for the next finder | `presence_coin_encouragements` |
| Coin requests | `presence_coin_orders` from `/order` |

`presence_token_impact(since, until)` (SQL `005`) rolls all of it up: coins made and out, towns, finds, people, said it helped, what people were carrying, connections, requests, and breakdowns by town, phrase, and month. It returns aggregates only.

- **`/impact`** on Presence is the shareable report (all time, this year, 90 days). It prints cleanly, is not indexed by search engines, and says plainly when numbers are small. It never shows names.
- **Laser → Tokens → Impact** shows the same numbers inside the admin.

We do not collect age, gender, or other demographics from finders. Asking would make a gift feel like a survey. The optional "what were you carrying today?" tap is the closest thing, and it is the measure that matters for this ministry.

## Coin requests

`/order` lets a person, church, or group ask for coins: how many, who they hope the coins find, wording, where they will go, and when. Nothing is charged. A gift toward the cost is optional and goes to the UUG giving page. The request saves in Presence, then Presence calls Laser `POST /api/tokens/orders/{id}/notify`. That call emails the owner (ADMIN_EMAIL) and thanks the requester, at most once and only for a request less than an hour old. The request then shows under Laser → Tokens → Requests. Marking it delivered logs the coins as given in that town.

## Restaurant outreach

The app drafts the call/email. A human sends it. Status stays **not contacted** until someone logs the call. Never present a restaurant as a partner before they said yes. Never promise a crowd.

## Money (owner-gated)

The run page, `/order`, and `/impact` link to United Under God's existing giving page. That is a donation, not a sale, and nothing has to be fulfilled. Sponsoring a wave, selling plant-packs to other towns, and paid community management are still **not live**. Capture a sponsor name on a wave if someone offers. Do not take payment until fulfillment is proven.

## Doctrine checks

Honor the first notice. Send people off the screen. No courage streaks. Friendship before dating (Kindred, not Aligned Souls, on day one). Empty boards stay empty.
