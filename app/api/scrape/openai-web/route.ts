// POST { url } -> { ok: true, markdown: string, url: string }
// Uses the OpenAI Responses API with web_search_preview to fetch public pages.
// No extra API key needed (reuses OPENAI_API_KEY).
// LinkedIn walls are not bypassed (still needs Proxycurl); everything else works.
//
// Implementation lives in lib/scrapers/server.ts so other server code (the
// tailor pipeline) can call it directly without an HTTP hop.

import { scrapeOpenAIWeb } from "@/lib/scrapers/server";

export const runtime = "nodejs";
export const maxDuration = 30;

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

  const result = await scrapeOpenAIWeb(url, process.env.OPENAI_API_KEY);
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason }, { status: result.status });
  }

  return Response.json({ ok: true, markdown: result.markdown, url: result.url });
}
