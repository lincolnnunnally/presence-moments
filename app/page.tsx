import HomeClient from "./HomeClient";
import { FeatureLinks } from "@/components/FeatureLinks";
import { JsonLd } from "@/components/JsonLd";
import { HOME, appJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/", HOME.title, HOME.description);

export default function HomePage() {
  return (
    <>
      <JsonLd data={appJsonLd} />
      <HomeClient />
      {/* Server-rendered so the page says what it is before the app loads. */}
      <footer style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 40px" }}>
        <p className="moment-meta">
          Presence is a small app for hosting and joining low-pressure local moments — coffee,
          walks, meals, game nights — with a culture of presence over performance and acceptance
          as the default.
        </p>
        <FeatureLinks />
      </footer>
    </>
  );
}
