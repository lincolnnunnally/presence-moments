import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Found a coin? — Presence",
  description:
    "You Are Awesome tokens find people in town with a small invitation to look up, notice the good, and sit with others.",
};

export default function FoundPage() {
  return (
    <div id="app">
      <header className="header">
        <div className="header-inner">
          <a className="logo" href="/">
            <span className="logo-icon">🌿</span>
            <span className="logo-text">Presence</span>
          </a>
        </div>
      </header>
      <main className="view">
        <p className="token-kicker">You Are Awesome</p>
        <h1 className="token-front" style={{ fontSize: "2rem" }}>
          You found a coin.
        </h1>
        <p className="token-message">
          These little tokens are not a scavenger hunt. They find you. Someone made one so that, for a minute, you
          might look up and notice the goodness that is already around you — a sky, a tree, a kind face, a warm meal.
        </p>
        <div className="culture-card">
          <h2>What to do</h2>
          <ul className="culture-list">
            <li>
              <strong>Read the words on the coin.</strong> That is the whole invitation, even if you never open a
              website.
            </li>
            <li>
              <strong>Scan the QR</strong> if you want the fuller message, a place to notice, or a table with other
              people who found one too.
            </li>
            <li>
              <strong>Keep it or leave it.</strong> If it helped you, you can pass it on so it can find someone else.
            </li>
          </ul>
        </div>
        <p className="hero-sub">
          You are not alone in nature. You are not alone in this town. You are awesome, you are appreciated, and you
          are wanted.
        </p>
        <p style={{ marginTop: 24 }}>
          <a className="btn primary" href="/">
            Sit with people
          </a>
        </p>
      </main>
    </div>
  );
}
