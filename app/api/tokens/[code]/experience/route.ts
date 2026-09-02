import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { emitJourneyEvent } from "@/lib/journey";
import { tablesMissing, waveId } from "@/lib/token-data";

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
  if (what.length > 2000) {
    return NextResponse.json({ ok: false, error: "Keep it to a few sentences." }, { status: 400 });
  }
  const id = await waveId(sb, code);
  if (!id) {
    return NextResponse.json({ ok: false, error: "That coin is not in this town yet." }, { status: 404 });
  }
  const displayName =
    (user.user_metadata as { display_name?: string } | undefined)?.display_name ||
    user.email?.split("@")[0] ||
    "A neighbor";
  const { error } = await sb.from("presence_experiences").insert({
    wave_id: id,
    auth_user_id: user.id,
    display_name: displayName,
    what_noticed: what,
  });
  if (error) {
    if (tablesMissing(error.message)) {
      return NextResponse.json({ ok: false, error: "Token tables are not on this database yet." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Could not save that. Try again." }, { status: 503 });
  }
  await emitJourneyEvent(sb, {
    email: user.email || "",
    displayName,
    eventType: "token_noticed",
    title: "Noticed something good",
    detail: "A You Are Awesome coin opened a moment of presence.",
    seasonHint: "belong",
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
