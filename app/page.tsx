import HomeClient from "./HomeClient";
import { FeatureLinks } from "@/components/FeatureLinks";
import { HomeIntro } from "@/components/HomeIntro";
import { JsonLd } from "@/components/JsonLd";
import { HOME, appJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/", HOME.title, HOME.description);

export default function HomePage() {
  return (
    <>
      <JsonLd data={appJsonLd} />
      <HomeClient intro={<HomeIntro />} />
      {/* Server-rendered so the page says what it is before the app loads. */}
      <footer style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 40px" }}>
        <section className="culture-card">
          <h2>Want company, without the pressure?</h2>
          <p className="hero-sub" style={{ textAlign: "left", maxWidth: "none" }}>
            Maybe you&apos;re new in town, on the quiet side, or just tired of doing everything
            alone. Presence is a small app for hosting and joining low-pressure local moments with
            real people nearby: a few people, a real place, a set time. No feed to scroll, no score
            to keep, nothing to perform. Presence started in Vidalia, Georgia, and anyone can host
            in their own town.
          </p>
        </section>
        <section className="culture-card">
          <h2>How it works</h2>
          <p className="hero-sub" style={{ textAlign: "left", maxWidth: "none" }}>
            <strong>Host a moment.</strong> Sign in and tap Host a Moment. Pick coffee, a walk, a
            meal, a game or something else, then add a date, time, place and city. Choose the vibe
            and how many people can come, agree to the shared commitment, and publish. When people
            ask to join, you accept or decline each request.
          </p>
          <p className="hero-sub" style={{ textAlign: "left", maxWidth: "none", marginTop: 12 }}>
            <strong>Join a moment.</strong> See upcoming open moments with the place, city, time and
            vibe. Filter by coffee, walk, meal, game or other, and ask to join. The host accepts or
            declines, and you can see where your request stands. Then show up and come as you are.
          </p>
        </section>
        <section className="culture-card">
          <h2>Moments you can host or join</h2>
          <ul className="culture-list">
            <li>☕ <strong>Coffee</strong> with a neighbor or two.</li>
            <li>🚶 <strong>A walk</strong> and an easy conversation.</li>
            <li>🍽️ <strong>A meal</strong> around a shared table.</li>
            <li>🎲 <strong>A game night</strong> for people who like small tables.</li>
            <li>✨ <strong>Something else</strong> you&apos;d enjoy with a few people.</li>
          </ul>
          <p className="hero-sub" style={{ textAlign: "left", maxWidth: "none", marginTop: 12 }}>
            Hosts set the vibe — quiet and accepting, encouraging, no agenda, introvert-friendly,
            open conversation, or faith-friendly open — and how many can come, so a moment can stay
            small.
          </p>
        </section>
        <section className="culture-card">
          <h2>What every host agrees to</h2>
          <p className="hero-sub" style={{ textAlign: "left", maxWidth: "none" }}>
            Presence over performance. Acceptance is the default; judgment, criticism and toxicity
            have no place here. Encouragement is welcome. Come as you are. We don&apos;t invent
            guests or fake moments: if nothing is hosted near you yet, the page says so, and you can
            host the first one.
          </p>
        </section>
        <section className="culture-card">
          <h2>Rather meet one person this week?</h2>
          <p className="hero-sub" style={{ textAlign: "left", maxWidth: "none" }}>
            Turn Connect on for a week and see people nearby who share an interest. Invite one for
            coffee or a meal. They see your first name, never your location.
          </p>
        </section>
        <p style={{ marginTop: 24, textAlign: "center" }}>
          <a className="btn primary" href="#app">
            Host or join a moment
          </a>
        </p>
        <FeatureLinks />
      </footer>
    </>
  );
}
