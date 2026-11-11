/**
 * Spark of Hope serves its own page for a coin (spark-of-hope.com/t/{code}),
 * and that page saves notes here so there is one filter, one rate limit and
 * one review queue. The browser calls this API directly, so the person's own
 * address is what the rate limit sees. Only Spark's sites may do that.
 */
const ALLOWED_ORIGINS = new Set([
  "https://spark-of-hope.com",
  "https://www.spark-of-hope.com",
  "https://spark.unitedundergod.org",
]);

/** Spark's own preview builds, and a developer's machine. */
function isSparkPreview(origin: string): boolean {
  return (
    /^https:\/\/spark-of-hope-[a-z0-9-]+-life-produces-life\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin)
  );
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  if (!origin || !(ALLOWED_ORIGINS.has(origin) || isSparkPreview(origin))) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** Answer to the browser's preflight question. */
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** Add the headers to a response already built. */
export function withCors<T extends Response>(req: Request, res: T): T {
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}
