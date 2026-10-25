import type { Metadata } from "next";
import OrderForm from "./OrderForm";
import { DEFAULT_GIVE_URL } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Request coins for your town — Presence",
  description:
    "Small engraved coins with a word of hope and a QR code. Churches, groups, and neighbors can ask for some to leave around town.",
  alternates: { canonical: "/order" },
};

export default function OrderPage() {
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
        <p className="token-kicker">Little pieces of love</p>
        <h1 className="token-front" style={{ fontSize: "2rem" }}>
          Leave some coins in your town
        </h1>
        <p className="token-message">
          Each coin has a few words of hope on one side and a QR code on the other. Whoever finds one lands on a page
          that tells them they are loved, lets them encourage the next person, and helps them find people nearby.
        </p>
        <div className="culture-card">
          <h2>How it works</h2>
          <ul className="culture-list">
            <li>
              <strong>Tell us about your town</strong> and who you hope the coins will find: someone lonely, anxious,
              afraid, worn out, or just anyone.
            </li>
            <li>
              <strong>We reach out</strong> to talk through wording and timing, then make them.
            </li>
            <li>
              <strong>We get them to you.</strong> The coins are free. If you would like to help cover the cost,{" "}
              <a href={DEFAULT_GIVE_URL} target="_blank" rel="noopener noreferrer">
                you can give here
              </a>
              . No pressure either way.
            </li>
          </ul>
        </div>
        <OrderForm />
      </main>
    </div>
  );
}
