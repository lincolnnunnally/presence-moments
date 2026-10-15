"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createPresenceClient } from "@/lib/supabase";

type Profile = {
  user_id: string;
  first_name: string;
  interests: string[];
  value_tags: string[];
  zip: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  connect_on: boolean;
  connect_on_since: string | null;
};
type Match = { user_id: string; first_name: string; shared: string[]; distance: string };
type Proposal = {
  id: string;
  role: "proposer" | "recipient";
  other_name: string;
  kind: "coffee" | "bar" | "meal";
  place_name: string;
  place_address: string | null;
  times: string[];
  chosen_time: string | null;
  status: string;
  expires_at: string;
  i_marked_happened: boolean;
};
type Notice = { id: string; message: string; read: boolean; created_at: string };
type Place = { name: string; address: string; source: string };

const INTEREST_SUGGESTIONS = ["coffee", "walks", "books", "music", "faith", "sports", "cooking", "outdoors", "art", "board games", "parenting", "fitness"];
const VALUE_SUGGESTIONS = ["kindness", "honesty", "faith", "family", "service", "curiosity", "humor", "community"];
const KIND_LABEL = { coffee: "☕ Coffee", bar: "🍻 Bar", meal: "🍽️ Meal" } as const;
const DEFAULT_HOUR = { coffee: 8, bar: 18, meal: 12 } as const;
const FALLBACK_PLACES: Record<string, string[]> = {
  coffee: ["A local coffee shop", "Library café"],
  bar: ["A neighborhood pub", "Hotel lobby bar"],
  meal: ["A diner on Main St", "A family restaurant"],
};

