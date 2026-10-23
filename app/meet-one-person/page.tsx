import { FeaturePage } from "@/components/FeaturePage";
import { featureMetadata } from "@/lib/seo";

export const metadata = featureMetadata("connect");

export default function MeetOnePersonPage() {
  return (
    <FeaturePage
      id="connect"
      kicker="Connect"
      heading="Meet one real person nearby this week"
      lede="Open to one real 1:1 this week? Turn Connect on. People nearby who are also on and share something with you will see your first name — never your location."
      sections={[
        {
          heading: "How it works",
          body: (
            <ol className="culture-list" style={{ listStyle: "decimal", paddingLeft: 20 }}>
              <li>Sign in to Presence and open Connect.</li>
              <li>Add your first name, a few interests and values, and your ZIP (used only for an approximate distance).</li>
              <li>Turn Connect on. It stays on for 7 days, then asks if you are still open.</li>
              <li>See people nearby who are on and share an interest or value with you.</li>
              <li>Invite one for coffee, a drink or a meal: pick a place and offer a few times. They choose one or pass.</li>
            </ol>
          ),
        },
        {
          heading: "What others see",
          body: (
            <p className="hero-sub" style={{ textAlign: "left" }}>
              Your first name, what you share with them, and an approximate distance. Never your
              address or exact location. Turn Connect off any time and you are invisible to matching.
            </p>
          ),
        },
      ]}
      cta="Sign in to Connect"
    />
  );
}
