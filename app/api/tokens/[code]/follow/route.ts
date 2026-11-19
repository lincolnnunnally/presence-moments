import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { coinForCode } from "@/lib/token-data";
import { ipHash } from "@/lib/encourage";
import { isEmail, meetupFrom } from "@/lib/meetup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_HOUR = 5;

/**
 * Follow a weekly meetup by email: updates when it changes or a week is off,
 * and a reminder the day before if asked. No account needed. The emails are
 * sent by Laser Engraving, which manages the meetup.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ ok: false, error: "Presence is not connected right now." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return NextResponse.json({ ok: false, error: "That email address does not look right." }, { status: 400 });
  const wantsReminder = body.remind !== false;

  const coin = await coinForCode(sb, code);
  if (!coin?.batch_id) return NextResponse.json({ ok: false, error: "That coin is not in this town yet." }, { status: 404 });
  const { data: batch } = await sb.from("presence_coin_batches").select("notes").eq("id", coin.batch_id).maybeSingle();
  let notes: Record<string, unknown> = {};
  try {
    notes = typeof batch?.notes === "string" ? JSON.parse(batch.notes) : {};
  } catch {
    notes = {};
  }
  if (!meetupFrom(notes)) return NextResponse.json({ ok: false, error: "This coin is not for a weekly meetup." }, { status: 400 });

  const hash = ipHash(req);
  if (hash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("presence_meetup_followers")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", hash)
      .gte("created_at", since);
    if ((count || 0) >= PER_HOUR) {
      return NextResponse.json({ ok: false, error: "Thank you. Please try again in an hour." }, { status: 429 });
    }
  }

  const { data: existing } = await sb
    .from("presence_meetup_followers")
    .select("id")
    .eq("batch_id", coin.batch_id)
    .ilike("email", email)
    .maybeSingle();
  const { error } = existing
    ? await sb
        .from("presence_meetup_followers")
        .update({ wants_reminder: wantsReminder, unsubscribed_at: null })
        .eq("id", existing.id)
    : await sb
        .from("presence_meetup_followers")
        .insert({ batch_id: coin.batch_id, email, wants_reminder: wantsReminder, ip_hash: hash });
  if (error) return NextResponse.json({ ok: false, error: "Could not save that. Please try again." }, { status: 503 });
  return NextResponse.json({ ok: true, remind: wantsReminder });
}
