// POST { markdown, kind } -> { ok: true, structured: Partial<UserProfile> }
// Takes scraped markdown and asks GPT-4o-mini to extract profile-relevant fields.
// `kind` tunes the prompt for github / devpost / website / linkedin sources.

import { chatJSON } from "@/lib/openai";

export const runtime = "nodejs";

type ExtractKind = "github" | "devpost" | "website" | "linkedin";

const SYSTEM_PROMPTS: Record<ExtractKind, string> = {
  github: `You are extracting a developer profile from a scraped GitHub user page in markdown.
Return a JSON object with this exact shape (omit fields you cannot determine):
{
  "name": string,
  "headline": string,            // their bio one-liner
  "location": string,
  "skills": string[],            // languages and frameworks visible across pinned repos
  "github": {
    "username": string,
    "bio": string,
    "company": string,
    "publicRepos": number,
    "followers": number,
    "topRepos": [{ "name": string, "description": string, "language": string, "stars": number, "url": string }]
  }
}
Only include data you can see in the page. Skip empty fields rather than guessing.`,

  devpost: `You are extracting a builder profile from a scraped DevPost user page in markdown.
Return a JSON object with this exact shape (omit fields you cannot determine):
{
  "name": string,
  "headline": string,
  "location": string,
  "skills": string[],            // technologies tagged across their projects
  "experience": [{ "company": string, "title": string, "description": string, "startDate": string, "endDate": string }]
}
Convert hackathon projects into experience entries with company set to the hackathon name and title set to "Hackathon Project · <project name>".`,

  website: `You are extracting a profile from a scraped personal website in markdown.
Return a JSON object with this exact shape (omit fields you cannot determine):
{
  "name": string,
  "headline": string,
  "summary": string,             // longer bio paragraph if visible
  "location": string,
  "skills": string[],
  "experience": [{ "company": string, "title": string, "startDate": string, "endDate": string, "description": string }],
  "education": [{ "school": string, "degree": string, "field": string, "startDate": string, "endDate": string }]
}
Only return values that are clearly stated on the page.`,

  linkedin: `You are extracting a profile from scraped LinkedIn profile content.
Return a JSON object with this exact shape (omit fields you cannot determine):
{
  "name": string,
  "headline": string,
  "summary": string,
  "location": string,
  "skills": string[],
  "experience": [{ "company": string, "title": string, "startDate": string, "endDate": string, "description": string, "location": string }],
  "education": [{ "school": string, "degree": string, "field": string, "startDate": string, "endDate": string }]
}`,
};

export async function POST(req: Request) {
  let body: { markdown?: string; kind?: ExtractKind };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const { markdown, kind } = body;
  if (!markdown || !kind || !(kind in SYSTEM_PROMPTS)) {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, reason: "no_api_key" }, { status: 503 });
  }

  const trimmed = markdown.length > 16000 ? markdown.slice(0, 16000) : markdown;

  const result = await chatJSON(apiKey, [
    { role: "system", content: SYSTEM_PROMPTS[kind] },
    { role: "user", content: trimmed },
  ]);

  if (!result.ok) {
    return Response.json({ ok: false, reason: result.reason }, { status: 502 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result.raw);
  } catch {
    parsed = {};
  }
  return Response.json({ ok: true, structured: parsed });
}
