import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Place = { name: string; address: string; kind: string; source: string };

const OSM_TAGS: Record<string, string> = {
  coffee: '"amenity"="cafe"',
  bar: '"amenity"~"^(bar|pub)$"',
  meal: '"amenity"="restaurant"',
};

/**
 * Public places near the midpoint of two matched people.
 * Auth: caller's Supabase token; the other person must be in the caller's
 * presence_connect_matches() (same RLS-guarded RPC the page uses). Locations are
 * read server-side and never returned — only place names/addresses.
 * Sources: presence_places (curated) first, then OpenStreetMap Overpass.
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const other = u.searchParams.get("with") ?? "";
  const kind = u.searchParams.get("kind") ?? "coffee";
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createAdminClient();
  if (!url || !anon || !admin || !token || !OSM_TAGS[kind]) {
    return NextResponse.json({ places: [] as Place[] });
  }
  const userSb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: me } = await userSb.auth.getUser(token);
  const { data: matches } = await userSb.rpc("presence_connect_matches");
  if (!me?.user || !(matches ?? []).some((m: { user_id: string }) => m.user_id === other)) {
    return NextResponse.json({ error: "Not a current match." }, { status: 403 });
  }
  const { data: rows } = await admin
    .from("presence_connect_profiles")
    .select("user_id, lat, lng")
    .in("user_id", [me.user.id, other]);
  const pts = (rows ?? []).filter((r) => r.lat != null && r.lng != null);
  if (pts.length < 2) return NextResponse.json({ places: [] });
  const lat = (pts[0].lat + pts[1].lat) / 2;
  const lng = (pts[0].lng + pts[1].lng) / 2;

  const places: Place[] = [];
  const d = 0.15; // ~10 miles box for curated places
  const { data: curated } = await admin
    .from("presence_places")
    .select("name, address, kind, status")
    .gte("latitude", lat - d).lte("latitude", lat + d)
    .gte("longitude", lng - d).lte("longitude", lng + d)
    .limit(20);
  for (const p of curated ?? []) {
    if (p.status && !["active", "approved", "live"].includes(String(p.status))) continue;
    const k = String(p.kind ?? "").toLowerCase();
    const fits = kind === "coffee" ? /cafe|coffee/.test(k) : kind === "bar" ? /bar|pub/.test(k) : /restaurant|diner|food|meal/.test(k);
    if (fits) places.push({ name: p.name, address: p.address ?? "", kind, source: "presence" });
  }

  try {
    const q = `[out:json][timeout:8];node[${OSM_TAGS[kind]}]["name"](around:12000,${lat},${lng});out 15;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Presence/1.0 (presence.unitedundergod.org)" },
      body: "data=" + encodeURIComponent(q),
      signal: AbortSignal.timeout(9000),
    });
    if (res.ok) {
      const j = await res.json();
      const els = (j.elements ?? []) as { lat: number; lon: number; tags: Record<string, string> }[];
      els.sort((a, b) => (a.lat - lat) ** 2 + (a.lon - lng) ** 2 - ((b.lat - lat) ** 2 + (b.lon - lng) ** 2));
      for (const e of els) {
        const t = e.tags ?? {};
        const addr = [t["addr:housenumber"], t["addr:street"], t["addr:city"]].filter(Boolean).join(" ");
        if (!places.some((p) => p.name === t.name)) places.push({ name: t.name, address: addr, kind, source: "openstreetmap" });
        if (places.length >= 6) break;
      }
    }
  } catch {
    /* fall back to whatever we have; the user can type a place */
  }
  return NextResponse.json({ places: places.slice(0, 6) });
}
