// Pure server-side scraping helpers, callable directly from route handlers
// without making an HTTP hop back to ourselves. The /api/scrape/* routes
// are now thin wrappers around these functions.

import { resolveOpenAiAuth, withOpenAiModelPrefix } from "@/lib/llm-routing";

export type ScrapeResult =
  | { ok: true; markdown: string; metadata?: Record<string, string | undefined>; url: string }
  | { ok: false; reason: string; status: number };

function normalizeUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  return `https://${input}`;
}

export async function scrapeFirecrawl(
  rawUrl: string,
  apiKey: string | undefined,
  signal?: AbortSignal
): Promise<ScrapeResult> {
  if (!apiKey) {
    return { ok: false, reason: "no_api_key", status: 503 };
  }
  const url = normalizeUrl(rawUrl);

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 25000,
      }),
    });

    if (res.status === 402) {
      return { ok: false, reason: "quota", status: 402 };
    }

    const json = (await res.json()) as {
      success?: boolean;
      data?: {
        markdown?: string;
        metadata?: Record<string, string | undefined>;
      };
      error?: string;
    };

    if (!res.ok || !json.success || !json.data?.markdown) {
      return {
        ok: false,
        reason: json.error ?? "firecrawl_failed",
        status: 502,
      };
    }

    return {
      ok: true,
      url,
      markdown: json.data.markdown,
      metadata: json.data.metadata,
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? "fetch_error", status: 502 };
  }
}

export async function scrapeOpenAIWeb(
  rawUrl: string,
  apiKey: string | undefined,
  signal?: AbortSignal
): Promise<ScrapeResult> {
  if (!apiKey) {
    return { ok: false, reason: "no_api_key", status: 503 };
  }
  const url = normalizeUrl(rawUrl);

  try {
    const auth = resolveOpenAiAuth(apiKey);
    const res = await fetch(`${auth.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: withOpenAiModelPrefix("gpt-5.4-mini", auth),
        tools: [{ type: "web_search_preview" }],
        input: `Visit the following URL and return ALL visible text content from the page, preserving structure as markdown. Include everything: bio, description, projects, skills, work history, contact info. Do not summarize. Return the full content.\n\nURL: ${url}`,
      }),
    });

    const json = (await res.json()) as {
      output?: Array<{
        type: string;
        content?: Array<{ type: string; text?: string }>;
      }>;
      error?: { message?: string };
    };

    if (!res.ok || json.error) {
      return {
        ok: false,
        reason: json.error?.message ?? `openai_${res.status}`,
        status: 502,
      };
    }

    const messageOutput = json.output?.findLast((o) => o.type === "message");
    const text = messageOutput?.content?.find((c) => c.type === "output_text")?.text;

    if (!text) {
      return { ok: false, reason: "empty_response", status: 502 };
    }

    return { ok: true, markdown: text, url };
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? "fetch_error", status: 502 };
  }
}

export async function scrapeWithFallback(
  url: string,
  signal?: AbortSignal
): Promise<ScrapeResult> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const firecrawl = await scrapeFirecrawl(url, firecrawlKey, signal);
  if (firecrawl.ok && firecrawl.markdown.length >= 200) return firecrawl;

  return scrapeOpenAIWeb(url, openaiKey, signal);
}
