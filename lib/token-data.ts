import type { SupabaseClient } from "@supabase/supabase-js";
import type { Geo } from "./geo";
import {
  COIN_DESIGNS,
  DEFAULT_GIVE_URL,
  DEFAULT_WHY,
  type CoinDesign,
  type PublicWave,
  type WaveKind,
  type WaveStatus,
} from "./tokens";

const PUBLIC_COIN_STATUSES = ["released", "found", "engraved", "drafted"];

export function tablesMissing(message: string | undefined): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the table")
  );
}

function asKind(placeKind: string | null, notesKind: string | null, coinKind: string | null): WaveKind {
  if (placeKind === "restaurant" || placeKind === "coffee") return "table";
  if (notesKind === "table" || notesKind === "place") return notesKind;
  if (coinKind === "notice") return "notice";
  if (placeKind === "sunset" || placeKind === "park" || placeKind === "nature" || placeKind === "downtown" || placeKind === "church") {
    return "place";
  }
  return "notice";
}

function asStatus(coinStatus: string | null, batchStatus: string | null): WaveStatus {
  const s = (coinStatus || batchStatus || "").toLowerCase();
  if (s === "closed") return "closed";
  if (s === "released" || s === "found") return "live";
  if (s === "engraved") return "engraving";
  if (s === "ready") return "planted";
  return "draft";
}

