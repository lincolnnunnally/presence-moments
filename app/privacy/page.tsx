import type { Metadata } from "next";
import { LegalShell } from "../legal-shell";

export const metadata: Metadata = {
  title: "Privacy — Presence",
  description: "Working privacy policy for Presence, pending attorney review.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 29, 2026">
      <p>
        Presence is operated by <strong>United Under God, Inc.</strong> This page explains
        what we collect and how we use it.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details you provide (name, email, password).</li>
        <li>
          Moments you host or join: activity, title, time, place, city, vibes, notes, and
          join requests.
        </li>
        <li>Technical data needed to run the service (session, basic device/browser info).</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To run Presence so people can find and share real time together.</li>
        <li>To keep accounts secure and recover passwords.</li>
        <li>To connect your identity with the Life Produces Life family of tools.</li>
      </ul>
      <h2>Sharing</h2>
      <p>
        Other signed-in people can see moments you host and, if you request to join, your
        name on that request. Exact location details are meant to stay with the host until
        they accept. We do not sell your personal information. We may use trusted
        infrastructure (hosting, database, email) solely to operate the product.
      </p>
      <h2>Your choices</h2>
      <p>
        To close an account or ask what we store, write{" "}
        <a href="mailto:lincoln@unitedundergod.org">lincoln@unitedundergod.org</a>.
      </p>
    </LegalShell>
  );
}
