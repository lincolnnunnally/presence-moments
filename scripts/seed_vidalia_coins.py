"""Seed Vidalia places + the LOOKUP coin into the EXISTING coin tables."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
env: dict[str, str] = {}
for line in (ROOT / ".env.local").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
URL = env["NEXT_PUBLIC_SUPABASE_URL"]
KEY = env["SUPABASE_SERVICE_ROLE_KEY"]


def call(method: str, path: str, row=None):
    data = json.dumps(row).encode() if row is not None else None
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=data,
        method=method,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def upsert(table: str, row: dict, on: str):
    st, body = call("POST", table, row)
    if st in (200, 201):
        return st, body
    if st in (409, 400) and "duplicate" in str(body).lower():
        ident = row[on]
        patch = {k: v for k, v in row.items() if k != "id"}
        return call("PATCH", f"{table}?{on}=eq.{ident}", patch)
    if st == 409:
        ident = row[on]
        patch = {k: v for k, v in row.items() if k != "id"}
        return call("PATCH", f"{table}?{on}=eq.{ident}", patch)
    # already exists as 201 conflict via unique
    if "23505" in str(body):
        ident = row[on]
        patch = {k: v for k, v in row.items() if k != "id"}
        return call("PATCH", f"{table}?{on}=eq.{ident}", patch)
    return st, body


PLACES = [
    {
        "id": "00000000-0000-4000-a000-000000000201",
        "name": "Vidalia Onion Fountain",
        "kind": "downtown",
        "address": "Behind City Hall, 114 Jackson Street",
        "why": "Stay for the stainless-steel onion in the basin. After dark the lights and water do a quiet little show.",
        "best_time": "After dark, or a slow afternoon",
        "city": "Vidalia",
    },
    {
        "id": "00000000-0000-4000-a000-000000000202",
        "name": "Be Sweet mural & downtown streets",
        "kind": "downtown",
        "address": "Downtown historic district",
        "why": "Walk the historic block. Look up at the brick, the mural, the oaks.",
        "best_time": "Late afternoon light",
        "city": "Vidalia",
    },
    {
        "id": "00000000-0000-4000-a000-000000000203",
        "name": "Ben Smith Park",
        "kind": "park",
        "address": "Thompson Street between NW Main and Pine",
        "why": "A simple park. In summer the splash pad lights up at night. Sit still long enough to hear kids, birds, or just the quiet.",
        "best_time": "Evening",
        "city": "Vidalia",
    },
    {
        "id": "00000000-0000-4000-a000-000000000204",
        "name": "PAL Theatre",
        "kind": "downtown",
        "address": "Downtown Vidalia",
        "why": "A 1927 theater still doing its work. Notice that people have gathered here for almost a hundred years.",
        "best_time": "When the marquee is lit",
        "city": "Vidalia",
    },
    {
        "id": "00000000-0000-4000-a000-000000000205",
        "name": "Altama Museum of Art & History",
        "kind": "downtown",
        "address": "Brazell House, Vidalia",
        "why": "The house itself is worth a look. Slow down for the porch and the trees.",
        "best_time": "Open hours, or a walk-by any day",
        "city": "Vidalia",
    },
    {
        "id": "00000000-0000-4000-a000-000000000206",
        "name": "Ed Smith Complex walking trail",
        "kind": "park",
        "address": "Ed Smith Recreational Complex",
        "why": "Walk the trail without headphones if you can. Notice the sky changing.",
        "best_time": "Sunrise or sunset",
        "city": "Vidalia",
    },
    {
        "id": "00000000-0000-4000-a000-000000000207",
        "name": "West sky over downtown",
        "kind": "sunset",
        "address": "Any west-facing street downtown",
        "why": "You do not need a famous overlook. Face west near dusk. Watch the color change. Wonder is not a luxury.",
        "best_time": "Dusk, about 20 minutes before sunset",
        "city": "Vidalia",
    },
    {
        "id": "00000000-0000-4000-a000-000000000208",
        "name": "Altamaha River (short drive)",
        "kind": "nature",
        "address": "Outfitters within about 20 minutes of Vidalia",
        "why": "Georgia's Little Amazon — cypress, Spanish moss, sometimes eagles. Even from a bank, the river is older than the worry you brought.",
        "best_time": "Daylight; go with someone if you paddle",
        "city": "Vidalia",
    },
    {
        "id": "00000000-0000-4000-a000-000000000301",
        "name": "Rialto",
        "kind": "restaurant",
        "address": "120 Jackson Street",
        "why": "Downtown Italian. A table is the point — not a performance.",
        "best_time": "Dinner, about 7:00 p.m.",
        "city": "Vidalia",
        "contact_notes": "outreach:not_contacted",
    },
    {
        "id": "00000000-0000-4000-a000-000000000302",
        "name": "Tappas",
        "kind": "restaurant",
        "address": "201 W Main Street",
        "why": "A small downtown cafe. Easy to find, easy to sit.",
        "best_time": "Lunch or early dinner",
        "city": "Vidalia",
        "contact_notes": "outreach:not_contacted",
    },
    {
        "id": "00000000-0000-4000-a000-000000000303",
        "name": "Downtown Bistro & Catering",
        "kind": "restaurant",
        "address": "101 E Meadows Street",
        "why": "Local and unhurried. A handful of people can share a table without taking over the room.",
        "best_time": "Dinner",
        "city": "Vidalia",
        "contact_notes": "outreach:not_contacted",
    },
    {
        "id": "00000000-0000-4000-a000-000000000304",
        "name": "Ohoopee River Brewing Co",
        "kind": "restaurant",
        "address": "Downtown Vidalia",
        "why": "Local gathering place. Keep the invitation small and honest.",
        "best_time": "Early evening",
        "city": "Vidalia",
        "contact_notes": "outreach:not_contacted",
    },
    {
        "id": "00000000-0000-4000-a000-000000000305",
        "name": "The Sandwiche Shoppe",
        "kind": "restaurant",
        "address": "213 Green Street",
        "why": "A loved local lunch counter. Better for a noon table than a late dinner.",
        "best_time": "Lunch",
        "city": "Vidalia",
        "contact_notes": "outreach:not_contacted",
    },
    {
        "id": "00000000-0000-4000-a000-000000000306",
        "name": "Kountry Kafe",
        "kind": "coffee",
        "address": "115 SE Main Street",
        "why": "Breakfast and simple plates. A morning table can be as much belonging as dinner.",
        "best_time": "Breakfast or lunch",
        "city": "Vidalia",
        "contact_notes": "outreach:not_contacted",
    },
    {
        "id": "00000000-0000-4000-a000-000000000307",
        "name": "Hardware Pizza (Lyons)",
        "kind": "restaurant",
        "address": "Lyons, a short drive from Vidalia",
        "why": "Nearby, well-loved. Use when Vidalia tables are already in rotation this month.",
        "best_time": "Dinner",
        "city": "Lyons",
        "contact_notes": "outreach:not_contacted",
    },
]


def main():
    for p in PLACES:
        row = {
            **p,
            "state": "GA",
            "status": "approved",
            "source": "curated",
        }
        st, body = call("POST", "presence_places", row)
        if st in (200, 201):
            print("place", p["name"], st)
        else:
            st2, _ = call(
                "PATCH",
                f"presence_places?id=eq.{p['id']}",
                {k: v for k, v in row.items() if k != "id"},
            )
            print("place", p["name"], st, "patch", st2)

    st, body = call("PATCH", "presence_coins?code=eq.LOOKUP", {
        "kind": "notice",
        "status": "released",
        "front_text": "LOOK UP",
        "back_text": "Scan me",
        "place_id": "00000000-0000-4000-a000-000000000207",
        "hunt_hint": (
            "Look up. The sky is still doing its work. Pause long enough to see something "
            "beautiful that was already here before the stress was. You do not have to fix "
            "everything in this minute. You only have to notice."
        ),
    })
    print("coin LOOKUP", st)
    st, body = call("PATCH", "presence_coin_batches?id=eq.00000000-0000-4000-a000-000000000501", {
        "status": "released",
        "name": "Vidalia — look up",
        "city": "Vidalia",
        "state": "GA",
        "quantity": 25,
        "notes": json.dumps({
            "kind": "notice",
            "material": "wood coin",
            "plant": "downtown benches, fountain, park edges — not private property",
        }),
    })
    print("batch", st)


if __name__ == "__main__":
    main()
