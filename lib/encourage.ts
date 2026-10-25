/**
 * Encouragement wall — notes people leave on a coin run's page.
 *
 * Anyone who found a coin can leave one without an account. A note shows at
 * once unless it looks like it should not: links, contact details, or words
 * that do not belong on a page meant to lift people. Those are held for a human
 * in Laser Engraving → Tokens. Three reports from different people hide a note.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Encouragement } from "./tokens";

export const MESSAGE_MIN = 3;
export const MESSAGE_MAX = 500;
export const NAME_MAX = 40;
export const WALL_LIMIT = 30;
const PER_HOUR_PER_PERSON = 3;
export const HIDE_AT_REPORTS = 3;

const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "dick", "pussy", "nigger", "nigga", "faggot", "retard",
  "whore", "slut", "kill yourself", "kys", "porn", "onlyfans", "crypto", "bitcoin", "casino",
];

export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

/** Why a note should wait for a person, or null if it can show now. */
export function holdReason(message: string, name: string): string | null {
  const both = `${name}\n${message}`.toLowerCase();
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(both)) return "email";
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ly|me|info|biz|xyz)\b)/i.test(both)) return "link";
  if ((both.match(/\d/g) || []).length >= 7) return "phone or numbers";
  if (/@[a-z0-9_.]{3,}/i.test(both)) return "handle";
  const words = both.replace(/[^a-z\s]/g, " ");
  if (BLOCKED.some((w) => new RegExp(`\\b${w}\\b`).test(words))) return "language";
  const letters = message.replace(/[^A-Za-z]/g, "");
  if (letters.length > 24 && letters === letters.toUpperCase()) return "all caps";
  return null;
}

export function ipHash(req: Request): string | null {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  if (!ip) return null;
  const salt = process.env.TOKEN_IP_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) || "presence";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function listEncouragements(
  sb: SupabaseClient,
  coinId: string,
  batchId: string | null,
): Promise<Encouragement[]> {
  let q = sb
    .from("presence_coin_encouragements")
    .select("id, display_name, message, created_at")
    .eq("status", "shown")
    .order("created_at", { ascending: false })
    .limit(WALL_LIMIT);
  q = batchId ? q.eq("batch_id", batchId) : q.eq("coin_id", coinId);
  const { data } = await q;
  return (data || []).map((r) => ({
    id: r.id,
    display_name: r.display_name || "A neighbor",
    message: r.message,
    created_at: r.created_at,
  }));
}

export type SaveResult =
  | { ok: true; status: "shown" | "held"; encouragement: Encouragement }
  | { ok: false; httpStatus: number; error: string };

export async function saveEncouragement(
  sb: SupabaseClient,
  args: {
    coin: { id: string; batch_id: string | null };
    message: string;
    displayName: string;
    authUserId: string | null;
    ipHash: string | null;
  },
): Promise<SaveResult> {
  const message = cleanText(args.message, MESSAGE_MAX + 1);
  const name = cleanText(args.displayName, NAME_MAX) || "A neighbor";
  if (message.length < MESSAGE_MIN) {
    return { ok: false, httpStatus: 400, error: "Write a few words first." };
  }
  if (message.length > MESSAGE_MAX) {
    return { ok: false, httpStatus: 400, error: `Keep it under ${MESSAGE_MAX} characters.` };
  }

  if (args.ipHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("presence_coin_encouragements")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", args.ipHash)
      .gte("created_at", since);
    if ((count || 0) >= PER_HOUR_PER_PERSON) {
      return { ok: false, httpStatus: 429, error: "Thank you for all of these. Give it an hour and leave another." };
    }
  }

  const reason = holdReason(message, name);
  const status = reason ? "held" : "shown";
  const { data, error } = await sb
    .from("presence_coin_encouragements")
    .insert({
      coin_id: args.coin.id,
      batch_id: args.coin.batch_id,
      display_name: name,
      message,
      auth_user_id: args.authUserId,
      ip_hash: args.ipHash,
      status,
      held_reason: reason,
    })
    .select("id, display_name, message, created_at")
    .single();
  if (error || !data) {
    return { ok: false, httpStatus: 503, error: "Could not save that. Please try again." };
  }
  return {
    ok: true,
    status,
    encouragement: {
      id: data.id,
      display_name: data.display_name || name,
      message: data.message,
      created_at: data.created_at,
    },
  };
}
