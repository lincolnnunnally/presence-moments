import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicWave, WaveKind, WaveStatus } from "./tokens";

const PUBLIC_STATUSES = ["engraving", "planted", "live", "closed"];

export function tablesMissing(message: string | undefined): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the table")
  );
}

export async function loadPublicWave(
  sb: SupabaseClient,
  rawCode: string,
): Promise<{ wave: PublicWave | null; missingTables: boolean; error?: string }> {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code || code.length > 32) {
    return { wave: null, missingTables: false };
  }

  const { data, error } = await sb
    .from("presence_waves")
    .select(
      "id, code, kind, status, title, front_text, back_text, web_message, invite_at, invite_notes, found_count, community_id, place_id",
    )
    .eq("code", code)
    .maybeSingle();

  if (error) {
    if (tablesMissing(error.message)) {
      return { wave: null, missingTables: true, error: error.message };
    }
    return { wave: null, missingTables: false, error: error.message };
  }
  if (!data || !PUBLIC_STATUSES.includes(data.status)) {
    return { wave: null, missingTables: false };
  }

  let community_name = "this town";
  if (data.community_id) {
    const { data: c } = await sb
      .from("presence_communities")
      .select("name")
      .eq("id", data.community_id)
      .maybeSingle();
    if (c?.name) community_name = c.name;
  }

  let place_name: string | null = null;
  let place_address: string | null = null;
  let place_city: string | null = null;
  let notice_prompt: string | null = null;
  let best_time: string | null = null;
  if (data.place_id) {
    const { data: p } = await sb
      .from("presence_places")
      .select("name, address, city, notice_prompt, best_time")
      .eq("id", data.place_id)
      .maybeSingle();
    if (p) {
      place_name = p.name;
      place_address = p.address;
      place_city = p.city;
      notice_prompt = p.notice_prompt;
      best_time = p.best_time;
    }
  }

  const [{ count: experience_count }, { count: going_count }] = await Promise.all([
    sb.from("presence_experiences").select("id", { count: "exact", head: true }).eq("wave_id", data.id),
    sb
      .from("presence_wave_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("wave_id", data.id)
      .eq("status", "going"),
  ]);

  const wave: PublicWave = {
    code: data.code,
    kind: data.kind as WaveKind,
    status: data.status as WaveStatus,
    title: data.title,
    front_text: data.front_text,
    back_text: data.back_text,
    web_message: data.web_message,
    invite_at: data.invite_at,
    invite_notes: data.invite_notes,
    community_name,
    place_name,
    place_address,
    place_city,
    notice_prompt,
    best_time,
    found_count: data.found_count || 0,
    experience_count: typeof experience_count === "number" ? experience_count : 0,
    going_count: typeof going_count === "number" ? going_count : 0,
    closed: data.status === "closed",
  };
  return { wave, missingTables: false };
}

export async function waveId(sb: SupabaseClient, code: string): Promise<string | null> {
  const { data } = await sb
    .from("presence_waves")
    .select("id")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  return data?.id ?? null;
}

export async function bumpFound(sb: SupabaseClient, code: string): Promise<void> {
  const { data } = await sb
    .from("presence_waves")
    .select("id, found_count")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!data?.id) return;
  const next = (typeof data.found_count === "number" ? data.found_count : 0) + 1;
  await sb
    .from("presence_waves")
    .update({ found_count: next, updated_at: new Date().toISOString() })
    .eq("id", data.id);
}
