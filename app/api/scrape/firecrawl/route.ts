// POST { url } -> { ok: true, markdown, metadata } via Firecrawl /v1/scrape.
// Used for GitHub profile pages, personal websites, DevPost, blogs - any
// publicly fetchable URL we want as clean markdown for the LLM extractor.
//
// The actual scraping logic lives in lib/scrapers/server.ts so it can be
// called directly by other server code (the tailor pipeline) without an
// HTTP hop. This route is now a thin wrapper.

import { scrapeFirecrawl } from "@/lib/scrapers/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return Response.json({ ok: false, reason: "missing_url" }, { status: 400 });
  }

  const result = await scrapeFirecrawl(url, process.env.FIRECRAWL_API_KEY);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason }, { status: result.status });
  }

  return Response.json({
    ok: true,
    url: result.url,
    markdown: result.markdown,
    metadata: result.metadata ?? {},
  });
}
