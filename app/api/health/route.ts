import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return NextResponse.json(
      { ok: false, app: "Presence", error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json(
      { ok: false, app: "Presence", error: "Admin client is not configured." },
      { status: 503 },
    );
  }
  try {
    const { count, error } = await sb
      .from("presence_moments")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");
    if (error) {
      return NextResponse.json(
        { ok: false, app: "Presence", error: error.message.slice(0, 240) },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      app: "Presence",
      openMoments: typeof count === "number" ? count : 0,
      passwordReset: "ecosystem-auth-reset",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        app: "Presence",
        error: err instanceof Error ? err.message.slice(0, 240) : "health failed",
      },
      { status: 503 },
    );
  }
}
