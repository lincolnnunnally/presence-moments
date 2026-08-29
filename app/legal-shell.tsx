import type { ReactNode } from "react";
import Link from "next/link";

export function CounselReviewBanner({ product }: { product: string }) {
  return (
    <div className="counsel-banner">
      <p>
        <strong>Pending legal review.</strong> This is working product copy for {product} so
        real people can use the app. It is not attorney-reviewed and is not legal advice.
        United Under God will have counsel review Terms and Privacy before we advertise this
        product to the public. Questions:{" "}
        <a href="mailto:lincoln@unitedundergod.org">lincoln@unitedundergod.org</a>.
      </p>
    </div>
  );
}

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div id="app">
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <span className="logo-icon">🌿</span>
            <span className="logo-text">Presence</span>
          </Link>
          <nav className="nav">
            <Link href="/terms" className="nav-btn">
              Terms
            </Link>
            <Link href="/privacy" className="nav-btn">
              Privacy
            </Link>
          </nav>
        </div>
      </header>
      <main className="legal">
        <p className="legal-kicker">United Under God</p>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        <CounselReviewBanner product="Presence" />
        {children}
      </main>
      <footer className="footer">
        <p>
          Presence ·{" "}
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}
