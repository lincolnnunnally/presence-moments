import Link from "next/link";
import { FEATURES, FEATURE_ORDER, type FeatureKey } from "@/lib/seo";

/** Plain links between the public "what Presence does" pages so people and crawlers find each one. */
export function FeatureLinks({ current }: { current?: FeatureKey }) {
  return (
    <nav aria-label="What Presence does" style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
      <p className="moment-meta" style={{ marginBottom: 8 }}>What Presence does</p>
      <ul style={{ listStyle: "none", display: "flex", flexWrap: "wrap", gap: "8px 18px", padding: 0, margin: 0 }}>
        {current ? (
          <li>
            <Link href="/">Start on Presence</Link>
          </li>
        ) : null}
        {FEATURE_ORDER.filter((k) => k !== current).map((k) => (
          <li key={k}>
            <Link href={FEATURES[k].path}>{FEATURES[k].name}</Link>
          </li>
        ))}
        <li>
          <Link href="/terms">Terms</Link>
        </li>
        <li>
          <Link href="/privacy">Privacy</Link>
        </li>
      </ul>
    </nav>
  );
}
