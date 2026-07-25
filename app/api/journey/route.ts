import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { emitJourneyEvent } from "@/lib/journey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Best-effort growth-journey emit. Called after a person hosts or joins a
 * moment so Presence contributes to their shared UUG journey. Non-authoritative;
 * never blocks the user.
 */
export async function POST(request: Request) {
  let body: {
    email?: string;
    displayName?: string;
    eventType?: string;
    title?: string;
    detail?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 200 });

  await emitJourneyEvent(admin, {
    email,
    displayName: body.displayName || null,
    eventType: body.eventType || "check_in",
    title: body.title,
    detail: body.detail,
  });

  return NextResponse.json({ ok: true });
}
