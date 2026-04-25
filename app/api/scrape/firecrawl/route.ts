// POST { url } -> { ok: true, markdown, metadata } via Firecrawl /v1/scrape.
// Used for GitHub profile pages, personal websites, DevPost, blogs - any
// publicly fetchable URL we want as clean markdown for the LLM extractor.

export const runtime = "nodejs";

type FirecrawlResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      siteName?: string;
      language?: string;
      ogImage?: string;
    };
  };
  error?: string;
};

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

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, reason: "no_api_key" },
      { status: 503 }
    );
  }

  const target = normalizeUrl(url);

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: target,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 25000,
      }),
    });

    if (res.status === 402) {
      return Response.json({ ok: false, reason: "quota" }, { status: 402 });
    }

    const json = (await res.json()) as FirecrawlResponse;

    if (!res.ok || !json.success || !json.data?.markdown) {
      return Response.json(
        { ok: false, reason: json.error ?? "firecrawl_failed" },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      url: target,
      markdown: json.data.markdown,
      metadata: json.data.metadata ?? {},
    });
  } catch (err) {
    return Response.json(
      { ok: false, reason: (err as Error).message ?? "fetch_error" },
      { status: 502 }
    );
  }
}

function normalizeUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  return `https://${input}`;
}
