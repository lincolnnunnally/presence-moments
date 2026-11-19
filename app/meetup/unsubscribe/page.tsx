import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meetup emails", robots: { index: false, follow: false } };

/** The link at the bottom of every meetup email. One click, no sign-in. */
export default async function MeetupUnsubscribe({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" && /^[0-9a-f]{36}$/.test(t) ? t : null;
  const sb = createAdminClient();
  let done = false;
  if (token && sb) {
    const { data } = await sb
      .from("presence_meetup_followers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .select("id");
    done = Boolean(data?.length);
  }
  return (
    <div id="app">
      <main className="view">
        <h1>{done ? "You will not get more emails about this meetup." : "We could not find that link."}</h1>
        <p className="hero-sub">
          {done
            ? "You are always welcome to come anyway. If you change your mind, scan the coin again and add your email."
            : "It may already be used. If emails keep coming, reply to one and we will take you off."}
        </p>
      </main>
    </div>
  );
}
