import type { Metadata } from "next";

/**
 * What search engines see. Every line describes something Presence does today.
 * Never index: people's profiles, Connect matches, join requests, token pages (/t/*), admin.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://presence.unitedundergod.org").replace(/\/$/, "");
export const SITE_NAME = "Presence";

export type FeatureKey = "host" | "join" | "connect" | "found";

export type Feature = { key: FeatureKey; path: string; name: string; title: string; description: string };

export const FEATURES: Record<FeatureKey, Feature> = {
  host: {
    key: "host",
    path: "/host-a-moment",
    name: "Host a moment",
    title: "Host a small local meetup: coffee, a walk, a meal | Presence",
    description:
      "Host coffee, a walk, a meal or a game in a few taps. Pick a time and place, set how many can come, agree to the charter, and choose who joins you.",
  },
  join: {
    key: "join",
    path: "/join-a-moment",
    name: "Join a moment",
    title: "Find and join small local gatherings near you | Presence",
    description:
      "See open moments people nearby are hosting — coffee, walks, meals, games — and ask to join. The host accepts or declines. Come as you are.",
  },
  connect: {
    key: "connect",
    path: "/meet-one-person",
    name: "Meet one person this week",
    title: "Meet one new person nearby for coffee this week | Presence",
    description:
      "Turn Connect on for a week and see people nearby who share an interest. Invite one for coffee or a meal. They see your first name, never your location.",
  },
  found: {
    key: "found",
    path: "/found",
    name: "Found a coin?",
    title: "Found a You Are Awesome coin? What it means | Presence",
    description:
      "You Are Awesome tokens find people in town with a small invitation to look up, notice the good, and sit with others. Here is what to do if one found you.",
  },
};

export const FEATURE_ORDER: FeatureKey[] = ["host", "join", "connect", "found"];

export const HOME = {
  title: "Presence — host or join small local moments near you",
  description:
    "Host or join low-pressure local moments — coffee, walks, meals, game nights — with people who choose acceptance over judgment. Come as you are.",
};

export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

export function pageMetadata(path: string, title: string, description: string): Metadata {
  const url = absoluteUrl(path);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, url, title, description, locale: "en_US" },
    twitter: { card: "summary", title, description },
  };
}

export function featureMetadata(key: FeatureKey): Metadata {
  const f = FEATURES[key];
  return pageMetadata(f.path, f.title, f.description);
}

export const NOINDEX: Metadata = { robots: { index: false, follow: false } };

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  slogan: "Come as you are. Leave less alone.",
};

export const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${SITE_URL}/#app`,
  name: SITE_NAME,
  url: SITE_URL,
  description: HOME.description,
  applicationCategory: "SocialNetworkingApplication",
  operatingSystem: "Web browser",
  publisher: { "@id": `${SITE_URL}/#organization` },
  featureList: FEATURE_ORDER.map((k) => FEATURES[k].name),
};

export function featureJsonLd(key: FeatureKey) {
  const f = FEATURES[key];
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: f.name,
    description: f.description,
    url: absoluteUrl(f.path),
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}
