"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createPresenceClient, isSupabaseConfigured } from "@/lib/supabase";

type Moment = {
  id: string;
  activity: string;
  title: string | null;
  starts_at: string;
  place: string;
  city: string;
  vibes: string[];
  note: string | null;
  capacity: number | null;
  host_auth_user_id: string;
  host_name: string | null;
};

type JoinRequest = {
  id: string;
  moment_id: string;
  guest_auth_user_id: string;
  guest_name: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

const ACTIVITIES = ["Coffee", "Walk", "Meal", "Game", "Other"] as const;
const VIBES = [
  "Quiet & accepting",
  "Encouraging",
  "No agenda",
  "Introvert-friendly",
  "Open conversation",
  "Faith-friendly open",
];

function activityEmoji(a: string) {
  const map: Record<string, string> = {
    Coffee: "☕",
    Walk: "🚶",
    Meal: "🍽️",
    Game: "🎲",
    Other: "✨",
  };
  return map[a] || "✨";
}

function fmtDate(iso: string, long = false) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    weekday: long ? "long" : "short",
    month: long ? "long" : "short",
    day: "numeric",
  });
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Home() {
  const sb = createPresenceClient();

  // auth
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [aEmail, setAEmail] = useState("");
  const [aPass, setAPass] = useState("");
  const [aName, setAName] = useState("");
  const [aError, setAError] = useState("");
  const [aBusy, setABusy] = useState(false);

  // app
  const [view, setView] = useState<"home" | "host" | "detail" | "success">("home");
  const [moments, setMoments] = useState<Moment[]>([]);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<Moment | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [myRequest, setMyRequest] = useState<JoinRequest | null>(null);

  // host form
  const [hActivity, setHActivity] = useState("Coffee");
  const [hTitle, setHTitle] = useState("");
  const [hDate, setHDate] = useState(tomorrowStr());
  const [hTime, setHTime] = useState("10:00");
  const [hPlace, setHPlace] = useState("");
  const [hCity, setHCity] = useState("");
  const [hCapacity, setHCapacity] = useState(4);
  const [hVibes, setHVibes] = useState<string[]>([]);
  const [hNote, setHNote] = useState("");
  const [hAgree, setHAgree] = useState(false);
  const [hBusy, setHBusy] = useState(false);
  const [hError, setHError] = useState("");

  const displayName =
    (user?.user_metadata as { display_name?: string })?.display_name ||
    user?.email?.split("@")[0] ||
    "A neighbor";

  useEffect(() => {
    if (!sb) {
      setAuthChecked(true);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  const loadMoments = useCallback(async () => {
    if (!sb || !user) return;
    const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const { data } = await sb
      .from("presence_moments")
      .select("*")
      .eq("status", "open")
      .gte("starts_at", cutoff)
      .order("starts_at", { ascending: true })
      .limit(200);
    setMoments((data as Moment[]) || []);
  }, [sb, user]);

  useEffect(() => {
    if (user) loadMoments();
    else setMoments([]);
  }, [user, loadMoments]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setAError("");
    setABusy(true);
    try {
      if (authMode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: aEmail, password: aPass, displayName: aName }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAError(d.error || "Could not create your account.");
          return;
        }
      }
      const { error } = await sb.auth.signInWithPassword({
        email: aEmail.trim().toLowerCase(),
        password: aPass,
      });
      if (error) {
        setAError(
          authMode === "signup"
            ? "Account created, but sign-in failed. Try signing in."
            : "That email and password did not match. Try again."
        );
      }
    } catch {
      setAError("Something went wrong. Please try again.");
    } finally {
      setABusy(false);
    }
  }

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    setView("home");
    setDetail(null);
  }

  function goHome() {
    setView("home");
    setDetail(null);
    loadMoments();
    window.scrollTo(0, 0);
  }

  async function openDetail(m: Moment) {
    setDetail(m);
    setRequests([]);
    setMyRequest(null);
    setView("detail");
    window.scrollTo(0, 0);
    if (!sb || !user) return;
    if (m.host_auth_user_id === user.id) {
      const { data } = await sb
        .from("presence_join_requests")
        .select("*")
        .eq("moment_id", m.id)
        .order("created_at", { ascending: true });
      setRequests((data as JoinRequest[]) || []);
    } else {
      const { data } = await sb
        .from("presence_join_requests")
        .select("*")
        .eq("moment_id", m.id)
        .maybeSingle();
      setMyRequest((data as JoinRequest) || null);
    }
  }

  async function requestJoin() {
    if (!sb || !user || !detail) return;
    const { data, error } = await sb
      .from("presence_join_requests")
      .insert({
        moment_id: detail.id,
        guest_auth_user_id: user.id,
        guest_name: displayName,
      })
      .select("*")
      .single();
    if (error || !data) return;
    setMyRequest(data as JoinRequest);
    fetch("/api/journey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        displayName,
        eventType: "outing_joined",
        title: `Asked to join a ${detail.activity.toLowerCase()} moment`,
        detail: "Reaching out for real connection.",
      }),
    }).catch(() => {});
  }

  async function respond(reqId: string, status: "accepted" | "declined") {
    if (!sb) return;
    await sb.from("presence_join_requests").update({ status }).eq("id", reqId);
    setRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status } : r)));
  }

  async function publishMoment(e: React.FormEvent) {
    e.preventDefault();
    if (!sb || !user) return;
    setHError("");
    if (!hAgree) {
      setHError("Please agree to the Presence commitments to host.");
      return;
    }
    if (!hDate || !hTime || !hPlace.trim() || !hCity.trim()) {
      setHError("Please fill in date, time, place, and city.");
      return;
    }
    setHBusy(true);
    const starts = new Date(`${hDate}T${hTime}`);
    const { error } = await sb.from("presence_moments").insert({
      host_auth_user_id: user.id,
      host_name: displayName,
      activity: hActivity,
      title: hTitle.trim() || null,
      starts_at: starts.toISOString(),
      place: hPlace.trim(),
      city: hCity.trim(),
      vibes: hVibes,
      capacity: hCapacity,
      note: hNote.trim() || null,
      charter_agreed: true,
    });
    setHBusy(false);
    if (error) {
      setHError("Could not publish your moment. Please try again.");
      return;
    }
    fetch("/api/journey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        displayName,
        eventType: "outing_hosted",
        title: `Hosted a ${hActivity.toLowerCase()} moment`,
        detail: "Created space for others to belong.",
      }),
    }).catch(() => {});
    // reset
    setHTitle("");
    setHPlace("");
    setHCity("");
    setHNote("");
    setHVibes([]);
    setHAgree(false);
    setView("success");
    window.scrollTo(0, 0);
    loadMoments();
  }

  // ── render: not configured ──
  if (!isSupabaseConfigured()) {
    return (
      <div id="app">
        <div className="auth-wrap">
          <p className="hero-sub">This space isn&apos;t connected yet. Please try again shortly.</p>
        </div>
      </div>
    );
  }

  // ── render: loading ──
  if (!authChecked) {
    return (
      <div id="app">
        <div className="auth-wrap">
          <p className="hero-sub">…</p>
        </div>
      </div>
    );
  }

  // ── render: signed out (hero + charter + auth) ──
  if (!user) {
    return (
      <div id="app">
        <div className="auth-wrap">
          <div className="auth-inner">
            <div className="auth-head">
              <span className="logo-icon">🌿</span>
              <h1>Come as you are.<br />Leave less alone.</h1>
              <p>
                Simple moments of real presence — coffee, walks, meals, games —
                with people who choose acceptance over judgment.
              </p>
            </div>
            <form className="auth-card" onSubmit={handleAuth}>
              {authMode === "signup" && (
                <input
                  type="text"
                  value={aName}
                  onChange={(e) => setAName(e.target.value)}
                  placeholder="First name (optional)"
                />
              )}
              <input
                type="email"
                required
                value={aEmail}
                onChange={(e) => setAEmail(e.target.value)}
                placeholder="you@email.com"
              />
              <input
                type="password"
                required
                value={aPass}
                onChange={(e) => setAPass(e.target.value)}
                placeholder="Password (8+ characters)"
              />
              {aError && <p className="auth-error">{aError}</p>}
              <button type="submit" className="btn primary full" disabled={aBusy}>
                {aBusy ? "…" : authMode === "signup" ? "Join Presence" : "Sign in"}
              </button>
            </form>
            <p className="auth-switch">
              {authMode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <button
                onClick={() => {
                  setAuthMode(authMode === "signup" ? "signin" : "signup");
                  setAError("");
                }}
              >
                {authMode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
            <p className="auth-fine">
              Your account works across the whole Life Produces Life family.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const shown = moments.filter((m) => filter === "all" || m.activity === filter);

  // ── render: signed in ──
  return (
    <div id="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo" onClick={goHome}>
            <span className="logo-icon">🌿</span>
            <span className="logo-text">Presence</span>
          </div>
          <nav className="nav">
            <button className="nav-btn" onClick={goHome}>
              Moments
            </button>
            <button
              className="nav-btn primary"
              onClick={() => {
                setView("host");
                window.scrollTo(0, 0);
              }}
            >
              + Host
            </button>
            <button className="nav-btn" onClick={signOut}>
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main id="main">
        {view === "home" && (
          <section className="view">
            <div className="hero">
              <h1>
                Come as you are.
                <br />
                Leave less alone.
              </h1>
              <p className="hero-sub">
                Simple moments of real presence — coffee, walks, meals, games —
                with people who choose acceptance over judgment.
              </p>
            </div>

            <div className="culture-card">
              <h2>Our shared commitment</h2>
              <ul className="culture-list">
                <li>
                  <strong>Presence over performance.</strong> No fixing, no
                  ranking, no pressure to be impressive.
                </li>
                <li>
                  <strong>Acceptance is the default.</strong> Judgment,
                  criticism, and toxicity have no place here.
                </li>
                <li>
                  <strong>Encouragement is welcome.</strong> Kind words and
                  genuine interest are the culture.
                </li>
                <li>
                  <strong>Come as you are.</strong> Ordinary people looking for
                  hope, connection, and the reminder that we are not alone.
                </li>
              </ul>
              <p className="culture-note">
                Every host agrees to this. Feedback after each moment helps keep
                it true.
              </p>
            </div>

            <div className="section-header">
              <h2>Nearby Moments</h2>
              <div className="filters">
                {["all", "Coffee", "Walk", "Meal", "Game"].map((f) => (
                  <button
                    key={f}
                    className={`filter-chip${filter === f ? " active" : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="empty-state">
                <p>No moments match right now.</p>
                <button className="btn primary" onClick={() => setView("host")}>
                  Be the first to host one
                </button>
              </div>
            ) : (
              <div className="moments-grid">
                {shown.map((m) => (
                  <button key={m.id} className="moment-card" onClick={() => openDetail(m)}>
                    <div className="moment-top">
                      <span className="moment-activity">
                        {activityEmoji(m.activity)} {m.activity}
                      </span>
                      <span className="moment-time">
                        {fmtDate(m.starts_at)} · {fmtTime(m.starts_at)}
                      </span>
                    </div>
                    <div className="moment-title">
                      {m.title || `${m.activity} moment`}
                    </div>
                    <div className="moment-place">
                      {m.place} · {m.city}
                    </div>
                    <div className="moment-vibes">
                      {(m.vibes || []).slice(0, 3).map((v) => (
                        <span key={v} className="vibe-tag">
                          {v}
                        </span>
                      ))}
                    </div>
                    <div className="moment-meta">
                      <span>
                        Hosted by {m.host_auth_user_id === user.id ? "you" : m.host_name || "a neighbor"}
                      </span>
                      {m.capacity && <span>· up to {m.capacity}</span>}
                      {m.host_auth_user_id === user.id && (
                        <span className="host-badge">Your moment</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {view === "host" && (
          <section className="view">
            <div className="page-header">
              <button className="back-btn" onClick={goHome}>
                ← Back
              </button>
              <h1>Host a Moment</h1>
              <p>Under a minute. Keep it simple and welcoming.</p>
            </div>
            <form className="host-form" onSubmit={publishMoment}>
              <div className="form-group">
                <label>What kind of moment?</label>
                <div className="activity-options">
                  {ACTIVITIES.map((a) => (
                    <label key={a} className="activity-option">
                      <input
                        type="radio"
                        name="activity"
                        value={a}
                        checked={hActivity === a}
                        onChange={() => setHActivity(a)}
                      />
                      <span>
                        {activityEmoji(a)} {a === "Game" ? "Game night" : a}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="title">
                  Short title <span className="optional">(optional)</span>
                </label>
                <input
                  id="title"
                  type="text"
                  maxLength={60}
                  value={hTitle}
                  onChange={(e) => setHTitle(e.target.value)}
                  placeholder="e.g. Quiet morning coffee"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="date">Date</label>
                  <input
                    id="date"
                    type="date"
                    value={hDate}
                    onChange={(e) => setHDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="time">Time</label>
                  <input
                    id="time"
                    type="time"
                    value={hTime}
                    onChange={(e) => setHTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="place">Place (public preferred)</label>
                <input
                  id="place"
                  type="text"
                  value={hPlace}
                  onChange={(e) => setHPlace(e.target.value)}
                  placeholder="e.g. Starbucks on Main, or City Park entrance"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="city">City / Area</label>
                <input
                  id="city"
                  type="text"
                  value={hCity}
                  onChange={(e) => setHCity(e.target.value)}
                  placeholder="e.g. Stockbridge, Conyers, Atlanta"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="capacity">Max people</label>
                <select
                  id="capacity"
                  value={hCapacity}
                  onChange={(e) => setHCapacity(Number(e.target.value))}
                >
                  {[3, 4, 5, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Vibe (choose any that fit)</label>
                <div className="vibe-options">
                  {VIBES.map((v) => (
                    <label key={v} className="vibe-chip">
                      <input
                        type="checkbox"
                        checked={hVibes.includes(v)}
                        onChange={(e) =>
                          setHVibes((prev) =>
                            e.target.checked ? [...prev, v] : prev.filter((x) => x !== v)
                          )
                        }
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="note">
                  Note to guests <span className="optional">(optional)</span>
                </label>
                <textarea
                  id="note"
                  rows={2}
                  value={hNote}
                  onChange={(e) => setHNote(e.target.value)}
                  placeholder="Anything that helps people feel welcome…"
                />
              </div>

              <div className="charter-agree">
                <label>
                  <input
                    type="checkbox"
                    checked={hAgree}
                    onChange={(e) => setHAgree(e.target.checked)}
                  />
                  I agree to host according to the Presence commitments: presence
                  over performance, acceptance as default, no judgment or
                  toxicity.
                </label>
              </div>

              {hError && <p className="auth-error">{hError}</p>}
              <button type="submit" className="btn primary full" disabled={hBusy}>
                {hBusy ? "Publishing…" : "Publish Moment"}
              </button>
            </form>
          </section>
        )}

        {view === "detail" && detail && (
          <section className="view">
            <div className="page-header">
              <button className="back-btn" onClick={goHome}>
                ← Back
              </button>
            </div>
            <div className="detail-card">
              <div className="detail-activity">
                <span className="moment-activity">
                  {activityEmoji(detail.activity)} {detail.activity}
                </span>
              </div>
              <h2 className="detail-title">
                {detail.title || `${detail.activity} moment`}
              </h2>
              <div className="detail-meta">
                {fmtDate(detail.starts_at, true)} at {fmtTime(detail.starts_at)}
                <br />
                {detail.place} · {detail.city}
                <br />
                Hosted by{" "}
                {detail.host_auth_user_id === user.id ? "you" : detail.host_name || "a neighbor"}
                {detail.capacity ? ` · up to ${detail.capacity} people` : ""}
              </div>
              <div className="detail-vibes">
                {(detail.vibes || []).map((v) => (
                  <span key={v} className="vibe-tag">
                    {v}
                  </span>
                ))}
              </div>
              {detail.note && <div className="detail-note">{detail.note}</div>}

              {detail.host_auth_user_id === user.id ? (
                <div className="req-section">
                  <h3>Requests to join ({requests.length})</h3>
                  {requests.length === 0 ? (
                    <p className="hero-sub" style={{ fontSize: "0.9rem" }}>
                      No requests yet. They&apos;ll appear here as people ask to
                      join.
                    </p>
                  ) : (
                    requests.map((r) => (
                      <div key={r.id} className="req-item">
                        <div>
                          <div className="req-name">{r.guest_name || "A neighbor"}</div>
                          {r.message && <div className="req-msg">{r.message}</div>}
                        </div>
                        {r.status === "requested" ? (
                          <div className="req-actions">
                            <button
                              className="btn primary small"
                              onClick={() => respond(r.id, "accepted")}
                            >
                              Accept
                            </button>
                            <button
                              className="btn secondary small"
                              onClick={() => respond(r.id, "declined")}
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span className={`req-status ${r.status}`}>{r.status}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : myRequest ? (
                <div className="join-success">
                  {myRequest.status === "accepted"
                    ? "✓ You're in! The host accepted your request. See you there."
                    : myRequest.status === "declined"
                    ? "This one filled up or wasn't a fit. Plenty more moments to find."
                    : "✓ Request sent. The host will review it soon."}
                  <small
                    style={{
                      display: "block",
                      marginTop: 8,
                      fontWeight: 400,
                      color: "var(--text-muted)",
                    }}
                  >
                    Exact details and a way to say hello open up once the host
                    accepts. Culture of acceptance applies.
                  </small>
                </div>
              ) : (
                <div className="detail-actions">
                  <button className="btn primary full" onClick={requestJoin}>
                    Request to Join
                  </button>
                  <p
                    style={{
                      textAlign: "center",
                      fontSize: "0.85rem",
                      color: "var(--text-muted)",
                      marginTop: 8,
                    }}
                  >
                    Location details shared after the host accepts. Culture of
                    acceptance applies.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {view === "success" && (
          <section className="view">
            <div className="success-card">
              <div className="success-icon">✓</div>
              <h1>Moment published</h1>
              <p>
                People can now find and join it. Thank you for creating space for
                connection.
              </p>
              <button className="btn primary" onClick={goHome}>
                See all Moments
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Presence · Ordinary people · Real places · Acceptance first</p>
      </footer>
    </div>
  );
}
