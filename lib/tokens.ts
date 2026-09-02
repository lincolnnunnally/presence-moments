/** You Are Awesome tokens — public Presence door. Laser owns production/ops. */

export const PRESENCE_PUBLIC_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://presence.unitedundergod.org"
).replace(/\/$/, "");

export type WaveKind = "notice" | "place" | "table";
export type WaveStatus = "draft" | "engraving" | "planted" | "live" | "closed";

export type PublicWave = {
  code: string;
  kind: WaveKind;
  status: WaveStatus;
  title: string | null;
  front_text: string;
  back_text: string | null;
  web_message: string;
  invite_at: string | null;
  invite_notes: string | null;
  community_name: string;
  place_name: string | null;
  place_address: string | null;
  place_city: string | null;
  notice_prompt: string | null;
  best_time: string | null;
  found_count: number;
  experience_count: number;
  going_count: number;
  closed: boolean;
};

export type Handoff = {
  id: string;
  name: string;
  when: string;
  href: string;
};

/** Next layer after the coin — not a feed. Aligned Souls stays off day-1. */
export const TOKEN_HANDOFFS: Handoff[] = [
  {
    id: "presence",
    name: "Sit with people",
    when: "Host or join a small local moment — coffee, a walk, a meal.",
    href: "/",
  },
  {
    id: "spark",
    name: "Spark of Hope",
    when: "You need encouragement before you can move.",
    href: "https://spark-of-hope.com/",
  },
  {
    id: "kindred",
    name: "Kindred Connections",
    when: "You want friendship with people who will build you up.",
    href: "https://kindred.unitedundergod.org/",
  },
  {
    id: "neighborly",
    name: "Neighborly",
    when: "You want to belong in this town, not only on a screen.",
    href: "https://neighborly.unitedundergod.org/",
  },
  {
    id: "church",
    name: "Find a church",
    when: "You want a church family that would be glad you walked in.",
    href: "https://churchconnect.cloud/",
  },
  {
    id: "lom",
    name: "Live On Mission",
    when: "The next step is a small act of service.",
    href: "https://liveonmission.unitedundergod.org/",
  },
];

export function wavePublicUrl(code: string): string {
  return `${PRESENCE_PUBLIC_URL}/t/${encodeURIComponent(code)}`;
}

export function formatInvite(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
