"use client";

import { useState } from "react";
import { DEFAULT_GIVE_URL } from "@/lib/tokens";

const FOR: [string, string][] = [
  ["lonely", "Someone lonely"],
  ["anxious", "Someone anxious"],
  ["afraid", "Someone afraid"],
  ["down", "Someone feeling down or unloved"],
  ["weary", "Someone worn out"],
  ["notice", "Anyone, to look up and notice the good"],
  ["any", "Not sure, you pick"],
];

export default function OrderForm() {
  const [f, setF] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
    city: "",
    state: "",
    quantity: 50,
    wording: "",
    purpose: "",
    needed_by: "",
    will_give: false,
    website: "",
  });
  const [themes, setThemes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: k === "quantity" ? Number(e.target.value) : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, themes }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Could not send that. Please try again.");
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="culture-card order-done" aria-live="polite">
        <h2>Thank you. We got it.</h2>
        <p>
          We will reach out to {f.email} soon about wording, timing, and getting the coins to you. Thank you for
          helping someone feel seen.
        </p>
        {f.will_give && (
          <p style={{ marginTop: 14 }}>
            <a className="btn primary" href={DEFAULT_GIVE_URL} target="_blank" rel="noopener noreferrer">
              Give toward the cost
            </a>
          </p>
        )}
      </section>
    );
  }

  return (
    <form className="order-form" onSubmit={submit}>
      <h2>Request coins</h2>
      <div className="order-grid">
        <input required maxLength={120} value={f.name} onChange={set("name")} placeholder="Your name" aria-label="Your name" />
        <input
          required
          type="email"
          maxLength={200}
          value={f.email}
          onChange={set("email")}
          placeholder="Email"
          aria-label="Email"
        />
        <input maxLength={40} value={f.phone} onChange={set("phone")} placeholder="Phone (optional)" aria-label="Phone" />
        <input
          maxLength={160}
          value={f.organization}
          onChange={set("organization")}
          placeholder="Church or group (optional)"
          aria-label="Church or group"
        />
        <input maxLength={80} value={f.city} onChange={set("city")} placeholder="Town" aria-label="Town" />
        <input maxLength={40} value={f.state} onChange={set("state")} placeholder="State" aria-label="State" />
      </div>
      <label className="order-label">
        How many coins?
        <input type="number" min={1} max={100000} required value={f.quantity} onChange={set("quantity")} />
      </label>
      <fieldset className="order-for">
        <legend>Who do you hope they find?</legend>
        <div className="helped-row" style={{ justifyContent: "flex-start" }}>
          {FOR.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`chip${themes.includes(v) ? " chip-on" : ""}`}
              aria-pressed={themes.includes(v)}
              onClick={() => setThemes((t) => (t.includes(v) ? t.filter((x) => x !== v) : [...t, v]))}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="order-label">
        Wording you have in mind (optional)
        <input maxLength={500} value={f.wording} onChange={set("wording")} placeholder="YOU ARE LOVED, with a cross" />
      </label>
      <label className="order-label">
        Where will they go? (optional)
        <textarea
          rows={3}
          maxLength={2000}
          value={f.purpose}
          onChange={set("purpose")}
          placeholder="Our youth group wants to leave them at the hospital and the laundromat."
        />
      </label>
      <label className="order-label">
        Needed by (optional)
        <input type="date" value={f.needed_by} onChange={set("needed_by")} />
      </label>
      <label className="order-check">
        <input
          type="checkbox"
          checked={f.will_give}
          onChange={(e) => setF((x) => ({ ...x, will_give: e.target.checked }))}
        />
        I would like to give toward the cost of making them
      </label>
      <input className="wall-trap" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} aria-hidden="true" />
      {error && <p className="auth-error">{error}</p>}
      <button className="btn primary full" type="submit" disabled={busy}>
        {busy ? "…" : "Send request"}
      </button>
      <p className="auth-fine">We only use your details to reach you about these coins.</p>
    </form>
  );
}
