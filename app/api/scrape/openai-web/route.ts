// POST { url } -> { ok: true, markdown: string, url: string }
// Uses the OpenAI Responses API with web_search_preview to fetch public pages.
// No extra API key needed — reuses OPENAI_API_KEY.
// LinkedIn walls are not bypassed (still needs Proxycurl); everything else works.

export const runtime = "nodejs";
export const maxDuration = 30;

type ResponsesOutput = {
  type: string;
  role?: string;
  content?: Array<{ type: string; text?: string }>;
};

type ResponsesResponse = {
  output?: ResponsesOutput[];
  error?: { message?: string };
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, reason: "no_api_key" }, { status: 503 });
  }

  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: `Visit the following URL and return ALL visible text content from the page, preserving structure as markdown. Include everything: bio, description, projects, skills, work history, contact info. Do not summarize — return the full content.\n\nURL: ${normalized}`,
      }),
    });

    const json = (await res.json()) as ResponsesResponse;

    if (!res.ok || json.error) {
      return Response.json(
        { ok: false, reason: json.error?.message ?? `openai_${res.status}` },
        { status: 502 }
      );
    }

    const messageOutput = json.output?.findLast((o) => o.type === "message");
    const text = messageOutput?.content?.find((c) => c.type === "output_text")?.text;

    if (!text) {
      return Response.json({ ok: false, reason: "empty_response" }, { status: 502 });
    }

    return Response.json({ ok: true, markdown: text, url: normalized });
  } catch (err) {
    return Response.json(
      { ok: false, reason: (err as Error).message ?? "fetch_error" },
      { status: 502 }
    );
  }
}
