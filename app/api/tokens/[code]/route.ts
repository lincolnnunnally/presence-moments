import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { bumpFound, loadPublicWave } from "@/lib/token-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: "Presence is not connected right now." },
      { status: 503 },
    );
  }
  const { wave, missingTables, error } = await loadPublicWave(sb, code);
  if (missingTables) {
    return NextResponse.json(
      { ok: false, error: "Token tables are not on this database yet.", missingTables: true },
      { status: 503 },
    );
  }
  if (error && !wave) {
    return NextResponse.json({ ok: false, error: "Could not load that invitation." }, { status: 503 });
  }
  if (!wave) {
    return NextResponse.json({ ok: false, error: "That coin is not in this town yet." }, { status: 404 });
  }
  const url = new URL(req.url);
  if (url.searchParams.get("found") === "1" && !wave.closed) {
    await bumpFound(sb, wave.code).catch(() => {});
  }
  return NextResponse.json({ ok: true, wave });
}
