import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { emitJourneyEvent } from "@/lib/journey";
import { coinForCode } from "@/lib/token-data";
import { ipHash, saveEncouragement } from "@/lib/encourage";

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Presence is not connected right now." }, { status: 503 });
  }
  const user = await userFromBearer(sb, req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in to share what you noticed." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const what = typeof body.what_noticed === "string" ? body.what_noticed.trim() : "";
  if (what.length < 3) {
    return NextResponse.json({ ok: false, error: "Tell us one thing you noticed." }, { status: 400 });
  }
  const coin = await coinForCode(sb, code);
  if (!coin) {
    return NextResponse.json({ ok: false, error: "That coin is not in this town yet." }, { status: 404 });
  }
  const displayName =
    (user.user_metadata as { display_name?: string } | undefined)?.display_name ||
    user.email?.split("@")[0] ||
    "A neighbor";
  // presence_coin_scans.kind only allows view/found/coming, so "notice" rows were
  // rejected on every submit. What someone noticed now lands on the run's wall.
  const result = await saveEncouragement(sb, {
    coin,
    message: what,
    displayName,
    authUserId: user.id,
    ipHash: ipHash(req),
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.httpStatus });
  }
  await emitJourneyEvent(sb, {
    email: user.email || "",
    displayName,
    eventType: "token_noticed",
    title: "Noticed something good",
    detail: "A You Are Awesome coin opened a moment of presence.",
    seasonHint: "belong",
  }).catch(() => {});
  return NextResponse.json({ ok: true, status: result.status });
}
