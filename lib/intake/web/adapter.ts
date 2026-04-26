// Web IntakeAdapter — wraps `lib/scrapers/server.ts` (`scrapeWithFallback` →
// Firecrawl with OpenAI web_search fallback) and the LLM extractor that
// already powers `app/api/extract/profile/route.ts`.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.4.
//
// Stages emitted: `starting` → `scrape` → `llm-extract` → `complete`.
// Provenance: every top-level key of the resulting patch → the input `kind`
// (`devpost` | `website` | `linkedin` | `github`).

import { chatJSON } from "../../openai";
import type { UserProfile } from "../../profile";
import { scrapeWithFallback } from "../../scrapers/server";

import type {
  IntakeAdapter,
  IntakeContext,
  IntakeProgressEvent,
  ProvenanceSource,
} from "../shared/types";

export type WebIntakeKind = "devpost" | "website" | "linkedin" | "github";

export interface WebIntakeInput {
  url: string;
  kind: WebIntakeKind;
}

export const webAdapter: IntakeAdapter<WebIntakeInput> = {
  // The IntakeAdapter contract names the source `web`; the URL `kind` is used
  // for provenance and prompt selection but does NOT change the adapter name.
  name: "web",
  run: runWebAdapter,
};

const MAX_LLM_INPUT_CHARS = 16000;

const SYSTEM_PROMPTS: Record<WebIntakeKind, string> = {
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

async function* runWebAdapter(
  input: WebIntakeInput,
  ctx: IntakeContext
): AsyncGenerator<IntakeProgressEvent> {
  const { url, kind } = input;

  if (!url || typeof url !== "string") {
    yield { stage: "starting", level: "error", message: "Missing url" };
    throw new Error("missing_url");
  }

  yield {
    stage: "starting",
    message: `Scraping ${kind} page`,
    level: "info",
    data: { url, kind },
  };

  // ---------------------------------------------------------------------------
  // 1. Scrape the URL.
  // ---------------------------------------------------------------------------
  yield { stage: "scrape", message: `Fetching ${url}`, level: "info" };

  const scraped = await scrapeWithFallback(url);
  if (!scraped.ok) {
    yield {
      stage: "scrape",
      level: "error",
      message: `Scrape failed: ${scraped.reason}`,
    };
    throw new Error(`scrape_failed: ${scraped.reason}`);
  }
  if (scraped.markdown.trim().length === 0) {
    yield {
      stage: "scrape",
      level: "error",
      message: "Scrape returned empty markdown",
    };
    throw new Error("scrape_empty");
  }

  yield {
    stage: "scrape",
    message: `Scraped ${scraped.markdown.length} chars from ${kind}`,
    level: "info",
    data: { chars: scraped.markdown.length },
  };

  // ---------------------------------------------------------------------------
  // 2. LLM-structured extraction.
  // ---------------------------------------------------------------------------
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    yield {
      stage: "llm-extract",
      level: "warn",
      message: "OPENAI_API_KEY missing — skipping structured extract",
    };
    yield { stage: "complete", message: "Web intake finished (scrape only)", level: "info" };
    return;
  }

  yield { stage: "llm-extract", message: "Extracting profile fields", level: "info" };

  const trimmed =
    scraped.markdown.length > MAX_LLM_INPUT_CHARS
      ? scraped.markdown.slice(0, MAX_LLM_INPUT_CHARS)
      : scraped.markdown;

  const llm = await chatJSON(apiKey, [
    { role: "system", content: SYSTEM_PROMPTS[kind] },
    { role: "user", content: trimmed },
  ]);

  if (!llm.ok) {
    yield {
      stage: "llm-extract",
      level: "error",
      message: `LLM extract failed: ${llm.reason}`,
    };
    throw new Error(`llm_extract_failed: ${llm.reason}`);
  }

  let parsed: Partial<UserProfile>;
  try {
    parsed = JSON.parse(llm.raw) as Partial<UserProfile>;
  } catch {
    parsed = {};
  }

  // Always stamp the URL into `links` for the matching kind.
  parsed = withDiscoveredLink(parsed, kind, url);

  const sanitized = sanitizeProfilePatch(parsed);
  if (Object.keys(sanitized).length === 0) {
    yield {
      stage: "llm-extract",
      level: "warn",
      message: "LLM returned no usable fields",
    };
    yield { stage: "complete", message: "Web intake complete (no fields)", level: "info" };
    return;
  }

  yield {
    stage: "llm-extract",
    message: `Extracted ${Object.keys(sanitized).length} field${
      Object.keys(sanitized).length === 1 ? "" : "s"
    } from ${kind}`,
    level: "info",
    patch: sanitized,
    provenance: provenanceFor(sanitized, kind),
    data: { fields: Object.keys(sanitized), kind, url: scraped.url },
  };

  yield { stage: "complete", message: "Web intake complete", level: "info" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PROFILE_KEYS: ReadonlySet<keyof UserProfile> = new Set<keyof UserProfile>([
  "name",
  "email",
  "location",
  "headline",
  "summary",
  "links",
  "resume",
  "experience",
  "education",
  "skills",
  "github",
  "prefs",
  "suggestions",
  "provenance",
  "log",
  "updatedAt",
]);

// Map adapter kind -> ProvenanceSource. `website` and `devpost` map directly;
// `linkedin` and `github` deliberately fall back to those source labels.
function kindToSource(kind: WebIntakeKind): ProvenanceSource {
  switch (kind) {
    case "devpost":
      return "devpost";
    case "linkedin":
      return "linkedin";
    case "github":
      return "github";
    case "website":
    default:
      return "website";
  }
}

function provenanceFor(
  patch: Partial<UserProfile>,
  kind: WebIntakeKind
): Record<string, ProvenanceSource> {
  const source = kindToSource(kind);
  const out: Record<string, ProvenanceSource> = {};
  for (const key of Object.keys(patch)) {
    if (key === "provenance" || key === "log" || key === "updatedAt") continue;
    out[key] = source;
  }
  return out;
}

function sanitizeProfilePatch(raw: Partial<UserProfile>): Partial<UserProfile> {
  const result: Partial<UserProfile> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!VALID_PROFILE_KEYS.has(key as keyof UserProfile)) continue;
    if (key === "provenance" || key === "log" || key === "updatedAt") continue;
    if (!isMeaningful(value)) continue;
    (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

function isMeaningful(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

// Stamp the scraped URL into `profile.links[kind]` so downstream UI can
// surface the source even if the LLM didn't echo the URL back.
function withDiscoveredLink(
  patch: Partial<UserProfile>,
  kind: WebIntakeKind,
  url: string
): Partial<UserProfile> {
  const linkKey = kind === "website" ? "website" : kind;
  const existingLinks = patch.links ?? {};
  if ((existingLinks as Record<string, string>)[linkKey]) return patch;
  return {
    ...patch,
    links: {
      ...existingLinks,
      [linkKey]: url,
    },
  };
}
