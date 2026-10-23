import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Telemetry } from '../lib/TelemetryProvider';
import { ConnectNavLink } from './connect-nav-link';
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL, organizationJsonLd } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-playfair",
  display: "swap",
});

// Pages set their own title, description and canonical; this is the fallback.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US" },
  twitter: { card: "summary" },
  title: "Presence — Enjoy the presence of others",
  description: "Presence — Real people. Real places. Real connection.",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <JsonLd data={organizationJsonLd} />
        {children}
        <ConnectNavLink />
        <Telemetry app="presence" />
      </body>
    </html>
  );
}
