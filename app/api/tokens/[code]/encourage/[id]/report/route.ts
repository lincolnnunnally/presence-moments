import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { coinForCode } from "@/lib/token-data";
import { HIDE_AT_REPORTS, ipHash } from "@/lib/encourage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Anyone may flag a note. Three different people hide it until Laser reviews it. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, error: "Unknown note." }, { status: 400 });
  }
  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Presence is not connected right now." }, { status: 503 });
  }
  const coin = await coinForCode(sb, code);
  if (!coin) {
    return NextResponse.json({ ok: false, error: "That coin is not in this town yet." }, { status: 404 });
  }
  const { data: note } = await sb
    .from("presence_coin_encouragements")
    .select("id, coin_id, batch_id, status, reporter_hashes, reviewed_at")
    .eq("id", id)
    .maybeSingle();
  const sameRun = note && (coin.batch_id ? note.batch_id === coin.batch_id : note.coin_id === coin.id);
  if (!note || !sameRun) {
    return NextResponse.json({ ok: false, error: "Unknown note." }, { status: 404 });
  }
  const who = ipHash(req) || `anon-${Date.now()}`;
  const reporters: string[] = Array.isArray(note.reporter_hashes) ? note.reporter_hashes : [];
  if (reporters.includes(who)) {
    return NextResponse.json({ ok: true, hidden: note.status !== "shown" });
  }
  const next = [...reporters, who];
  // A note a person already reviewed and kept stays up; reports still count for Laser to see.
  const hide = note.status === "shown" && !note.reviewed_at && next.length >= HIDE_AT_REPORTS;
  const { error } = await sb
    .from("presence_coin_encouragements")
    .update({
      reporter_hashes: next,
      report_count: next.length,
      ...(hide ? { status: "held", held_reason: "reported" } : {}),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: "Could not send that. Try again." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, hidden: hide });
}
