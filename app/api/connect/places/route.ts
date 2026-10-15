import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Place = { name: string; address: string; kind: string; source: string };

const KINDS = new Set(["coffee", "bar", "meal"]);

/**
 * Public places near the midpoint of two matched people.
 * Auth: caller's Supabase token; the other person must be in the caller's
 * presence_connect_matches() (same RLS-guarded RPC the page uses). Locations are
 * read server-side and never returned — only place names/addresses.
 * Sources: presence_places (curated, by town) first, then OpenStreetMap Nominatim.
 */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const other = u.searchParams.get("with") ?? "";
  const kind = u.searchParams.get("kind") ?? "coffee";
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createAdminClient();
  if (!url || !anon || !admin || !token || !KINDS.has(kind)) {
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
    .select("user_id, lat, lng, city")
    .in("user_id", [me.user.id, other]);
  const pts = (rows ?? []).filter((r) => r.lat != null && r.lng != null);
  if (pts.length < 2) return NextResponse.json({ places: [] });
  const lat = (pts[0].lat + pts[1].lat) / 2;
  const lng = (pts[0].lng + pts[1].lng) / 2;

  const places: Place[] = [];
  const fits = (k: string) =>
    kind === "coffee" ? /cafe|coffee/.test(k) : kind === "bar" ? /bar|pub|brew/.test(k) : /restaurant|diner|food|meal/.test(k);

  // 1) Curated Presence places in either person's town (they carry city, not coordinates).
  const towns = Array.from(new Set(pts.map((p) => String(p.city ?? "").split(",")[0].trim()).filter(Boolean)));
  for (const town of towns) {
    const { data: curated } = await admin
      .from("presence_places")
      .select("name, address, kind, status")
      .ilike("city", `${town}%`)
      .eq("status", "approved")
      .limit(20);
    for (const p of curated ?? []) {
      if (fits(String(p.kind ?? "").toLowerCase()) && !places.some((x) => x.name === p.name)) {
        places.push({ name: p.name, address: p.address ?? "", kind, source: "presence" });
      }
    }
  }

  // 2) OpenStreetMap Nominatim, bounded box (~12 mi) around the midpoint.
  try {
    const q = kind === "coffee" ? "cafe" : kind === "bar" ? "bar" : "restaurant";
    const box = [lng - 0.2, lat + 0.17, lng + 0.2, lat - 0.17].join(",");
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&bounded=1&viewbox=${box}&amenity=${q}`,
      { headers: { "User-Agent": "Presence/1.0 (presence.unitedundergod.org)" }, signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const els = (await res.json()) as { name?: string; lat: string; lon: string; address?: Record<string, string> }[];
      els.sort((a, b) => (+a.lat - lat) ** 2 + (+a.lon - lng) ** 2 - ((+b.lat - lat) ** 2 + (+b.lon - lng) ** 2));
      for (const e of els) {
        if (!e.name || places.some((p) => p.name === e.name)) continue;
        const a = e.address ?? {};
        const addr = [[a.house_number, a.road].filter(Boolean).join(" "), a.city || a.town || a.village].filter(Boolean).join(", ");
        places.push({ name: e.name, address: addr, kind, source: "openstreetmap" });
        if (places.length >= 6) break;
      }
    }
  } catch {
    /* fall back to whatever we have; the user can type a place */
  }
  return NextResponse.json({ places: places.slice(0, 6) });
}
