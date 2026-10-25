/**
 * Where a scan came from, from Vercel's edge geo headers. Town-level only:
 * no IP or precise location is kept, so a report can say "found in 12 towns"
 * without knowing who anyone is.
 */
export type Geo = { city: string | null; region: string | null; country: string | null };

function header(req: Request, name: string, max: number): string | null {
  const raw = req.headers.get(name);
  if (!raw) return null;
  try {
    const v = decodeURIComponent(raw).trim();
    return v ? v.slice(0, max) : null;
  } catch {
    return null;
  }
}

export function geoFrom(req: Request): Geo {
  return {
    city: header(req, "x-vercel-ip-city", 80),
    region: header(req, "x-vercel-ip-country-region", 40),
    country: header(req, "x-vercel-ip-country", 8),
  };
}

const BIBLEHUB_BOOK: Record<string, string> = { psalm: "psalms", "song of solomon": "songs", "song of songs": "songs" };

/** "Isaiah 41:10" or "Lamentations 3:22–23" -> the first verse on Bible Hub, so a paraphrase can be read in full. */
export function fullVerseUrl(ref: string | null): string | null {
  if (!ref) return null;
  const m = ref.trim().match(/^((?:[1-3]\s)?[A-Za-z][A-Za-z ]*?)\s+(\d+):(\d+)/);
  if (!m) return null;
  const book = m[1].toLowerCase();
  const slug = (BIBLEHUB_BOOK[book] || book).replace(/\s+/g, "_");
  return `https://biblehub.com/${slug}/${m[2]}-${m[3]}.htm`;
}
