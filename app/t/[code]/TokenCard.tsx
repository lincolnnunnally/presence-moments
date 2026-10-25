"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createPresenceClient } from "@/lib/supabase";
import { GIVE_ORG, TOKEN_HANDOFFS, formatInvite, type Encouragement, type PublicWave } from "@/lib/tokens";
import { fullVerseUrl } from "@/lib/geo";
import CoinEmblem from "./CoinEmblem";

type Props = { initial: PublicWave; initialWall: Encouragement[] };

const WALL_PROMPTS = [
  "This made my day better. I hope yours is good too.",
  "Whoever finds the next one: you are not alone.",
  "I needed this today. Passing it on.",
];

const CARRYING: [string, string][] = [
  ["lonely", "Loneliness"],
  ["anxious", "Worry"],
  ["afraid", "Fear"],
  ["down", "Feeling low"],
  ["weary", "Tiredness"],
  ["grief", "Grief"],
  ["normal", "Just a normal day"],
];

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function TokenCard({ initial, initialWall }: Props) {
  const sb = createPresenceClient();
  const [wave, setWave] = useState(initial);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [wall, setWall] = useState<Encouragement[]>(initialWall);
  const [wallName, setWallName] = useState("");
  const [wallMessage, setWallMessage] = useState("");
  const [wallTrap, setWallTrap] = useState("");
  const [wallNote, setWallNote] = useState("");
  const [wallError, setWallError] = useState("");
  const [wallBusy, setWallBusy] = useState(false);
  const [reported, setReported] = useState<Record<string, boolean>>({});
  const [showAuth, setShowAuth] = useState(false);
  const [shared, setShared] = useState("");
  const [helped, setHelped] = useState<"" | "yes" | "a_little" | "not_today">("");
  const [carrying, setCarrying] = useState("");
  const [rsvpNote, setRsvpNote] = useState("");
  const [rsvpError, setRsvpError] = useState("");
  const [rsvpBusy, setRsvpBusy] = useState(false);

  const displayName = useMemo(() => {
    return (
      (user?.user_metadata as { display_name?: string } | undefined)?.display_name ||
      user?.email?.split("@")[0] ||
      "A neighbor"
    );
  }, [user]);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    try {
      const k = `token-found-${initial.code}`;
      if (!sessionStorage.getItem(k)) {
        sessionStorage.setItem(k, "1");
        fetch(`/api/tokens/${encodeURIComponent(initial.code)}?found=1`).catch(() => {});
      }
    } catch {
      fetch(`/api/tokens/${encodeURIComponent(initial.code)}?found=1`).catch(() => {});
    }
    try {
      const prior = localStorage.getItem(`token-helped-${initial.code}`);
      if (prior === "yes" || prior === "a_little" || prior === "not_today") setHelped(prior);
    } catch {
      /* private mode */
    }
    return () => sub.subscription.unsubscribe();
  }, [sb, initial.code]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setAuthError("");
    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName: name }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAuthError(d.error || "Could not create your account.");
          return;
        }
      }
      const { error } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setAuthError(
          authMode === "signup"
            ? "Account created, but sign-in failed. Try signing in."
            : "That email and password did not match. Try again.",
        );
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function leaveWord(e: React.FormEvent) {
    e.preventDefault();
    setWallError("");
    setWallNote("");
    setWallBusy(true);
    try {
      const session = sb ? (await sb.auth.getSession()).data.session : null;
      const token = session?.access_token;
      const res = await fetch(`/api/tokens/${encodeURIComponent(wave.code)}/encourage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: wallName || (user ? displayName : ""), message: wallMessage, website: wallTrap }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWallError(d.error || "Could not save that.");
        return;
      }
      if (d.status === "shown" && d.encouragement) {
        setWall((w) => [d.encouragement as Encouragement, ...w]);
        setWave((w) => ({ ...w, encouragement_count: w.encouragement_count + 1 }));
        setWallNote("Thank you. The next person who finds one of these will read that.");
      } else {
        setWallNote("Thank you. Someone will read it before it goes up on the page.");
      }
      setWallMessage("");
    } catch {
      setWallError("Something went wrong. Please try again.");
    } finally {
      setWallBusy(false);
    }
  }

  async function report(id: string) {
    if (reported[id]) return;
    if (!window.confirm("Flag this note as not belonging here? A person will look at it.")) return;
    setReported((r) => ({ ...r, [id]: true }));
    const res = await fetch(`/api/tokens/${encodeURIComponent(wave.code)}/encourage/${id}/report`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (d.hidden) setWall((w) => w.filter((x) => x.id !== id));
  }

  function openAuth() {
    setShowAuth(true);
    setTimeout(() => document.getElementById("sign-in")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  /** Anonymous, counted once per person per day for the impact report. Never blocks the tap. */
  function track(kind: string, detail?: string) {
    const url = `/api/tokens/${encodeURIComponent(wave.code)}/event`;
    const body = JSON.stringify({ kind, detail });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
    } catch {
      /* fall through */
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }

  function answerHelped(v: "yes" | "a_little" | "not_today") {
    setHelped(v);
    track("helped", v);
    try {
      localStorage.setItem(`token-helped-${wave.code}`, v);
    } catch {
      /* private mode */
    }
  }

  function answerCarrying(v: string) {
    setCarrying(v);
    track("carrying", v);
  }

  async function passItOn() {
    const url = window.location.href.split("?")[0];
    const text = `${wave.front_text.charAt(0)}${wave.front_text.slice(1).toLowerCase()}. Someone left this for a stranger to find.`;
    try {
      track("share");
      if (navigator.share) {
        await navigator.share({ title: "A coin found me", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared("Link copied.");
    } catch {
      /* the person closed the share sheet */
    }
  }

  async function rsvp(status: "going" | "maybe") {
    setRsvpError("");
    setRsvpNote("");
    if (!sb || !user) {
      setRsvpError("Sign in first so we know who is coming.");
      return;
    }
    setRsvpBusy(true);
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch(`/api/tokens/${encodeURIComponent(wave.code)}/rsvp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRsvpError(d.error || "Could not save that.");
      setRsvpBusy(false);
      return;
    }
    if (status === "going") {
      setRsvpNote("You have a seat. The win is the table — not this screen.");
      setWave((w) => ({ ...w, going_count: w.going_count + 1 }));
    } else {
      setRsvpNote("No pressure. The invitation will still be here.");
    }
    setRsvpBusy(false);
  }

  const invite = formatInvite(wave.invite_at);
  const placeLine = [wave.place_name, wave.place_address, wave.place_city].filter(Boolean).join(" · ");

  return (
    <div id="app">
      <header className="header">
        <div className="header-inner">
          <a className="logo" href="/">
            <span className="logo-icon">🌿</span>
            <span className="logo-text">Presence</span>
          </a>
          <nav className="nav">
            <a className="nav-btn" href="/found">
              Found a coin?
            </a>
          </nav>
        </div>
      </header>

      <main className="view token-view">
        <div className="coin-hero">
          <CoinEmblem design={wave.design} label={`The front of your coin: ${wave.front_text}`} />
          <p className="token-kicker">A coin found you in {wave.community_name}</p>
          <h1 className="token-front">{wave.front_text}</h1>
        </div>
        {wave.closed ? (
          <p className="hero-sub">This invitation has passed. You are still wanted. Here is a next step.</p>
        ) : (
          <p className="token-message">{wave.web_message}</p>
        )}

        {(wave.verse_text || (wave.back_text && wave.back_text !== "Scan me")) && (
          <figure className="coin-back">
            <p className="token-kicker">On the back of your coin</p>
            {wave.verse_text ? (
              <>
                <blockquote>{wave.verse_text}</blockquote>
                {wave.verse_ref && (
                  <figcaption>
                    {wave.verse_style === "paraphrase" ? `Inspired by ${wave.verse_ref}` : wave.verse_ref}
                    {wave.verse_style === "paraphrase" && fullVerseUrl(wave.verse_ref) && (
                      <>
                        {" · "}
                        <a href={fullVerseUrl(wave.verse_ref) as string} target="_blank" rel="noopener noreferrer">
                          Read the full verse
                        </a>
                      </>
                    )}
                  </figcaption>
                )}
              </>
            ) : (
              <blockquote>{wave.back_text}</blockquote>
            )}
          </figure>
        )}

        {wave.story && (
          <section className="token-story">
            <h2>A little more about this message</h2>
            {wave.story.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </section>
        )}

        {wave.found_count > 1 && (
          <p className="culture-note coin-count">
            {wave.found_count} people have found {wave.run_size > 1 ? "one of these coins" : "this coin"}. You are in good
            company.
          </p>
        )}

        {!wave.closed && (
          <section className="token-helped" aria-live="polite">
            {!helped ? (
              <>
                <h2>Did this help today?</h2>
                <div className="helped-row">
                  <button type="button" className="btn secondary small" onClick={() => answerHelped("yes")}>
                    Yes
                  </button>
                  <button type="button" className="btn secondary small" onClick={() => answerHelped("a_little")}>
                    A little
                  </button>
                  <button type="button" className="btn secondary small" onClick={() => answerHelped("not_today")}>
                    Not today
                  </button>
                </div>
                <p className="auth-fine wall-fine">Anonymous. It helps us know where to leave more of these.</p>
              </>
            ) : (
              <>
                <h2>{helped === "not_today" ? "Thank you for being honest." : "We are so glad."}</h2>
                {helped === "not_today" && (
                  <p className="hero-sub wall-sub">
                    Some days are just hard. You are still loved on this one. If you need someone right now, you can
                    call or text 988, any time.
                  </p>
                )}
                {!carrying ? (
                  <>
                    <p className="hero-sub wall-sub">If you want to say, what were you carrying today?</p>
                    <div className="helped-row">
                      {CARRYING.map(([v, label]) => (
                        <button key={v} type="button" className="chip" onClick={() => answerCarrying(v)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="hero-sub wall-sub">Thank you. You are not the only one carrying that today.</p>
                )}
              </>
            )}
          </section>
        )}

        {!wave.closed && wave.kind === "place" && wave.notice_prompt && (
          <div className="culture-card">
            <h2>{wave.place_name || "A place to notice"}</h2>
            {placeLine && <p className="moment-place">{placeLine}</p>}
            <p>{wave.notice_prompt}</p>
            {wave.best_time && <p className="culture-note">Best time: {wave.best_time}</p>}
          </div>
        )}

        {!wave.closed && wave.kind === "notice" && !wave.story && (
          <div className="culture-card">
            <h2>Right where you are</h2>
            <p>
              You do not have to go hunting. Look up. Look around. If you want a nearby place that helps,
              {wave.place_name ? ` try ${wave.place_name}.` : " a park bench or a west-facing sky is enough."}
            </p>
            {wave.notice_prompt && <p className="culture-note">{wave.notice_prompt}</p>}
          </div>
        )}

        {!wave.closed && wave.kind === "table" && (
          <div className="culture-card">
            <h2>A table is waiting</h2>
            <p>
              {invite ? `${invite}` : "A meal with other people who found a coin like this."}
              {wave.place_name ? ` at ${wave.place_name}` : ""}.
            </p>
            {placeLine && <p className="moment-place">{placeLine}</p>}
            <p>
              Come as you are. You do not have to know anyone. A few people may come — we will not pretend it is a
              crowd. Buy your own food. The point is belonging.
            </p>
            {wave.invite_notes && <p className="culture-note">{wave.invite_notes}</p>}
            {wave.going_count > 0 && (
              <p className="culture-note">
                {wave.going_count} {wave.going_count === 1 ? "person has" : "people have"} said they are coming.
              </p>
            )}
            {user ? (
              <div className="token-actions">
                <button className="btn primary" disabled={rsvpBusy} onClick={() => rsvp("going")}>
                  {rsvpBusy ? "…" : "I will come"}
                </button>
                <button className="btn secondary" disabled={rsvpBusy} onClick={() => rsvp("maybe")}>
                  Maybe
                </button>
              </div>
            ) : (
              <p className="culture-note">
                <button type="button" className="link-btn" onClick={openAuth}>
                  Sign in
                </button>{" "}
                to say you are coming, so the table knows how many chairs to pull up.
              </p>
            )}
            {rsvpError && <p className="auth-error">{rsvpError}</p>}
            {rsvpNote && <p className="auth-fine">{rsvpNote}</p>}
          </div>
        )}

        <section className="token-wall" aria-labelledby="wall-heading">
          <h2 id="wall-heading">Leave a word for the next person</h2>
          <p className="hero-sub wall-sub">
            {wave.run_size > 1
              ? `There are ${wave.run_size} of these coins out in the world. Everyone who finds one lands on this page.`
              : "Whoever finds this coin next lands on this page."}{" "}
            Did it make your day a little better? Say so, and pass some encouragement on.
          </p>
          {!wave.closed && (
            <form onSubmit={leaveWord} className="wall-form">
              <textarea
                required
                minLength={3}
                maxLength={500}
                rows={3}
                value={wallMessage}
                onChange={(e) => setWallMessage(e.target.value)}
                placeholder={WALL_PROMPTS[wave.code.length % WALL_PROMPTS.length]}
                aria-label="Your encouragement"
              />
              <input
                type="text"
                maxLength={40}
                value={wallName}
                onChange={(e) => setWallName(e.target.value)}
                placeholder={user ? displayName : "First name or town (optional)"}
                aria-label="Name to show (optional)"
              />
              <input
                className="wall-trap"
                tabIndex={-1}
                autoComplete="off"
                value={wallTrap}
                onChange={(e) => setWallTrap(e.target.value)}
                aria-hidden="true"
                name="website"
              />
              {wallError && <p className="auth-error">{wallError}</p>}
              {wallNote && <p className="wall-thanks">{wallNote}</p>}
              <button className="btn primary full" type="submit" disabled={wallBusy || wallMessage.trim().length < 3}>
                {wallBusy ? "…" : "Leave encouragement"}
              </button>
              <p className="auth-fine wall-fine">
                No account needed. Please keep it kind and leave out phone numbers and links.
              </p>
            </form>
          )}
          {wall.length > 0 ? (
            <ul className="wall-list">
              {wall.map((n) => (
                <li key={n.id}>
                  <p className="wall-message">{n.message}</p>
                  <p className="wall-meta">
                    <span>
                      {n.display_name} · {ago(n.created_at)}
                    </span>
                    <button
                      type="button"
                      className="wall-flag"
                      onClick={() => report(n.id)}
                      disabled={!!reported[n.id]}
                      aria-label="Flag this note"
                    >
                      {reported[n.id] ? "Flagged" : "Flag"}
                    </button>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="culture-note">No one has left a note yet. Yours could be the first one someone reads.</p>
          )}
        </section>

        <section className="token-gather">
          <h2>Find each other</h2>
          <p className="hero-sub wall-sub">
            {wave.gather_text ||
              "The coin is the start, not the point. The people who find these are your neighbors, and some of them would be glad to meet you."}
          </p>
          <div className="gather-grid">
            {wave.facebook_url && (
              <a className="gather-link" href={wave.facebook_url} target="_blank" rel="noopener noreferrer" onClick={() => track("click_facebook")}>
                <strong>Join the Facebook group</strong>
                <span>Talk with others who found one of these coins</span>
              </a>
            )}
            {wave.instagram_url && (
              <a className="gather-link" href={wave.instagram_url} target="_blank" rel="noopener noreferrer" onClick={() => track("click_instagram")}>
                <strong>Follow on Instagram</strong>
                <span>See where the coins are turning up</span>
              </a>
            )}
            <a className="gather-link" href="/" onClick={() => track("click_meetup")}>
              <strong>Meet up in person</strong>
              <span>Coffee, a walk, or a meal with a few people nearby</span>
            </a>
            <a className="gather-link" href="https://churchconnect.cloud/" target="_blank" rel="noopener noreferrer" onClick={() => track("click_church")}>
              <strong>Find a church</strong>
              <span>A church family that would be glad you walked in</span>
            </a>
          </div>
        </section>

        <section className="token-pass">
          <h2>Pass it on</h2>
          <p className="hero-sub wall-sub">
            Keep the coin if you need the reminder. If someone else needs it more, leave it where they will find it.
          </p>
          <button type="button" className="btn secondary" onClick={passItOn}>
            Send this page to someone
          </button>
          {shared && <p className="auth-fine">{shared}</p>}
        </section>

        {!user && showAuth && (
          <form id="sign-in" className="auth-card" onSubmit={handleAuth} style={{ marginTop: 24 }}>
            <p className="token-kicker">One login. You are the same person here as everywhere else.</p>
            {authMode === "signup" && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name (optional)"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            {authError && <p className="auth-error">{authError}</p>}
            <button type="submit" className="btn primary full" disabled={authBusy}>
              {authBusy ? "…" : authMode === "signup" ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              className="back-btn"
              onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}
            >
              {authMode === "signup" ? "I already have an account" : "I need an account"}
            </button>
          </form>
        )}

        {user && (
          <p className="culture-note" style={{ marginTop: 18 }}>
            Signed in as {displayName}. The win is off this screen.
          </p>
        )}

        <section className="token-next">
          <h2>You are not alone</h2>
          <p className="hero-sub" style={{ margin: "0 0 16px" }}>
            If you want a next step, pick one. Not ten. Encouragement, friendship, belonging in this town, or a
            small way to serve.
          </p>
          <ul className="handoff-list">
            {TOKEN_HANDOFFS.filter((h) => h.id !== "presence" && h.id !== "church").map((h) => (
              <li key={h.id}>
                <a href={h.href}>
                  <strong>{h.name}</strong>
                  <span>{h.when}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <footer className="token-why">
          <h2>Why we are doing this</h2>
          {wave.why_text.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
          {wave.sponsor_name && <p className="culture-note">This run of coins was made possible by {wave.sponsor_name}.</p>}
          <div className="why-give">
            <p>
              Want to help more of these find people? Coins, engraving, and the time to place them around town are
              given freely. You can help keep it going.
            </p>
            <a
              className="btn primary"
              href={wave.give_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("click_give")}
            >
              Support this ministry
            </a>
            <p className="auth-fine">Gifts go to {GIVE_ORG.replace(/\.$/, "")}.</p>
          </div>
          <div className="why-order">
            <p>
              <strong>Want coins to leave around your own town?</strong> Churches, groups, and neighbors can ask for some.
              They are free, and we will get them to you.
            </p>
            <a className="btn secondary" href="/order" onClick={() => track("click_order")}>
              Request coins
            </a>
          </div>
          {wave.verse_text && wave.verse_style === "quote" && (
            <p className="auth-fine">Scripture quoted from the Berean Standard Bible (BSB).</p>
          )}
          {!user && !showAuth && (
            <p className="auth-fine">
              <button type="button" className="link-btn" onClick={openAuth}>
                Sign in
              </button>{" "}
              — one login across Presence and its family of apps.
            </p>
          )}
        </footer>
      </main>
    </div>
  );
}
