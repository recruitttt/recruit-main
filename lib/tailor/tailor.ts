// The tailor agent. Takes a UserProfile + JobResearch, produces a
// TailoredResume via gpt-4o-mini in JSON mode. Anti-fabrication validator
// rejects any employer in the output that isn't in the input profile.
// One retry with a temperature-0 nudge on failure.

import { chatJSON, extractJSONBlock } from "@/lib/openai";
import type { UserProfile } from "@/lib/profile";
import { TAILOR_SYSTEM_PROMPT, tailorUserPrompt } from "./prompt";
import type { JobResearch, TailoredResume } from "./types";

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function validateEmployers(
  resume: TailoredResume,
  profile: UserProfile
): { ok: true } | { ok: false; bogus: string[] } {
  if (!Array.isArray(resume.experience)) return { ok: true };
  const known = new Set(profile.experience.map((e) => normalizeName(e.company)));
  const bogus: string[] = [];
  for (const role of resume.experience) {
    const n = normalizeName(role.company ?? "");
    if (!n) continue;
    let matched = false;
    for (const k of known) {
      if (k.includes(n) || n.includes(k)) {
        matched = true;
        break;
      }
    }
    if (!matched) bogus.push(role.company);
  }
  return bogus.length === 0 ? { ok: true } : { ok: false, bogus };
}

function normalizeResume(raw: unknown, profile: UserProfile): TailoredResume {
  const r = (raw ?? {}) as Partial<TailoredResume>;
  return {
    name: typeof r.name === "string" && r.name.trim() ? r.name : profile.name ?? "",
    email: typeof r.email === "string" && r.email.trim() ? r.email : profile.email ?? "",
    location: typeof r.location === "string" ? r.location : profile.location,
    links: {
      github: r.links?.github ?? profile.links.github,
      linkedin: r.links?.linkedin ?? profile.links.linkedin,
      website: r.links?.website ?? profile.links.website,
    },
    headline: typeof r.headline === "string" ? r.headline : profile.headline ?? "",
    summary: typeof r.summary === "string" ? r.summary : profile.summary ?? "",
    skills: asStringArray(r.skills).slice(0, 12),
    experience: Array.isArray(r.experience)
      ? r.experience.map((e) => ({
          company: typeof e?.company === "string" ? e.company : "",
          title: typeof e?.title === "string" ? e.title : "",
          location: typeof e?.location === "string" ? e.location : undefined,
          startDate: typeof e?.startDate === "string" ? e.startDate : undefined,
          endDate: typeof e?.endDate === "string" ? e.endDate : undefined,
          bullets: asStringArray(e?.bullets),
        }))
      : [],
    education: Array.isArray(r.education)
      ? r.education.map((e) => ({
          school: typeof e?.school === "string" ? e.school : "",
          degree: typeof e?.degree === "string" ? e.degree : undefined,
          field: typeof e?.field === "string" ? e.field : undefined,
          endDate: typeof e?.endDate === "string" ? e.endDate : undefined,
        }))
      : [],
    coverLetterBlurb:
      typeof r.coverLetterBlurb === "string" && r.coverLetterBlurb.trim()
        ? r.coverLetterBlurb
        : undefined,
    tailoringNotes: {
      matchedKeywords: asStringArray(r.tailoringNotes?.matchedKeywords),
      emphasizedExperience: asStringArray(r.tailoringNotes?.emphasizedExperience),
      gaps: asStringArray(r.tailoringNotes?.gaps),
      confidence: clamp(Number(r.tailoringNotes?.confidence ?? 0), 0, 100),
    },
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

export async function tailorResume(
  profile: UserProfile,
  research: JobResearch,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ ok: true; resume: TailoredResume } | { ok: false; reason: string }> {
  const model = process.env.TAILOR_MODEL ?? "gpt-4o-mini";
  const baseMessages = [
    { role: "system" as const, content: TAILOR_SYSTEM_PROMPT },
    { role: "user" as const, content: tailorUserPrompt(profile, research) },
  ];

  const first = await chatJSON(apiKey, baseMessages, { model, temperature: 0.3, signal });
  if (!first.ok) return { ok: false, reason: `tailor_call_failed: ${first.reason}` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSONBlock(first.raw));
  } catch {
    parsed = null;
  }

  let resume = normalizeResume(parsed ?? {}, profile);
  let validation = validateEmployers(resume, profile);

  if (validation.ok && resume.experience.length > 0) {
    return { ok: true, resume };
  }

  // Retry once: tell the model what it did wrong, ask for valid JSON,
  // pin temperature at 0.
  const retryNudge = !validation.ok
    ? `Your previous output included employers that are NOT in the candidate's profile: ${validation.bogus.join(
        ", "
      )}. Use only the candidate's listed employers. Re-output the full JSON.`
    : `Your previous output was missing the experience array or returned invalid JSON. Re-output the full JSON, conforming exactly to the schema.`;

  const retry = await chatJSON(
    apiKey,
    [...baseMessages, { role: "user", content: retryNudge }],
    { model, temperature: 0, signal }
  );
  if (!retry.ok) return { ok: false, reason: `tailor_retry_failed: ${retry.reason}` };

  try {
    parsed = JSON.parse(extractJSONBlock(retry.raw));
  } catch {
    return { ok: false, reason: "tailor_parse_failed" };
  }
  resume = normalizeResume(parsed ?? {}, profile);
  validation = validateEmployers(resume, profile);

  if (!validation.ok) {
    return {
      ok: false,
      reason: `tailor_fabrication_detected: ${validation.bogus.join(", ")}`,
    };
  }

  if (resume.experience.length === 0 && profile.experience.length > 0) {
    return { ok: false, reason: "tailor_empty_experience" };
  }

  return { ok: true, resume };
}
