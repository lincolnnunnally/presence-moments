"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createPresenceClient } from "@/lib/supabase";
import { TOKEN_HANDOFFS, formatInvite, type PublicWave } from "@/lib/tokens";

type Props = { initial: PublicWave };

export default function TokenCard({ initial }: Props) {
  const sb = createPresenceClient();
  const [wave, setWave] = useState(initial);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [noticed, setNoticed] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
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

  async function share(e: React.FormEvent) {
    e.preventDefault();
    setShareError("");
    setShareNote("");
    if (!sb || !user) {
      setShareError("Sign in first so this is yours.");
      return;
    }
    setShareBusy(true);
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch(`/api/tokens/${encodeURIComponent(wave.code)}/experience`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ what_noticed: noticed }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setShareError(d.error || "Could not save that.");
      setShareBusy(false);
      return;
    }
    setShareNote("Thank you. Put the phone down and stay with what you noticed.");
    setNoticed("");
    setWave((w) => ({ ...w, experience_count: w.experience_count + 1 }));
    setShareBusy(false);
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
        <p className="token-kicker">{wave.community_name}</p>
        <h1 className="token-front">{wave.front_text}</h1>
        {wave.closed ? (
          <p className="hero-sub">This invitation has passed. You are still wanted. Here is a next step.</p>
        ) : (
          <p className="token-message">{wave.web_message}</p>
        )}

        {!wave.closed && wave.kind === "place" && wave.notice_prompt && (
          <div className="culture-card">
            <h2>{wave.place_name || "A place to notice"}</h2>
            {placeLine && <p className="moment-place">{placeLine}</p>}
            <p>{wave.notice_prompt}</p>
            {wave.best_time && <p className="culture-note">Best time: {wave.best_time}</p>}
          </div>
        )}

        {!wave.closed && wave.kind === "notice" && (
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
              <p className="culture-note">Sign in below to say you are coming.</p>
            )}
            {rsvpError && <p className="auth-error">{rsvpError}</p>}
            {rsvpNote && <p className="auth-fine">{rsvpNote}</p>}
          </div>
        )}

        {!wave.closed && (
          <section className="token-share">
            <h2>What did you notice?</h2>
            <p className="hero-sub" style={{ margin: "0 0 12px" }}>
              One sentence is enough. This is not a feed. It is a way to remember that goodness was here.
            </p>
            {user ? (
              <form onSubmit={share} className="host-form">
                <textarea
                  required
                  minLength={3}
                  maxLength={2000}
                  rows={4}
                  value={noticed}
                  onChange={(e) => setNoticed(e.target.value)}
                  placeholder="The sky, a tree, a kind face, a good meal…"
                />
                {shareError && <p className="auth-error">{shareError}</p>}
                {shareNote && <p className="auth-fine">{shareNote}</p>}
                <button className="btn primary full" type="submit" disabled={shareBusy}>
                  {shareBusy ? "…" : "Share this moment"}
                </button>
              </form>
            ) : (
              <p className="culture-note">Sign in to leave what you noticed — and to stay one person across this family of tools.</p>
            )}
          </section>
        )}

        {!user && (
          <form className="auth-card" onSubmit={handleAuth} style={{ marginTop: 24 }}>
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
            If you want a next step, pick one. Not ten. Friendship before dating. A church that would be glad you
            walked in. People nearby who care.
          </p>
          <ul className="handoff-list">
            {TOKEN_HANDOFFS.map((h) => (
              <li key={h.id}>
                <a href={h.href}>
                  <strong>{h.name}</strong>
                  <span>{h.when}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
