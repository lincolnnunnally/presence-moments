import type { Metadata } from "next";
import { LegalShell } from "../legal-shell";

export const metadata: Metadata = {
  title: "Terms — Presence",
  description: "Working terms for Presence, pending attorney review.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 29, 2026">
      <p>
        Presence is a simple gathering tool operated by{" "}
        <strong>United Under God, Inc.</strong>, a Georgia corporation. By creating an
        account or hosting or joining a moment, you agree to these terms.
      </p>
      <h2>1. Purpose</h2>
      <p>
        Presence helps people share real, low-pressure time together — coffee, walks,
        meals, games — in real places. It is a tool for belonging, not a substitute for
        therapy, medical care, spiritual direction, or crisis support.
      </p>
      <h2>2. Your responsibilities</h2>
      <ul>
        <li>You are at least 18 years old.</li>
        <li>You host and join as yourself. Do not invent people or moments.</li>
        <li>
          Hosts agree to the Presence commitments: presence over performance, acceptance as
          the default, no judgment or toxicity.
        </li>
        <li>
          Meeting in person is optional and at your own risk. Prefer public places. Share
          exact location details only after you choose to.
        </li>
        <li>Do not harass, scam, or endanger anyone.</li>
      </ul>
      <h2>3. Safety and crisis</h2>
      <p>
        Presence is not emergency services. If someone is in immediate danger, call local
        authorities first.
      </p>
      <ul>
        <li>
          <strong>988 Suicide &amp; Crisis Lifeline</strong> — call or text 988 in the U.S.
        </li>
        <li>
          <strong>Crisis Text Line</strong> — text HOME to 741741
        </li>
      </ul>
      <h2>4. Accounts</h2>
      <p>
        Keep your login secure. Presence uses the shared Life Produces Life identity. A
        password reset here uses the ecosystem reset service and does not change a
        Neighborly-only email/password account. We may suspend accounts that abuse the
        space or post fabricated content as real.
      </p>
      <h2>5. First market</h2>
      <p>
        Vidalia, Georgia is the first live community. Empty is empty until a real person
        hosts.
      </p>
      <h2>6. Contact</h2>
      <p>
        <a href="mailto:lincoln@unitedundergod.org">lincoln@unitedundergod.org</a>
      </p>
    </LegalShell>
  );
}
