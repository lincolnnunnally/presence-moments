import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { coinForCode } from "@/lib/token-data";
import { ipHash } from "@/lib/encourage";
import { geoFrom } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What a finder can tell us or tap. Anything else is ignored. */
const ALLOWED: Record<string, string[] | null> = {
  helped: ["yes", "a_little", "not_today"],
  carrying: ["lonely", "anxious", "afraid", "down", "weary", "grief", "normal"],
  click_facebook: null,
  click_instagram: null,
  click_meetup: null,
  click_church: null,
  click_give: null,
  click_order: null,
  share: null,
};

/**
 * Anonymous impact signals for the run's report. One of each kind per person
 * per run per day, so "312 said it helped" means people, not taps. Answering
 * again the same day replaces the earlier answer.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!(kind in ALLOWED)) {
    return NextResponse.json({ ok: false, error: "Unknown event." }, { status: 400 });
  }
  const allowed = ALLOWED[kind];
  const detail = typeof body.detail === "string" ? body.detail : null;
  if (allowed && (!detail || !allowed.includes(detail))) {
    return NextResponse.json({ ok: false, error: "Unknown answer." }, { status: 400 });
  }
  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Presence is not connected right now." }, { status: 503 });
  }
  const coin = await coinForCode(sb, code);
  if (!coin) {
    return NextResponse.json({ ok: false, error: "That coin is not in this town yet." }, { status: 404 });
  }
  const who = ipHash(req);
  if (who) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let q = sb
      .from("presence_coin_events")
      .select("id")
      .eq("ip_hash", who)
      .eq("kind", kind)
      .gte("created_at", since)
      .limit(1);
    q = coin.batch_id ? q.eq("batch_id", coin.batch_id) : q.eq("coin_id", coin.id);
    const { data: prior } = await q;
    if (prior && prior.length) {
      if (allowed) await sb.from("presence_coin_events").update({ detail }).eq("id", prior[0].id);
      return NextResponse.json({ ok: true });
    }
  }
  const geo = geoFrom(req);
  const { error } = await sb.from("presence_coin_events").insert({
    coin_id: coin.id,
    batch_id: coin.batch_id,
    kind,
    detail: allowed ? detail : null,
    ip_hash: who,
    ...geo,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: "Could not save that." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
