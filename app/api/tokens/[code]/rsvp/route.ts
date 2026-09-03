import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { emitJourneyEvent } from "@/lib/journey";
import { tablesMissing, coinId } from "@/lib/token-data";

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
    return NextResponse.json({ ok: false, error: "Sign in to say you are coming." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const status = body.status === "maybe" || body.status === "cant" ? body.status : "going";
  const id = await coinId(sb, code);
  if (!id) {
    return NextResponse.json({ ok: false, error: "That invitation is not live." }, { status: 404 });
  }
  const { data: coin, error: werr } = await sb
    .from("presence_coins")
    .select("id, moment_id, status")
    .eq("id", id)
    .maybeSingle();
  if (werr) {
    if (tablesMissing(werr.message)) {
      return NextResponse.json({ ok: false, error: "Could not load that invitation." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Could not load that invitation." }, { status: 503 });
  }
  if (!coin?.moment_id) {
    return NextResponse.json({ ok: false, error: "There is not an open table for this coin." }, { status: 400 });
  }
  const displayName =
    (user.user_metadata as { display_name?: string } | undefined)?.display_name ||
    user.email?.split("@")[0] ||
    "A neighbor";
  const joinStatus = status === "going" ? "accepted" : status === "cant" ? "declined" : "requested";
  const { error } = await sb.from("presence_join_requests").upsert(
    {
      moment_id: coin.moment_id,
      guest_auth_user_id: user.id,
      guest_name: displayName,
      status: joinStatus,
    },
    { onConflict: "moment_id,guest_auth_user_id" },
  );
  if (error) {
    return NextResponse.json({ ok: false, error: "Could not save that RSVP. Try again." }, { status: 503 });
  }
  if (status === "going") {
    await emitJourneyEvent(sb, {
      email: user.email || "",
      displayName,
      eventType: "outing_joined",
      title: "Said yes to a table",
      detail: "A You Are Awesome table night.",
      seasonHint: "belong",
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, status });
}
