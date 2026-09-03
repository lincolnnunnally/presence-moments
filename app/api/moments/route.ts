import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open moments anyone can see. Join and host still require a login. */
export async function GET() {
  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Presence is not connected right now." }, { status: 503 });
  }
  const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const { data, error } = await sb
    .from("presence_moments")
    .select("id, activity, title, starts_at, place, city, vibes, note, capacity, host_name")
    .eq("status", "open")
    .gte("starts_at", cutoff)
    .order("starts_at", { ascending: true })
    .limit(50);
  if (error) {
    return NextResponse.json({ ok: false, error: "Could not load moments." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, moments: data || [] });
}
