import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { emitJourneyEvent } from "@/lib/journey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Auto-confirming signup on the shared LPL GoTrue.
 * Per-app SMTP is not wired, so a normal signUp() would leave the account
 * unconfirmed. We create the user server-side (email_confirm: true), link the
 * shared ecosystem identity (lpl_people), then the client signs in.
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const displayName = body.displayName?.trim() || "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use a password of at least 8 characters." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Account signup is not configured on the server yet." },
      { status: 503 }
    );
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: displayName ? { display_name: displayName } : {},
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    const already =
      message.includes("already") ||
      message.includes("registered") ||
      (error as { status?: number }).status === 422;
    if (already) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in instead." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not create your account. Please try again." },
      { status: 500 }
    );
  }

  const authUserId = data.user?.id;
  if (authUserId) {
    try {
      const { data: byEmail } = await admin
        .from("lpl_people")
        .select("id, auth_user_id")
        .ilike("email", email)
        .maybeSingle();

      if (byEmail?.id && !byEmail.auth_user_id) {
        await admin
          .from("lpl_people")
          .update({
            auth_user_id: authUserId,
            full_name: displayName || undefined,
            preferred_name: displayName || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", byEmail.id);
      } else if (!byEmail?.id) {
        await admin.from("lpl_people").upsert(
          {
            auth_user_id: authUserId,
            email,
            full_name: displayName || null,
            preferred_name: displayName || null,
          },
          { onConflict: "auth_user_id" }
        );
      }

      await emitJourneyEvent(admin, {
        email,
        displayName,
        eventType: "joined",
        title: "Joined Presence",
        detail: "Looking for real, low-pressure connection.",
      });
    } catch (linkErr) {
      console.error("identity-link", linkErr);
    }
  }

  return NextResponse.json({ ok: true });
}
