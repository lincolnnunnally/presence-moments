import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Emit growth-journey events into the shared UUG tables (same LPL Supabase).
 * Fire-and-forget — never block the user's action on a journey write failing.
 * This is how Presence plugs into the ecosystem: showing up for real connection
 * is one step of a person's larger journey across tools.
 */
export type JourneyEmit = {
  email: string;
  displayName?: string | null;
  eventType: string;
  title?: string;
  detail?: string;
  seasonHint?: string;
  meta?: Record<string, unknown>;
};

const SOURCE_APP = "presence";

export async function emitJourneyEvent(
  admin: SupabaseClient,
  e: JourneyEmit
): Promise<void> {
  const profile_key = (e.email || "").trim().toLowerCase();
  if (!profile_key) return;

  try {
    let personId: string | null = null;
    let displayName = e.displayName || null;

    if (profile_key.includes("@")) {
      const { data: lpl } = await admin
        .from("lpl_people")
        .select("id, preferred_name, full_name")
        .ilike("email", profile_key)
        .maybeSingle();
      if (lpl?.id) {
        personId = lpl.id;
        displayName = displayName || lpl.preferred_name || lpl.full_name || null;
      }
    }

    const { data: existing } = await admin
      .from("uug_journey_profiles")
      .select("*")
      .eq("profile_key", profile_key)
      .maybeSingle();

    const apps = new Set<string>(
      Array.isArray(existing?.apps_touched) ? existing.apps_touched : []
    );
    apps.add(SOURCE_APP);

    const patch: Record<string, unknown> = {
      profile_key,
      display_name: displayName || existing?.display_name || null,
      person_id: personId || existing?.person_id || null,
      apps_touched: Array.from(apps),
      updated_at: new Date().toISOString(),
    };
    const n = (v: unknown) => (typeof v === "number" ? v : 0);
    if (e.eventType === "outing_hosted") {
      patch.kindness_given = n(existing?.kindness_given) + 1;
    } else if (e.eventType === "outing_joined") {
      patch.kindness_received = n(existing?.kindness_received) + 1;
    }

    await admin.from("uug_journey_profiles").upsert(patch, { onConflict: "profile_key" });

    await admin.from("uug_journey_events").insert({
      profile_key,
      person_id: personId,
      source_app: SOURCE_APP,
      event_type: e.eventType,
      season_hint: e.seasonHint || null,
      title: e.title || null,
      detail: e.detail || null,
      meta: e.meta || {},
    });
  } catch (err) {
    console.error("journey-emit", err);
  }
}
