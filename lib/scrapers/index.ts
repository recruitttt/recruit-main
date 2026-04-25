// Client-side wrappers around the /api/* routes.
// Each one returns a discriminated `{ ok: true, ... } | { ok: false, reason }`
// so callers can branch on a network/quota failure without throwing.

import type { UserProfile } from "@/lib/profile";

type Ok<T> = { ok: true } & T;
type Err = { ok: false; reason: string };

export type ScrapeResult = Ok<{
  url: string;
  markdown: string;
  metadata?: { title?: string; description?: string; siteName?: string };
}> | Err;

// Uses OpenAI Responses API (web_search_preview) — no extra API key needed.
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    const res = await fetch("/api/scrape/openai-web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return (await res.json()) as ScrapeResult;
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

// Keep old alias for any callers that reference FirecrawlResult.
export type FirecrawlResult = ScrapeResult;

export type ExtractKind = "github" | "devpost" | "website" | "linkedin";

export type ExtractResult = Ok<{ structured: Partial<UserProfile> }> | Err;

export async function extractFromMarkdown(
  markdown: string,
  kind: ExtractKind
): Promise<ExtractResult> {
  try {
    const res = await fetch("/api/extract/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown, kind }),
    });
    return (await res.json()) as ExtractResult;
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export type ResumeResult =
  | Ok<{ rawText: string; structured: Partial<UserProfile> | null; filename?: string; reason?: string }>
  | Err;

export async function parseResume(file: File): Promise<ResumeResult> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/parse/resume", { method: "POST", body: form });
    return (await res.json()) as ResumeResult;
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export type LinkedInResult = Ok<{ structured: Partial<UserProfile> }> | Err;

export async function scrapeLinkedIn(url: string): Promise<LinkedInResult> {
  // Try Proxycurl first (structured, reliable).
  try {
    const res = await fetch("/api/scrape/linkedin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = (await res.json()) as LinkedInResult;
    // Fall through to OpenAI web only if Proxycurl key is absent.
    if (json.ok || (json as Err).reason !== "no_api_key") return json;
  } catch {
    // network error — fall through
  }

  // Fallback: try fetching the public LinkedIn page via OpenAI web_search.
  return scrapeAndExtract(url, "linkedin");
}

// Convenience: scrape + extract in one call.
export async function scrapeAndExtract(
  url: string,
  kind: ExtractKind
): Promise<ExtractResult> {
  const scraped = await scrapeUrl(url);
  if (!scraped.ok) {
    return { ok: false, reason: scraped.reason };
  }
  return extractFromMarkdown(scraped.markdown, kind);
}
