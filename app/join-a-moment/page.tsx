import { FeaturePage } from "@/components/FeaturePage";
import { featureMetadata } from "@/lib/seo";

export const metadata = featureMetadata("join");

export default function JoinAMomentPage() {
  return (
    <FeaturePage
      id="join"
      kicker="Join a moment"
      heading="Find a small gathering near you and ask to join"
      lede="Real people hosting coffee, walks, meals and games, at real places and times. No feed to scroll, no score to keep. The table is the point."
      sections={[
        {
          heading: "Who it's for",
          body: (
            <p className="hero-sub" style={{ textAlign: "left" }}>
              Anyone who wants company without pressure — new in town, on the quiet side, or just
              tired of being alone. Presence started in Vidalia, Georgia, and anyone can host in
              their own town.
            </p>
          ),
        },
        {
          heading: "How it works",
          body: (
            <ol className="culture-list" style={{ listStyle: "decimal", paddingLeft: 20 }}>
              <li>Open Presence to see upcoming open moments, with the place, city, time and vibe.</li>
              <li>Sign in and filter by coffee, walk, meal, game or other.</li>
              <li>Ask to join. The host accepts or declines, and you can see where your request stands.</li>
              <li>Show up. Come as you are.</li>
            </ol>
          ),
        },
        {
          heading: "What we won't do",
          body: (
            <p className="hero-sub" style={{ textAlign: "left" }}>
              We don&apos;t invent guests or fake moments. If nothing is hosted near you yet, the
              page says so — and you can host the first one.
            </p>
          ),
        },
      ]}
      cta="See open moments"
    />
  );
}