function parseNotes(raw: unknown): Record<string, string> {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function text(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** Only https links leave this page; a typo in Laser must not become a javascript: link. */
function httpsUrl(v: unknown, hosts?: string[]): string | null {
  const t = text(v, 500);
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return null;
    if (hosts && !hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function asDesign(v: unknown, front: string): CoinDesign {
  if (typeof v === "string" && (COIN_DESIGNS as string[]).includes(v)) return v as CoinDesign;
  return /LOVED/i.test(front) ? "cross" : "none";
}

export async function loadPublicWave(
  sb: SupabaseClient,
  rawCode: string,
): Promise<{ wave: PublicWave | null; missingTables: boolean; error?: string }> {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code || code.length > 32) {
    return { wave: null, missingTables: false };
  }

  const { data: coin, error } = await sb
    .from("presence_coins")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    if (tablesMissing(error.message)) {
      return { wave: null, missingTables: true, error: error.message };
    }
    return { wave: null, missingTables: false, error: error.message };
  }
  if (!coin || !PUBLIC_COIN_STATUSES.includes(coin.status)) {
    return { wave: null, missingTables: false };
  }

  let batch: Record<string, unknown> | null = null;
  if (coin.batch_id) {
    const { data } = await sb.from("presence_coin_batches").select("*").eq("id", coin.batch_id).maybeSingle();
    batch = data;
  }
  const notes = parseNotes(batch?.notes);

  let community_name = (batch?.city as string) || "this town";
  if (batch?.state) community_name = `${batch.city}, ${batch.state}`;

  let place_name: string | null = null;
  let place_address: string | null = null;
  let place_city: string | null = null;
  let notice_prompt: string | null = null;
  let best_time: string | null = null;
  let placeKind: string | null = null;
  if (coin.place_id) {
    const { data: p } = await sb.from("presence_places").select("*").eq("id", coin.place_id).maybeSingle();
    if (p) {
      place_name = p.name;
      place_address = p.address;
      place_city = [p.city, p.state].filter(Boolean).join(", ");
      notice_prompt = p.why;
      best_time = p.best_time;
      placeKind = p.kind;
    }
  }

  let invite_at: string | null = null;
  let going_count = 0;
  if (coin.moment_id) {
    const { data: m } = await sb.from("presence_moments").select("starts_at").eq("id", coin.moment_id).maybeSingle();
    invite_at = m?.starts_at || null;
    const { count } = await sb
      .from("presence_join_requests")
      .select("id", { count: "exact", head: true })
      .eq("moment_id", coin.moment_id)
      .eq("status", "accepted");
    going_count = typeof count === "number" ? count : 0;
  }

  const { count: experience_count } = await sb
    .from("presence_coin_scans")
    .select("id", { count: "exact", head: true })
    .eq("coin_id", coin.id)
    .neq("kind", "found");
  const { count: foundScans } = await sb
    .from("presence_coin_scans")
    .select("id", { count: "exact", head: true })
    .eq("coin_id", coin.id)
    .eq("kind", "found");

  const encouragement_count = await countEncouragements(sb, coin.id, coin.batch_id);

  const kind = asKind(placeKind, notes.kind || null, coin.kind);
  const status = asStatus(coin.status, (batch?.status as string) || null);

  const wave: PublicWave = {
    code: coin.code,
    kind,
    status,
    title: (batch?.name as string) || coin.front_text,
    front_text: coin.front_text,
    back_text: coin.back_text,
    web_message: coin.hunt_hint || coin.front_text,
    invite_at,
    invite_notes: notes.invite_notes || null,
    community_name,
    place_name,
    place_address,
    place_city,
    notice_prompt,
    best_time,
    found_count: typeof foundScans === "number" && foundScans > 0 ? foundScans : coin.found_at ? 1 : 0,
    experience_count: typeof experience_count === "number" ? experience_count : 0,
    going_count,
    closed: status === "closed",
    run_size: typeof batch?.quantity === "number" ? (batch.quantity as number) : 1,
    design: asDesign(notes.design, coin.front_text),
    verse_ref: text(notes.verse_ref, 80),
    verse_text: text(notes.verse_text, 1000),
    // Runs made before paraphrases quoted the Berean text exactly; new ones say "paraphrase".
    verse_style: notes.verse_style === "paraphrase" ? "paraphrase" : "quote",
    story: text(notes.story),
    facebook_url: httpsUrl(notes.facebook_url, ["facebook.com", "fb.com"]),
    instagram_url: httpsUrl(notes.instagram_url, ["instagram.com"]),
    gather_text: text(notes.gather_text, 1000),
    why_text: text(notes.why_text) || DEFAULT_WHY,
    give_url: httpsUrl(notes.donate_url) || DEFAULT_GIVE_URL,
    sponsor_name: text(notes.sponsor_name, 120),
    encouragement_count,
  };
  return { wave, missingTables: false };
}

/** The wall belongs to the run (batch), so every coin in it sees the same notes. */
export async function countEncouragements(
  sb: SupabaseClient,
  coinId: string,
  batchId: string | null,
): Promise<number> {
  let q = sb.from("presence_coin_encouragements").select("id", { count: "exact", head: true }).eq("status", "shown");
  q = batchId ? q.eq("batch_id", batchId) : q.eq("coin_id", coinId);
  const { count } = await q;
  return typeof count === "number" ? count : 0;
}

export async function coinForCode(
  sb: SupabaseClient,
  code: string,
): Promise<{ id: string; batch_id: string | null; status: string } | null> {
  const { data } = await sb
    .from("presence_coins")
    .select("id, batch_id, status")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!data || !PUBLIC_COIN_STATUSES.includes(data.status)) return null;
  return data;
}

export async function coinId(sb: SupabaseClient, code: string): Promise<string | null> {
  const { data } = await sb
    .from("presence_coins")
    .select("id")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  return data?.id ?? null;
}

export async function bumpFound(
  sb: SupabaseClient,
  code: string,
  ipHash: string | null = null,
  geo: Geo | null = null,
): Promise<void> {
  const { data } = await sb
    .from("presence_coins")
    .select("id, status")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!data?.id) return;
  await sb
    .from("presence_coins")
    .update({
      found_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  // One "found" per browser session (TokenCard guards with sessionStorage) and per
  // person per day here, so a run's count means people, not page refreshes.
  if (ipHash) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("presence_coin_scans")
      .select("id", { count: "exact", head: true })
      .eq("coin_id", data.id)
      .eq("kind", "found")
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count || 0) > 0) return;
  }
  await sb.from("presence_coin_scans").insert({
    coin_id: data.id,
    kind: "found",
    ip_hash: ipHash,
    city: geo?.city ?? null,
    region: geo?.region ?? null,
    country: geo?.country ?? null,
  });
}

export { coinId as waveId };
