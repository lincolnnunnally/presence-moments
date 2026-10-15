import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ZIP -> approximate center (free, no key: api.zippopotam.us).
 * Rounded to 2 decimals (~1 km) so we never store an exact location.
 */
export async function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get("zip")?.trim() ?? "";
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "Enter a 5-digit ZIP." }, { status: 400 });
  }
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { cache: "force-cache" });
    if (!res.ok) return NextResponse.json({ error: "ZIP not found." }, { status: 404 });
    const d = await res.json();
    const p = d?.places?.[0];
    const lat = Number(p?.latitude);
    const lng = Number(p?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "ZIP not found." }, { status: 404 });
    }
    return NextResponse.json({
      zip,
      city: `${p["place name"]}, ${p["state abbreviation"]}`,
      lat: Math.round(lat * 100) / 100,
      lng: Math.round(lng * 100) / 100,
    });
  } catch {
    return NextResponse.json({ error: "Lookup failed. Try again." }, { status: 502 });
  }
}
