"use client";

import { FormEvent, useCallback, useEffect, useState, type CSSProperties } from "react";
import { createPresenceClient, isSupabaseConfigured } from "@/lib/supabase";

type Metric = { key: string; label: string; value: number | null };

type Stats = {
  ok: boolean;
  reporting: boolean;
  generatedAt?: string;
  metrics?: Metric[];
  message?: string;
};

const SLUG = "presence";
const EMPTY = "No one has used this yet. When they do, the numbers will appear here.";

function fmt(n: number | null | undefined) {
  if (n == null || n === 0) return "None yet";
  return n.toLocaleString();
}

export default function AdminPage() {
  const sb = createPresenceClient();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async (accessToken: string) => {
    const res = await fetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Stats;
    if (res.status === 403) {
      setDenied(true);
      setStats(null);
      setErr(data.message || "This dashboard is for the owner.");
      return;
    }
    if (!res.ok) {
      setStats(null);
      setErr(data.message || "Could not load owner stats.");
      return;
    }
    setDenied(false);
    setErr("");
    setStats(data);
  }, []);

  useEffect(() => {
    if (!sb) {
      setReady(true);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? null;
      setToken(t);
      setReady(true);
      if (t) void load(t);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const t = session?.access_token ?? null;
      setToken(t);
      setDenied(false);
      if (t) void load(t);
      else setStats(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [sb, load]);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setErr("");
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (error) setErr("That email and password did not match.");
  }

  const cards = stats?.metrics || [];
  const unused = !cards.some((m) => typeof m.value === "number" && m.value > 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f7f6", color: "#1e293b" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 80px" }}>
        <p style={{ letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12, color: "#0f766e", fontWeight: 700, margin: 0 }}>
          Owner
        </p>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "2.4rem", margin: "8px 0 6px" }}>Presence</h1>
        <p style={{ margin: "0 0 28px", color: "#64748b", fontSize: 17, maxWidth: 520 }}>
          How many real moments people have posted, and how many have asked to join.
        </p>

        {!isSupabaseConfigured() || !sb ? (
          <div style={card}>
            <p style={{ margin: 0 }}>Accounts are not connected yet, so this dashboard cannot sign you in.</p>
          </div>
        ) : !ready ? (
          <p style={{ color: "#64748b" }}>Loading…</p>
        ) : denied ? (
          <div style={card}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Not the owner account</h2>
            <p style={{ margin: "0 0 16px", color: "#64748b" }}>
              You are signed in, but this page only opens for the owner email.
            </p>
            <button type="button" style={btn} onClick={() => { void sb.auth.signOut(); setDenied(false); setErr(""); }}>
              Sign out
            </button>
          </div>
        ) : !token ? (
          <form onSubmit={signIn} style={card}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Owner sign-in</h2>
            <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14 }}>
              Use the owner email for this app. Other accounts will be turned away.
            </p>
            <label style={label}>Email</label>
            <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label style={label}>Password</label>
            <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {err ? <p style={{ color: "#9a3412", margin: "0 0 12px" }}>{err}</p> : null}
            <button type="submit" disabled={busy} style={btn}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <p style={{ margin: 0, color: "#64748b" }}>
                {stats?.reporting === false
                  ? "The database key is not configured, so live counts cannot be read yet."
                  : stats?.generatedAt
                    ? `As of ${new Date(stats.generatedAt).toLocaleString()}`
                    : null}
              </p>
              <button type="button" style={ghost} onClick={() => { void sb.auth.signOut(); setStats(null); }}>
                Sign out
              </button>
            </div>
            {err ? <p style={{ color: "#9a3412" }}>{err}</p> : null}
            {stats ? (
              <>
                <div style={grid}>
                  {cards.map((m) => (
                    <div key={m.key} style={kpi}>
                      <div style={num}>{fmt(m.value)}</div>
                      <div style={kpiLabel}>{m.label}</div>
                    </div>
                  ))}
                </div>
                {unused ? <p style={{ marginTop: 28, color: "#64748b", fontSize: 16 }}>{EMPTY}</p> : null}
              </>
            ) : !err ? (
              <p style={{ color: "#64748b" }}>Loading the picture…</p>
            ) : null}
          </>
        )}

        <p style={{ marginTop: 36, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <a href={`https://appengine.unitedundergod.org/help?app=${SLUG}`} style={link}>Need help?</a>
          <a href={`https://appengine.unitedundergod.org/apps/${SLUG}`} style={link}>Open in App Engine</a>
        </p>
      </div>
    </div>
  );
}

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #ccfbf1",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 12px 30px rgba(15, 118, 110, 0.08)",
};
const label: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, margin: "0 0 6px" };
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 12,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #99f6e4",
  background: "#fff",
  font: "inherit",
};
const btn: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: 0,
  borderRadius: 999,
  background: "#0f766e",
  color: "#fff",
  font: "inherit",
  fontWeight: 650,
  cursor: "pointer",
};
const ghost: CSSProperties = {
  border: "1px solid #99f6e4",
  background: "transparent",
  borderRadius: 999,
  padding: "8px 14px",
  font: "inherit",
  cursor: "pointer",
  color: "#0f766e",
};
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 };
const kpi: CSSProperties = { ...card, textAlign: "center", padding: "22px 12px" };
const num: CSSProperties = { fontSize: "2.1rem", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1 };
const kpiLabel: CSSProperties = { marginTop: 8, color: "#64748b", fontSize: 13 };
const link: CSSProperties = { color: "#0f766e", fontWeight: 600 };
