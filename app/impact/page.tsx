import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase-admin";
import { DEFAULT_GIVE_URL } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Little pieces of love — impact",
  description: "How many coins of hope have gone out, where, and what people said they did for them.",
  robots: { index: false, follow: false },
};

type Row = { coins_out: number; finds: number; notes: number; helped: number };
type Impact = {
  coins_made: number;
  coins_out: number;
  coins_planted: number;
  coins_given: number;
  towns: number;
  phrases: number;
  finds: number;
  finders: number;
  notes: number;
  helped: { yes: number; a_little: number; not_today: number };
  carrying: Record<string, number>;
  connections: Record<string, number>;
  orders: { requests: number; coins_requested: number; delivered: number };
  by_town: (Row & { town: string; state: string | null })[];
  by_phrase: (Row & { front_text: string; runs: number })[];
  by_month: (Row & { month: string })[];
  first_day: string | null;
};

const RANGES: Record<string, string> = { all: "All time", year: "This year", "90": "Last 90 days" };
const CARRYING: Record<string, string> = {
  lonely: "Loneliness",
  anxious: "Worry",
  afraid: "Fear",
  down: "Feeling low",
  weary: "Tiredness",
  grief: "Grief",
  normal: "Just a normal day",
};

const n = (v: number | undefined) => Number(v || 0).toLocaleString("en-US");

