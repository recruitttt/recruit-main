// POST { url } -> Proxycurl /v2/linkedin response, normalized to our profile shape.
// Direct scraping won't work for LinkedIn (login wall). Proxycurl uses
// authenticated infrastructure to return the structured profile JSON.

export const runtime = "nodejs";

type ProxycurlExperience = {
  company?: string;
  title?: string;
  description?: string;
  location?: string;
  starts_at?: { year?: number; month?: number };
  ends_at?: { year?: number; month?: number } | null;
};

type ProxycurlEducation = {
  school?: string;
  degree_name?: string;
  field_of_study?: string;
  starts_at?: { year?: number; month?: number };
  ends_at?: { year?: number; month?: number } | null;
};

type ProxycurlResponse = {
  full_name?: string;
  headline?: string;
  summary?: string;
  occupation?: string;
  city?: string;
  country?: string;
  experiences?: ProxycurlExperience[];
  education?: ProxycurlEducation[];
  skills?: string[];
};

function fmtDate(d?: { year?: number; month?: number } | null): string | undefined {
  if (!d?.year) return undefined;
  return d.month ? `${d.year}-${String(d.month).padStart(2, "0")}` : String(d.year);
}

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

  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, reason: "no_api_key" }, { status: 503 });
  }

  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const endpoint = new URL("https://nubela.co/proxycurl/api/v2/linkedin");
  endpoint.searchParams.set("url", target);
  endpoint.searchParams.set("use_cache", "if-present");

  try {
    const res = await fetch(endpoint.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 401 || res.status === 403) {
      return Response.json({ ok: false, reason: "auth" }, { status: 401 });
    }
    if (res.status === 402 || res.status === 429) {
      return Response.json({ ok: false, reason: "quota_exceeded" }, { status: 402 });
    }
    if (!res.ok) {
      return Response.json(
        { ok: false, reason: `proxycurl_${res.status}` },
        { status: 502 }
      );
    }

    const json = (await res.json()) as ProxycurlResponse;

    const structured = {
      name: json.full_name,
      headline: json.headline ?? json.occupation,
      summary: json.summary,
      location: [json.city, json.country].filter(Boolean).join(", ") || undefined,
      skills: json.skills ?? [],
      experience: (json.experiences ?? []).map((e) => ({
        company: e.company ?? "",
        title: e.title ?? "",
        description: e.description ?? undefined,
        location: e.location ?? undefined,
        startDate: fmtDate(e.starts_at),
        endDate: e.ends_at ? fmtDate(e.ends_at) : "Present",
      })).filter((e) => e.company || e.title),
      education: (json.education ?? []).map((e) => ({
        school: e.school ?? "",
        degree: e.degree_name ?? undefined,
        field: e.field_of_study ?? undefined,
        startDate: fmtDate(e.starts_at),
        endDate: fmtDate(e.ends_at),
      })).filter((e) => e.school),
    };

    return Response.json({ ok: true, structured });
  } catch (err) {
    return Response.json(
      { ok: false, reason: (err as Error).message ?? "fetch_error" },
      { status: 502 }
    );
  }
}
