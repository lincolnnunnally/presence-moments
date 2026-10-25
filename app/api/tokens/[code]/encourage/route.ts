import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { emitJourneyEvent } from "@/lib/journey";
import { coinForCode } from "@/lib/token-data";
import { ipHash, listEncouragements, saveEncouragement } from "@/lib/encourage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userFromBearer(sb: NonNullable<ReturnType<typeof createAdminClient>>, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Presence is not connected right now." }, { status: 503 });
  }
  const coin = await coinForCode(sb, code);
  if (!coin) {
    return NextResponse.json({ ok: false, error: "That coin is not in this town yet." }, { status: 404 });
  }
  const encouragements = await listEncouragements(sb, coin.id, coin.batch_id);
  return NextResponse.json({ ok: true, encouragements });
}

/** No account needed: a finder may leave a word for the next person. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Presence is not connected right now." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  // Honeypot: people never fill a field they cannot see.
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true, status: "held" });
  }
  const coin = await coinForCode(sb, code);
  if (!coin) {
    return NextResponse.json({ ok: false, error: "That coin is not in this town yet." }, { status: 404 });
  }
  const user = await userFromBearer(sb, req);
  const accountName =
    (user?.user_metadata as { display_name?: string } | undefined)?.display_name || user?.email?.split("@")[0] || "";
  const result = await saveEncouragement(sb, {
    coin,
    message: body.message,
    displayName: typeof body.name === "string" && body.name.trim() ? body.name : accountName,
    authUserId: user?.id ?? null,
    ipHash: ipHash(req),
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.httpStatus });
  }
  if (user?.email) {
    await emitJourneyEvent(sb, {
      email: user.email,
      displayName: result.encouragement.display_name,
      eventType: "token_noticed",
      title: "Left encouragement for a stranger",
      detail: "A You Are Awesome coin found them, and they passed the good on.",
      seasonHint: "belong",
    }).catch(() => {});
  }
  return NextResponse.json({
    ok: true,
    status: result.status,
    encouragement: result.status === "shown" ? result.encouragement : null,
  });
}