function sinceFor(range: string): string | null {
  const today = new Date();
  if (range === "year") return `${today.getFullYear()}-01-01`;
  if (range === "90") return new Date(today.getTime() - 90 * 864e5).toISOString().slice(0, 10);
  return null;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function ImpactPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: raw } = await searchParams;
  const range = raw && raw in RANGES ? raw : "all";
  const sb = createAdminClient();
  let impact: Impact | null = null;
  let notes: { message: string; display_name: string | null }[] = [];
  if (sb) {
    const { data } = await sb.rpc("presence_token_impact", { p_since: sinceFor(range), p_until: null });
    impact = (data as Impact) || null;
    const { data: recent } = await sb
      .from("presence_coin_encouragements")
      .select("message, display_name")
      .eq("status", "shown")
      .order("created_at", { ascending: false })
      .limit(6);
    notes = recent || [];
  }

  const helped = (impact?.helped.yes || 0) + (impact?.helped.a_little || 0);
  const answered = helped + (impact?.helped.not_today || 0);
  const connected = impact
    ? Object.entries(impact.connections)
        .filter(([k]) => k !== "give" && k !== "share")
        .reduce((a, [, v]) => a + (v || 0), 0)
    : 0;
  const carrying = Object.entries(impact?.carrying || {}).sort((a, b) => b[1] - a[1]);
  const maxMonth = Math.max(1, ...(impact?.by_month || []).map((m) => m.finds + m.coins_out));
  const early = !impact || (impact.coins_out < 50 && impact.finds < 25);

  return (
    <div id="app">
      <header className="header">
        <div className="header-inner">
          <a className="logo" href="/">
            <span className="logo-icon">🌿</span>
            <span className="logo-text">Presence</span>
          </a>
          <nav className="nav">
            <a className="nav-btn" href="/order">
              Request coins
            </a>
          </nav>
        </div>
      </header>
      <main className="view impact-view">
        <p className="token-kicker">Little pieces of love · United Under God</p>
        <h1 className="token-front" style={{ fontSize: "2rem" }}>
          What the coins have done
        </h1>
        <p className="token-message">
          Small engraved coins with a word of hope are left where people will find them. Each one leads to a page that
          tells the finder they are loved, lets them encourage the next person, and helps them find people nearby.
        </p>

        <nav className="impact-range" aria-label="Time range">
          {Object.entries(RANGES).map(([k, label]) => (
            <a key={k} href={k === "all" ? "/impact" : `/impact?range=${k}`} className={`chip${k === range ? " chip-on" : ""}`}>
              {label}
            </a>
          ))}
        </nav>

        {!impact ? (
          <p className="hero-sub">The numbers are not available right now. Please try again shortly.</p>
        ) : (
          <>
            {early && (
              <p className="culture-note impact-honest">
                This work is just beginning. These are real numbers, not projections, and we would rather show you small
                true ones than big guesses.
              </p>
            )}
            <div className="impact-grid">
              <div className="impact-stat">
                <strong>{n(impact.coins_out)}</strong>
                <span>coins placed in the world</span>
              </div>
              <div className="impact-stat">
                <strong>{n(impact.towns)}</strong>
                <span>{impact.towns === 1 ? "town" : "towns"}</span>
              </div>
              <div className="impact-stat">
                <strong>{n(impact.finders)}</strong>
                <span>people found one and opened it</span>
              </div>
              <div className="impact-stat">
                <strong>{n(helped)}</strong>
                <span>said it helped their day</span>
              </div>
              <div className="impact-stat">
                <strong>{n(impact.notes)}</strong>
                <span>notes of encouragement left for strangers</span>
              </div>
              <div className="impact-stat">
                <strong>{n(connected)}</strong>
                <span>steps toward people: groups, meetups, churches</span>
              </div>
            </div>

            <section className="impact-section">
              <h2>In plain words</h2>
              <p>
                {impact.first_day ? `Since ${new Date(impact.first_day + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, ` : ""}
                {n(impact.coins_made)} coins have been made and {n(impact.coins_out)} placed
                {impact.coins_given ? `, ${n(impact.coins_given)} of them through churches and groups who asked for them` : ""}.
                They have been opened {n(impact.finds)} times by {n(impact.finders)} people.
                {answered > 0 &&
                  ` Of the ${n(answered)} who answered "did this help today?", ${n(helped)} said yes or a little (${Math.round((helped / answered) * 100)}%).`}
              </p>
            </section>

            {carrying.length > 0 && (
              <section className="impact-section">
                <h2>What people said they were carrying</h2>
                <p className="hero-sub wall-sub">
                  Optional and anonymous. We ask so we know which words to put on the next coins.
                </p>
                <ul className="impact-bars">
                  {carrying.map(([k, v]) => (
                    <li key={k}>
                      <span>{CARRYING[k] || k}</span>
                      <span className="bar" style={{ width: `${Math.max(4, (v / carrying[0][1]) * 100)}%` }} />
                      <b>{n(v)}</b>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {impact.by_town.length > 0 && (
              <section className="impact-section">
                <h2>By town</h2>
                <table className="impact-table">
                  <thead>
                    <tr>
                      <th>Town</th>
                      <th>Placed</th>
                      <th>Found</th>
                      <th>Helped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.by_town.map((t) => (
                      <tr key={`${t.town}-${t.state}`}>
                        <td>
                          {t.town}
                          {t.state ? `, ${t.state}` : ""}
                        </td>
                        <td>{n(t.coins_out)}</td>
                        <td>{n(t.finds)}</td>
                        <td>{n(t.helped)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {impact.by_phrase.length > 0 && (
              <section className="impact-section">
                <h2>By message</h2>
                <table className="impact-table">
                  <thead>
                    <tr>
                      <th>Coin</th>
                      <th>Placed</th>
                      <th>Found</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.by_phrase.map((p) => (
                      <tr key={p.front_text}>
                        <td>{p.front_text}</td>
                        <td>{n(p.coins_out)}</td>
                        <td>{n(p.finds)}</td>
                        <td>{n(p.notes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {impact.by_month.length > 1 && (
              <section className="impact-section">
                <h2>Month by month</h2>
                <ul className="impact-bars">
                  {impact.by_month.map((m) => (
                    <li key={m.month}>
                      <span>{monthLabel(m.month)}</span>
                      <span className="bar" style={{ width: `${Math.max(4, ((m.finds + m.coins_out) / maxMonth) * 100)}%` }} />
                      <b>
                        {n(m.coins_out)} placed · {n(m.finds)} found
                      </b>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {notes.length > 0 && (
              <section className="impact-section">
                <h2>In their words</h2>
                <ul className="wall-list">
                  {notes.map((x, i) => (
                    <li key={i}>
                      <p className="wall-message">{x.message}</p>
                      <p className="wall-meta">
                        <span>{x.display_name || "A neighbor"}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="impact-section impact-how">
              <h2>How we count</h2>
              <p>
                Coins are counted when they are logged as made, placed, or handed to a group. A find is a person opening
                a coin&apos;s page, counted once per person per day. &ldquo;Helped&rdquo; and &ldquo;carrying&rdquo; are
                optional, anonymous taps. Towns come from where coins were placed and from the town a page was opened in.
                We do not collect names, ages, or exact locations from finders.
              </p>
            </section>
          </>
        )}

        <section className="why-give impact-support">
          <p>
            <strong>Help more coins find people.</strong> Coins, engraving, and the time to place them are given freely.
            Churches, foundations, and neighbors keep it going.
          </p>
          <a className="btn primary" href={DEFAULT_GIVE_URL} target="_blank" rel="noopener noreferrer">
            Support this ministry
          </a>{" "}
          <a className="btn secondary" href="/order">
            Request coins for your town
          </a>
        </section>
      </main>
    </div>
  );
}
