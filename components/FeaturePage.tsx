import Link from "next/link";
import { FeatureLinks } from "@/components/FeatureLinks";
import { JsonLd } from "@/components/JsonLd";
import { featureJsonLd, type FeatureKey } from "@/lib/seo";

type Section = { heading: string; body: React.ReactNode };

/** Shared shell for the public explainer pages. Server-rendered so the words are in the HTML. */
export function FeaturePage({
  id,
  kicker,
  heading,
  lede,
  sections,
  cta,
}: {
  id: FeatureKey;
  kicker: string;
  heading: string;
  lede: string;
  sections: Section[];
  cta: string;
}) {
  return (
    <div id="app">
      <JsonLd data={featureJsonLd(id)} />
      <header className="header">
        <div className="header-inner">
          <Link className="logo" href="/">
            <span className="logo-icon" aria-hidden="true">🌿</span>
            <span className="logo-text">Presence</span>
          </Link>
        </div>
      </header>
      <main className="view">
        <p className="token-kicker">{kicker}</p>
        <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>{heading}</h1>
        <p className="hero-sub" style={{ marginBottom: 20 }}>{lede}</p>
        {sections.map((s) => (
          <section key={s.heading} className="culture-card">
            <h2>{s.heading}</h2>
            {s.body}
          </section>
        ))}
        <p style={{ marginTop: 24 }}>
          <Link className="btn primary" href="/">
            {cta}
          </Link>
        </p>
        <FeatureLinks current={id} />
      </main>
    </div>
  );
}
