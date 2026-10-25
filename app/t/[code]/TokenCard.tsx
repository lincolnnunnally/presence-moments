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

/** First sentence shows; the rest waits behind "Read more". */
function splitFirst(text: string): [string, string] {
  const m = text.match(/^([\s\S]+?[.!?])\s+([\s\S]+)$/);
  return m ? [m[1], m[2]] : [text, ""];
}

const AVATAR_TONES = ["#0f766e", "#b45309", "#7c3aed", "#be185d", "#1d4ed8", "#4d7c0f"];
function avatarTone(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

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
  // Handoffs already shown as photo tiles; the rest become small chips.
  const friendTile = !wave.facebook_url && !wave.instagram_url;
  const onTiles = ["presence", "church", ...(friendTile ? ["kindred"] : [])];
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
          {wave.front_image_url ? (
            <div className="coin-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wave.front_image_url} alt={`The front of your coin: ${wave.front_text}`} />
            </div>
          ) : (
            <CoinEmblem design={wave.design} label={`The front of your coin: ${wave.front_text}`} />
          )}
          <p className="token-kicker">A coin found you</p>
          <h1 className="token-front">{wave.front_text}</h1>
        </div>
        {wave.closed ? (
          <p className="hero-sub">This invitation has passed. You are still wanted. Here is a next step.</p>
        ) : (
          <p className="token-message">{wave.web_message}</p>
        )}

        {(wave.verse_text || wave.back_image_url || (wave.back_text && wave.back_text !== "Scan me")) && (
          <figure className={`coin-back${wave.back_image_url ? " has-photo" : ""}`}>
            {wave.back_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="coin-back-photo" src={wave.back_image_url} alt="The back of your coin" />
            )}
            <div>
              <p className="token-kicker">On the back of your coin</p>
              {wave.verse_text ? (
                <>
                  <blockquote>{wave.verse_text}</blockquote>
                  {wave.verse_ref && (
                    <p className="coin-ref">
                      {wave.verse_style === "paraphrase" ? `Inspired by ${wave.verse_ref}` : wave.verse_ref}
                      {wave.verse_style === "paraphrase" && fullVerseUrl(wave.verse_ref) && (
                        <>
                          {" · "}
                          <a href={fullVerseUrl(wave.verse_ref) as string} target="_blank" rel="noopener noreferrer">
                            Read the full verse
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <blockquote>{wave.back_text}</blockquote>
              )}
            </div>
          </figure>
        )}

        {wave.story && (
          <details className="token-more">
            <summary>A little more about this message</summary>
            {wave.story.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </details>
        )}

        {wave.found_count > 1 && (
          <p className="culture-note coin-count">
            {wave.found_count} people have found {wave.run_size > 1 ? "one of these coins" : "this coin"}.
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
                    <p className="hero-sub wall-sub">What were you carrying today?</p>
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
          <div className="photo-band">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/token/note.jpg" alt="" loading="lazy" />
            <div>
              <h2 id="wall-heading">Leave a word for the next person</h2>
              <p>
                {wave.run_size > 1 ? `${wave.run_size} of these coins are out there.` : "Someone will find this coin next."}{" "}
                Pass some hope on.
              </p>
            </div>
          </div>
          {!wave.closed && (
            <form onSubmit={leaveWord} className="wall-form">
              <textarea
                required
                minLength={3}
                maxLength={500}
                rows={2}
                value={wallMessage}
                onChange={(e) => setWallMessage(e.target.value)}
                placeholder={WALL_PROMPTS[wave.code.length % WALL_PROMPTS.length]}
                aria-label="Your encouragement"
              />
              <div className="wall-row">
                <input
                  type="text"
                  maxLength={40}
                  value={wallName}
                  onChange={(e) => setWallName(e.target.value)}
                  placeholder={user ? displayName : "Your first name (optional)"}
                  aria-label="Name to show (optional)"
                />
                <button className="btn primary" type="submit" disabled={wallBusy || wallMessage.trim().length < 3}>
                  {wallBusy ? "…" : "Share"}
                </button>
              </div>
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
              <p className="wall-fine">No account needed. Keep it kind.</p>
            </form>
          )}
          {wall.length > 0 ? (
            <ul className="wall-list">
              {wall.map((n) => (
                <li key={n.id} className="note-card">
                  <span className="avatar" style={{ background: avatarTone(n.display_name) }} aria-hidden="true">
                    {(n.display_name.trim()[0] || "•").toUpperCase()}
                  </span>
                  <div className="note-body">
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
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wall-empty">Be the first to leave a note.</p>
          )}
        </section>

        <section className="token-gather">
          <h2>Find each other</h2>
          {wave.gather_text && <p className="hero-sub wall-sub">{wave.gather_text}</p>}
          <div className="tiles">
            {wave.facebook_url && (
              <a className="tile" href={wave.facebook_url} target="_blank" rel="noopener noreferrer" onClick={() => track("click_facebook")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/token/fellowship.jpg" alt="" loading="lazy" />
                <span>Join the group</span>
              </a>
            )}
            {wave.instagram_url && (
              <a className="tile" href={wave.instagram_url} target="_blank" rel="noopener noreferrer" onClick={() => track("click_instagram")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/token/fountain.jpg" alt="" loading="lazy" />
                <span>See where coins turn up</span>
              </a>
            )}
            <a className="tile" href="/" onClick={() => track("click_meetup")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/token/coffee.jpg" alt="" loading="lazy" />
              <span>Meet for coffee</span>
            </a>
            <a className="tile" href="https://churchconnect.cloud/" target="_blank" rel="noopener noreferrer" onClick={() => track("click_church")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/token/church.jpg" alt="" loading="lazy" />
              <span>Find a church</span>
            </a>
            {friendTile && (
              <a className="tile tile-wide" href="https://kindred.unitedundergod.org/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/token/porch-talk.jpg" alt="" loading="lazy" />
                <span>Make a friend</span>
              </a>
            )}
          </div>
          <div className="hope-chips">
            {TOKEN_HANDOFFS.filter((h) => !onTiles.includes(h.id)).map((h) => (
              <a key={h.id} className="chip" href={h.href} title={h.when}>
                {h.name}
              </a>
            ))}
          </div>
        </section>

        <section className="token-pass">
          <button type="button" className="btn secondary pass-btn" onClick={passItOn}>
            Send this to someone who needs it
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

        <footer className="token-why">
          <div className="photo-band">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/token/porch-give.jpg" alt="" loading="lazy" />
            <div>
              <h2>Why we do this</h2>
              <p>{splitFirst(wave.why_text)[0]}</p>
            </div>
          </div>
          {splitFirst(wave.why_text)[1] && (
            <details className="token-more">
              <summary>Read more</summary>
              {splitFirst(wave.why_text)[1]
                .split(/\n{2,}/)
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
            </details>
          )}
          {wave.sponsor_name && <p className="culture-note">Made possible by {wave.sponsor_name}.</p>}
          <div className="why-actions">
            <a
              className="btn primary"
              href={wave.give_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("click_give")}
            >
              Support this ministry
            </a>
            <a className="btn secondary" href="/order" onClick={() => track("click_order")}>
              Get coins for your town
            </a>
          </div>
          <p className="auth-fine">
            Gifts go to {GIVE_ORG.replace(/\.$/, "")}. Coins are free to churches and groups.
          </p>
          {wave.verse_text && wave.verse_style === "quote" && (
            <p className="auth-fine">Scripture quoted from the Berean Standard Bible (BSB).</p>
          )}
          {!user && !showAuth && (
            <p className="auth-fine">
              <button type="button" className="link-btn" onClick={openAuth}>
                Sign in
              </button>
            </p>
          )}
        </footer>
      </main>
    </div>
  );
}