function isOn(p: Profile | null) {
  if (!p?.connect_on || !p.connect_on_since) return false;
  return Date.now() - new Date(p.connect_on_since).getTime() < 7 * 86400000;
}
function expiredOn(p: Profile | null) {
  return Boolean(p?.connect_on && p.connect_on_since && !isOn(p));
}
function suggestTimes(kind: keyof typeof DEFAULT_HOUR): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 1; out.length < 3 && i < 8; i += 2) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, DEFAULT_HOUR[kind], 0);
    out.push(toLocalInput(t));
  }
  return out;
}
function toLocalInput(t: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`;
}
function fmt(t: string) {
  return new Date(t).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function tags(s: string) {
  return Array.from(new Set(s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))).slice(0, 15);
}

export default function ConnectPage() {
  const sb = useMemo(() => createPresenceClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // profile form
  const [fName, setFName] = useState("");
  const [fInterests, setFInterests] = useState("");
  const [fValues, setFValues] = useState("");
  const [fZip, setFZip] = useState("");
  const [editing, setEditing] = useState(false);

  // propose form
  const [target, setTarget] = useState<Match | null>(null);
  const [kind, setKind] = useState<"coffee" | "bar" | "meal">("coffee");
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeName, setPlaceName] = useState("");
  const [placeAddr, setPlaceAddr] = useState("");
  const [times, setTimes] = useState<string[]>(suggestTimes("coffee"));

  useEffect(() => {
    if (!sb) { setChecked(true); return; }
    sb.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setChecked(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  const load = useCallback(async () => {
    if (!sb || !user) return;
    const { data: p } = await sb.from("presence_connect_profiles").select("*").eq("user_id", user.id).maybeSingle();
    setProfile(p as Profile | null);
    if (p) {
      setFName(p.first_name || "");
      setFInterests((p.interests || []).join(", "));
      setFValues((p.value_tags || []).join(", "));
      setFZip(p.zip || "");
    } else {
      const dn = (user.user_metadata as { display_name?: string })?.display_name || "";
      setFName(dn.split(" ")[0] || "");
      setEditing(true);
    }
    const [{ data: m }, { data: pr }, { data: n }] = await Promise.all([
      sb.rpc("presence_connect_matches"),
      sb.rpc("presence_connect_my_proposals"),
      sb.from("presence_connect_notices").select("id, message, read, created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    setMatches((m as Match[]) ?? []);
    setProposals((pr as Proposal[]) ?? []);
    setNotices((n as Notice[]) ?? []);
  }, [sb, user]);

  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<{ error: { message: string } | null }>, ok: string) {
    setBusy(true); setMsg("");
    const { error } = await fn();
    setBusy(false);
    setMsg(error ? error.message : ok);
    await load();
  }

  async function saveProfile() {
    if (!sb || !user) return;
    setBusy(true); setMsg("");
    let geo: { zip?: string; city?: string; lat?: number; lng?: number } = {};
    if (fZip.trim() && fZip.trim() !== profile?.zip) {
      const r = await fetch(`/api/connect/geo?zip=${encodeURIComponent(fZip.trim())}`);
      const d = await r.json();
      if (!r.ok) { setBusy(false); setMsg(d.error || "ZIP lookup failed."); return; }
      geo = d;
    }
    const { error } = await sb.from("presence_connect_profiles").upsert({
      user_id: user.id,
      first_name: fName.trim().split(" ")[0].slice(0, 40),
      interests: tags(fInterests),
      value_tags: tags(fValues),
      ...geo,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setEditing(false);
    setMsg("Saved.");
    load();
  }

  async function openPropose(m: Match) {
    setTarget(m);
    setKind("coffee");
    setTimes(suggestTimes("coffee"));
    loadPlaces(m, "coffee");
  }
  async function loadPlaces(m: Match, k: string) {
    setPlaces([]);
    setPlaceName(FALLBACK_PLACES[k][0]);
    setPlaceAddr("");
    const { data } = await sb!.auth.getSession();
    const r = await fetch(`/api/connect/places?with=${m.user_id}&kind=${k}`, {
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    });
    const d = await r.json().catch(() => ({}));
    const list: Place[] = d.places ?? [];
    setPlaces(list);
    if (list[0]) { setPlaceName(list[0].name); setPlaceAddr(list[0].address); }
  }

  if (!checked) return <div className="view"><p>Loading…</p></div>;

  if (!user) {
    return (
      <main className="view" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="hero">
          <h1>Connect</h1>
          <p className="hero-sub">One real person, one coffee, this week. Sign in to Presence first.</p>
        </div>
        <a className="btn primary full" href="/">Sign in to Presence</a>
      </main>
    );
  }

  const on = isOn(profile);
  const open = proposals.filter((p) => p.status === "proposed" || p.status === "confirmed");
  const past = proposals.filter((p) => !(p.status === "proposed" || p.status === "confirmed"));
  const unread = notices.filter((n) => !n.read);

  return (
    <div id="app">
      <header className="header">
        <div className="header-inner">
          <a className="logo" href="/" style={{ textDecoration: "none" }}>
            <span className="logo-icon">🌿</span>
            <span className="logo-text">Presence</span>
          </a>
          <nav className="nav">
            <a className="nav-btn" href="/">Moments</a>
            <a className="nav-btn primary" href="/connect">Connect</a>
          </nav>
        </div>
      </header>
      <main id="main" className="view" style={{ maxWidth: 680, margin: "0 auto" }}>
        <div className="page-header">
          <h1>Connect</h1>
          <p>Open to one real 1:1 this week? Turn Connect on. People nearby who are also on and share something with you will see your first name — never your location.</p>
        </div>

        {msg && <p className="culture-note" role="status" style={{ marginBottom: 16 }}>{msg}</p>}

        {unread.length > 0 && (
          <div className="culture-card" style={{ marginBottom: 16 }}>
            <h2>Notices</h2>
            <ul className="culture-list">
              {unread.map((n) => <li key={n.id}>{n.message}</li>)}
            </ul>
            <button className="btn secondary small" style={{ marginTop: 10 }} onClick={() =>
              run(async () => await sb!.from("presence_connect_notices").update({ read: true }).in("id", unread.map((n) => n.id)), "")}>
              Mark read
            </button>
          </div>
        )}

        <div className="detail-card" style={{ marginBottom: 16 }}>
          <div className="section-header" style={{ justifyContent: "space-between" }}>
            <h2>Connect: {on ? "On" : "Off"}</h2>
            <button
              className={`btn small ${on ? "secondary" : "primary"}`}
              disabled={busy || (!on && (!profile?.lat || !(profile.interests.length + profile.value_tags.length)))}
              onClick={() => run(async () => await sb!.rpc("presence_connect_set", { p_on: !on }), on ? "Connect is off. You can still browse." : "Connect is on for 7 days.")}
            >
              {on ? "Turn off" : expiredOn(profile) ? "Yes, still open — turn on again" : "Turn on"}
            </button>
          </div>
          <p className="moment-meta">
            {on
              ? `On since ${fmt(profile!.connect_on_since!)}. It turns off by itself after 7 days unless you re-confirm.`
              : expiredOn(profile)
                ? "It has been a week. Still open to meeting someone? Tap to stay on."
                : "Off means you're invisible to matching. Turn it on anytime."}
          </p>
          {!editing && profile && (
            <p className="moment-meta">
              {profile.first_name || "(no name)"} · {profile.city || "no ZIP yet"} · {[...profile.interests, ...profile.value_tags].join(", ") || "no interests yet"}{" "}
              <button className="nav-btn" onClick={() => setEditing(true)}>Edit</button>
            </p>
          )}
          {editing && (
            <div className="host-form" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label htmlFor="cn-name">First name (what others see)</label>
                <input id="cn-name" value={fName} onChange={(e) => setFName(e.target.value)} maxLength={40} />
              </div>
              <div className="form-group">
                <label htmlFor="cn-int">Interests <span className="optional">comma separated — e.g. {INTEREST_SUGGESTIONS.slice(0, 5).join(", ")}</span></label>
                <input id="cn-int" value={fInterests} onChange={(e) => setFInterests(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="cn-val">Values <span className="optional">e.g. {VALUE_SUGGESTIONS.slice(0, 5).join(", ")}</span></label>
                <input id="cn-val" value={fValues} onChange={(e) => setFValues(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="cn-zip">ZIP <span className="optional">only used for an approximate distance</span></label>
                <input id="cn-zip" value={fZip} onChange={(e) => setFZip(e.target.value)} inputMode="numeric" maxLength={5} />
              </div>
              <button className="btn primary" disabled={busy} onClick={saveProfile}>Save</button>
            </div>
          )}
        </div>

        {on && (
          <section style={{ marginBottom: 24 }}>
            <div className="section-header"><h2>Nearby and open this week</h2></div>
            {matches.length === 0 && <p className="moment-meta">No one nearby is on with a shared interest yet. Check back — or host a Moment.</p>}
            <div className="moments-grid">
              {matches.map((m) => (
                <div key={m.user_id} className="moment-card">
                  <div className="moment-top">
                    <span className="moment-title">{m.first_name || "Neighbor"}</span>
                    <span className="moment-time">{m.distance}</span>
                  </div>
                  <div className="moment-vibes">{m.shared.map((s) => <span key={s} className="vibe-tag">{s}</span>)}</div>
                  <div className="req-actions" style={{ marginTop: 10 }}>
                    <button className="btn primary small" onClick={() => openPropose(m)}>Coffee / bar / meal this week</button>
                    <button className="btn secondary small" onClick={() => {
                      if (confirm(`Block ${m.first_name}? They won't see you and you won't see them.`))
                        run(async () => await sb!.from("presence_connect_blocks").insert({ blocker_id: user.id, blocked_id: m.user_id }), "Blocked.");
                    }}>Block</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {target && (
          <div className="detail-card" style={{ marginBottom: 24 }}>
            <h2>Invite {target.first_name}</h2>
            <div className="activity-options" style={{ margin: "10px 0" }}>
              {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => (
                <button key={k} className={`filter-chip ${kind === k ? "active" : ""}`} onClick={() => { setKind(k); setTimes(suggestTimes(k)); loadPlaces(target, k); }}>{KIND_LABEL[k]}</button>
              ))}
            </div>
            <div className="host-form">
              <div className="form-group">
                <label>Public place</label>
                {places.length > 0 && (
                  <div className="filters">
                    {places.map((p) => (
                      <button key={p.name} className={`filter-chip ${placeName === p.name ? "active" : ""}`} onClick={() => { setPlaceName(p.name); setPlaceAddr(p.address); }}>{p.name}</button>
                    ))}
                  </div>
                )}
                <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={120} placeholder="Place name" />
                <input value={placeAddr} onChange={(e) => setPlaceAddr(e.target.value)} maxLength={200} placeholder="Address (optional)" />
                <span className="optional">{places.length ? "Suggestions near the middle of you two (OpenStreetMap / Presence places). Edit freely." : "Type any public spot you both know."}</span>
              </div>
              <div className="form-group">
                <label>Offer 2–3 times this week</label>
                {times.map((t, i) => (
                  <input key={i} type="datetime-local" value={t} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} />
                ))}
              </div>
              <div className="req-actions">
                <button className="btn primary" disabled={busy || !placeName.trim()} onClick={() =>
                  run(async () => {
                    const r = await sb!.rpc("presence_connect_propose", {
                      p_recipient: target.user_id, p_kind: kind, p_place_name: placeName, p_place_address: placeAddr,
                      p_times: times.filter(Boolean).map((t) => new Date(t).toISOString()),
                    });
                    if (!r.error) setTarget(null);
                    return r;
                  }, `Invitation sent to ${target.first_name}.`)}>Send invitation</button>
                <button className="btn secondary" onClick={() => setTarget(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <section>
          <div className="section-header"><h2>Your plans</h2></div>
          {open.length === 0 && <p className="moment-meta">Nothing open. Up to 3 open invitations at a time.</p>}
          <div className="moments-grid">
            {[...open, ...past.slice(0, 8)].map((p) => {
              const happenedOk = p.status === "confirmed" && p.chosen_time && new Date(p.chosen_time) <= new Date();
              return (
                <div key={p.id} className="moment-card">
                  <div className="moment-top">
                    <span className="moment-activity">{KIND_LABEL[p.kind]}</span>
                    <span className={`req-status ${p.status === "confirmed" ? "accepted" : p.status === "declined" ? "declined" : ""}`}>{p.status}</span>
                  </div>
                  <div className="moment-title">{p.role === "proposer" ? `You invited ${p.other_name}` : `${p.other_name} invited you`}</div>
                  <div className="moment-place">{p.place_name}{p.place_address ? ` · ${p.place_address}` : ""}</div>
                  <div className="moment-meta">
                    {p.chosen_time ? `When: ${fmt(p.chosen_time)}` : `Times: ${p.times.map(fmt).join(" · ")}`}
                    {p.status === "proposed" && ` · expires ${fmt(p.expires_at)}`}
                  </div>
                  <div className="req-actions" style={{ marginTop: 10, flexWrap: "wrap" }}>
                    {p.role === "recipient" && p.status === "proposed" && (
                      <>
                        {p.times.filter((t) => new Date(t) > new Date()).map((t) => (
                          <button key={t} className="btn primary small" disabled={busy} onClick={() => run(async () => await sb!.rpc("presence_connect_respond", { p_id: p.id, p_time: t }), "Confirmed. See you there.")}>{fmt(t)}</button>
                        ))}
                        <button className="btn secondary small" disabled={busy} onClick={() => run(async () => await sb!.rpc("presence_connect_respond", { p_id: p.id, p_time: null }), "Declined kindly.")}>Decline</button>
                      </>
                    )}
                    {(p.status === "proposed" || (p.status === "confirmed" && !happenedOk)) && p.role === "proposer" && (
                      <button className="btn secondary small" disabled={busy} onClick={() => run(async () => await sb!.rpc("presence_connect_cancel", { p_id: p.id }), "Cancelled.")}>Cancel</button>
                    )}
                    {happenedOk && !p.i_marked_happened && (
                      <button className="btn primary small" disabled={busy} onClick={() => run(async () => await sb!.rpc("presence_connect_happened", { p_id: p.id }), "Thank you for showing up.")}>It happened</button>
                    )}
                    {p.i_marked_happened && <span className="req-status accepted">You marked it happened ✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <p className="culture-note" style={{ marginTop: 24 }}>
          Meet in public. Tell a friend where you'll be. Block anyone who makes you uneasy. In a crisis call or text 988.
          Notices stay in this app — no email or texts.
        </p>
      </main>
    </div>
  );
}
