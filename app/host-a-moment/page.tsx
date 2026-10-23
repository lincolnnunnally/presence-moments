import { FeaturePage } from "@/components/FeaturePage";
import { featureMetadata } from "@/lib/seo";

export const metadata = featureMetadata("host");

export default function HostAMomentPage() {
  return (
    <FeaturePage
      id="host"
      kicker="Host a moment"
      heading="Host a small, low-pressure moment in your town"
      lede="Coffee, a walk, a meal, a game — a few people, a real place, a set time. You don't need to be impressive. You need a table and an open seat."
      sections={[
        {
          heading: "Who it's for",
          body: (
            <p className="hero-sub" style={{ textAlign: "left" }}>
              Anyone willing to open a seat for people who might otherwise be alone: neighbors,
              newcomers, people who hide after being hurt, introverts who like small tables.
            </p>
          ),
        },
        {
          heading: "How it works",
          body: (
            <ol className="culture-list" style={{ listStyle: "decimal", paddingLeft: 20 }}>
              <li>Sign in and tap Host a Moment.</li>
              <li>Pick coffee, walk, meal, game or other; add a date, time, place and city.</li>
              <li>Choose the vibe — quiet and accepting, encouraging, no agenda, introvert-friendly, open conversation, faith-friendly open — and how many can come.</li>
              <li>Agree to the shared commitment and publish.</li>
              <li>People ask to join; you accept or decline each request.</li>
            </ol>
          ),
        },
        {
          heading: "The commitment every host agrees to",
          body: (
            <ul className="culture-list">
              <li><strong>Presence over performance.</strong> No fixing, no ranking, no pressure to be impressive.</li>
              <li><strong>Acceptance is the default.</strong> Judgment, criticism, and toxicity have no place here.</li>
              <li><strong>Encouragement is welcome.</strong> Kind words and genuine interest are the culture.</li>
              <li><strong>Come as you are.</strong> Ordinary people looking for hope, connection, and the reminder that we are not alone.</li>
              <li><strong>Receive as well as give.</strong> If someone kind offers a seat, a meal, or a walk, one yes can be the next step.</li>
            </ul>
          ),
        },
      ]}
      cta="Sign in to host"
    />
  );
}
