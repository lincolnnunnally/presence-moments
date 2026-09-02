import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadPublicWave } from "@/lib/token-data";
import TokenCard from "./TokenCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `You are awesome — ${code.toUpperCase()}`,
    description: "A small invitation to look up, notice the good, and remember you are not alone.",
    robots: { index: false, follow: false },
  };
}

export default async function TokenPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sb = createAdminClient();
  if (!sb) {
    return (
      <div id="app">
        <main className="view">
          <h1>This space is not connected yet.</h1>
          <p className="hero-sub">Please try again shortly.</p>
        </main>
      </div>
    );
  }
  const { wave, missingTables } = await loadPublicWave(sb, code);
  if (missingTables) {
    return (
      <div id="app">
        <main className="view">
          <h1>This invitation is being set up.</h1>
          <p className="hero-sub">The coin is real. The page is not live on this database yet.</p>
        </main>
      </div>
    );
  }
  if (!wave) {
    return (
      <div id="app">
        <main className="view">
          <p className="token-kicker">Presence</p>
          <h1>We do not recognize that coin yet.</h1>
          <p className="hero-sub">
            You are still wanted. If you found a token in town, you can still look up, notice one good thing, and
            take a next step.
          </p>
          <p style={{ marginTop: 20 }}>
            <a className="btn primary" href="/found">
              Found a coin?
            </a>
          </p>
        </main>
      </div>
    );
  }
  return <TokenCard initial={wave} />;
}
