import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { cleanText, ipHash } from "@/lib/encourage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THEMES = ["lonely", "anxious", "afraid", "down", "weary", "notice", "any"];
const LASER_API = (process.env.LASER_API_URL || "https://laser.unitedundergod.org").replace(/\/$/, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * A person, church, or group asks for coins. Nothing is charged: a gift toward
 * the cost is optional and happens on the UUG giving page. Laser Engraving
 * emails Lincoln and thanks the requester, and lists it under Tokens → Requests.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }
  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 200).toLowerCase();
  const quantity = Number(body.quantity);
  if (!name) return NextResponse.json({ ok: false, error: "Tell us your name." }, { status: 400 });
  if (!EMAIL.test(email)) {
    return NextResponse.json({ ok: false, error: "We need an email so we can reach you." }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    return NextResponse.json({ ok: false, error: "How many coins would you like?" }, { status: 400 });
  }
  const themes = Array.isArray(body.themes)
    ? body.themes.filter((t: unknown): t is string => typeof t === "string" && THEMES.includes(t)).slice(0, 7)
    : [];
  let needed_by: string | null = null;
  if (typeof body.needed_by === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.needed_by)) needed_by = body.needed_by;

  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Presence is not connected right now." }, { status: 503 });
  }
  const who = ipHash(req);
  if (who) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("presence_coin_orders")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", who)
      .gte("created_at", since);
    if ((count || 0) >= 3) {
      return NextResponse.json(
        { ok: false, error: "We have your requests. We will be in touch soon." },
        { status: 429 },
      );
    }
  }
  const { data, error } = await sb
    .from("presence_coin_orders")
    .insert({
      name,
      email,
      phone: cleanText(body.phone, 40) || null,
      organization: cleanText(body.organization, 160) || null,
      city: cleanText(body.city, 80) || null,
      state: cleanText(body.state, 40) || null,
      quantity,
      themes,
      wording: cleanText(body.wording, 500) || null,
      purpose: cleanText(body.purpose, 2000) || null,
      needed_by,
      will_give: body.will_give === true,
      ip_hash: who,
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Could not send that. Please try again." }, { status: 503 });
  }
  // The request is saved either way; the email is a courtesy on top of the Laser list.
  let notified = false;
  try {
    const res = await fetch(`${LASER_API}/api/tokens/orders/${data.id}/notify`, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
    });
    notified = res.ok && Boolean((await res.json().catch(() => ({}))).ok);
  } catch {
    notified = false;
  }
  return NextResponse.json({ ok: true, id: data.id, notified });
}
