import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_FALLBACK = "lincoln@unitedundergod.org";

function ownerEmails(): string[] {
  const listed = (process.env.APP_ENGINE_OWNER_EMAIL || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!listed.includes(OWNER_FALLBACK)) listed.push(OWNER_FALLBACK);
  return listed;
}

function isOwnerEmail(email?: string | null): boolean {
  const n = (email || "").trim().toLowerCase();
  return Boolean(n && ownerEmails().includes(n));
}

function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function userFromJwt(token: string): Promise<{ email?: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as { email?: string };
}

async function authorize(request: Request): Promise<{ ok: boolean; status: number; message: string }> {
  const expected = (process.env.APP_ENGINE_STATS_TOKEN || "").trim();
  const header = request.headers.get("authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (expected && presented && tokenMatches(presented, expected)) {
    return { ok: true, status: 200, message: "" };
  }
  if (presented) {
    const user = await userFromJwt(presented);
    if (user && isOwnerEmail(user.email)) return { ok: true, status: 200, message: "" };
    if (user) return { ok: false, status: 403, message: "This dashboard is for the owner." };
  }
  return { ok: false, status: 401, message: "A valid stats token is required." };
}

async function countRows(
  sb: SupabaseClient,
  table: string,
  opts?: { eq?: [string, string]; gte?: [string, string]; lt?: [string, string] }
): Promise<number | null> {
  try {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (opts?.eq) q = q.eq(opts.eq[0], opts.eq[1]);
    if (opts?.gte) q = q.gte(opts.gte[0], opts.gte[1]);
    if (opts?.lt) q = q.lt(opts.lt[0], opts.lt[1]);
    const { count, error } = await q;
    if (error) return null;
    return typeof count === "number" ? count : 0;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const gate = await authorize(request);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, message: gate.message }, { status: gate.status });
  }

  const sb = createAdminClient();
  if (!sb) {
    return NextResponse.json({
      ok: true,
      reporting: false,
      users: null,
      ticketsOpen: null,
      ordersRecent: null,
      activeUsers30d: null,
      newUsers7d: null,
      newUsersPrev7d: null,
      generatedAt: new Date().toISOString(),
      metrics: [],
    });
  }

  const [moments, joinRequests, ticketsOpen] = await Promise.all([
    countRows(sb, "presence_moments"),
    countRows(sb, "presence_join_requests"),
    countRows(sb, "presence_join_requests", { eq: ["status", "pending"] }),
  ]);

  return NextResponse.json({
    ok: true,
    reporting: true,
    users: null,
    ticketsOpen,
    ordersRecent: null,
    activeUsers30d: null,
    newUsers7d: null,
    newUsersPrev7d: null,
    generatedAt: new Date().toISOString(),
    metrics: [
      { key: "moments", label: "Moments posted", value: moments },
      { key: "joinRequests", label: "Join requests", value: joinRequests },
      { key: "pending", label: "Pending joins", value: ticketsOpen },
    ],
  });
}
