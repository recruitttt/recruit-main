// Duplicate-reviewer sub-agent for the LinkedIn intake.
//
// Runs after the deterministic dedupe in `experience-dedupe.ts` and reviews
// the LinkedIn-shaped patch one last time. The model is given the merged
// `experience[]`, `education[]`, and `skills[]` and asked to return a
// canonical, single-entry-per-thing version. Duplicates that survived the
// keyed dedupe (e.g. "Acme Inc." vs "Acme Corp" for the same role, or
// "JS" vs "JavaScript" for the same skill) are collapsed here.
//
// Powered by GPT-5.4 Mini (configurable via `LINKEDIN_DEDUPE_REVIEW_MODEL`).
//
// Failure modes are non-fatal: if the OpenAI key is missing, the model
// times out, or the response is malformed, the original (already
// deterministic-deduped) patch is returned unchanged. We never make the
// intake pipeline fail because the reviewer was unavailable.

import { chatJSON } from "@/lib/openai";
import type { UserProfile, WorkExperience, Education } from "@/lib/profile";

const DEFAULT_REVIEW_MODEL = "gpt-5.4-mini";
const REVIEW_TIMEOUT_MS = 12_000;

const REVIEW_SYSTEM_PROMPT = `You are an exacting profile-data reviewer.
You receive arrays scraped from a LinkedIn profile that may contain duplicate entries describing the same item with cosmetic differences.
Your only job is to return EXACTLY ONE entry per real-world item, preserving the most informative version of each.

Apply these rules:
1. Two experience entries describe the same role if the company AND title refer to the same job (ignore "Inc.", "LLC", capitalization, "&" vs "and", "Sr." vs "Senior"). Same role at different time periods stays separate.
2. Two education entries describe the same school if the institution refers to the same school AND the degree refers to the same program. "MIT" and "Massachusetts Institute of Technology" are the same.
3. Two skills are the same if they refer to the same competency ("JS" / "JavaScript", "ML" / "Machine Learning", "k8s" / "Kubernetes").
4. When merging duplicates, KEEP the longer/more specific description, the earliest non-empty startDate, and the latest non-empty endDate.
5. NEVER invent fields. NEVER change names, companies, or schools beyond picking which existing variant to keep.
6. If an entry is clearly junk ("People also viewed", "Connect", a single non-professional word), drop it.

Return STRICT JSON of this shape (omit a key entirely if you would not change it):
{
  "experience": [{ "company": string, "title": string, "startDate"?: string, "endDate"?: string, "description"?: string, "location"?: string }],
  "education":  [{ "school": string, "degree"?: string, "field"?: string, "startDate"?: string, "endDate"?: string }],
  "skills":     [string]
}`;

export interface DuplicateReviewInput {
  experience?: WorkExperience[];
  education?: Education[];
  skills?: string[];
}

export interface DuplicateReviewResult {
  /** The cleaned patch — the same shape as the input, with duplicates removed. */
  patch: DuplicateReviewInput;
  /** Per-field count of entries removed by the reviewer (for logging / events). */
  removed: { experience: number; education: number; skills: number };
  /** Why the reviewer ran or skipped. Useful for the SSE log. */
  status:
    | { ok: true; model: string }
    | { ok: false; reason: string };
}

export interface DuplicateReviewOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Send the LinkedIn-shaped patch to GPT-5.4 Mini and return a deduped version.
 * Always returns something usable — falls back to the input on any failure.
 */
export async function reviewLinkedInDuplicates(
  input: DuplicateReviewInput,
  opts: DuplicateReviewOptions = {},
): Promise<DuplicateReviewResult> {
  const fallback: DuplicateReviewResult = {
    patch: cloneInput(input),
    removed: { experience: 0, education: 0, skills: 0 },
    status: { ok: false, reason: "fallback" },
  };

  if (!hasReviewableContent(input)) {
    return { ...fallback, status: { ok: false, reason: "empty" } };
  }

  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ...fallback, status: { ok: false, reason: "no_api_key" } };
  }

  const model =
    opts.model ?? process.env.LINKEDIN_DEDUPE_REVIEW_MODEL ?? DEFAULT_REVIEW_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? REVIEW_TIMEOUT_MS);

  let raw: string;
  try {
    const llm = await chatJSON(
      apiKey,
      [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
      { model, signal: controller.signal },
    );
    if (!llm.ok) {
      return { ...fallback, status: { ok: false, reason: llm.reason } };
    }
    raw = llm.raw;
  } catch (err) {
    return {
      ...fallback,
      status: { ok: false, reason: (err as Error).message ?? "request_failed" },
    };
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...fallback, status: { ok: false, reason: "invalid_json" } };
  }

  const cleaned = sanitizeReview(parsed, input);
  return {
    patch: cleaned.patch,
    removed: cleaned.removed,
    status: { ok: true, model },
  };
}

/**
 * Apply a `DuplicateReviewInput` patch back onto a `Partial<UserProfile>`,
 * touching only the fields the reviewer is allowed to rewrite.
 */
export function applyReviewedFields(
  patch: Partial<UserProfile>,
  reviewed: DuplicateReviewInput,
): Partial<UserProfile> {
  const next: Partial<UserProfile> = { ...patch };
  if (reviewed.experience !== undefined) next.experience = reviewed.experience;
  if (reviewed.education !== undefined) next.education = reviewed.education;
  if (reviewed.skills !== undefined) next.skills = reviewed.skills;
  return next;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasReviewableContent(input: DuplicateReviewInput): boolean {
  return (
    (input.experience?.length ?? 0) > 0 ||
    (input.education?.length ?? 0) > 0 ||
    (input.skills?.length ?? 0) > 0
  );
}

function cloneInput(input: DuplicateReviewInput): DuplicateReviewInput {
  return {
    ...(input.experience !== undefined ? { experience: [...input.experience] } : {}),
    ...(input.education !== undefined ? { education: [...input.education] } : {}),
    ...(input.skills !== undefined ? { skills: [...input.skills] } : {}),
  };
}

function sanitizeReview(
  parsed: unknown,
  original: DuplicateReviewInput,
): { patch: DuplicateReviewInput; removed: DuplicateReviewResult["removed"] } {
  const obj = isRecord(parsed) ? parsed : {};
  const patch: DuplicateReviewInput = {};

  if (Array.isArray(obj.experience) && original.experience) {
    patch.experience = obj.experience
      .map((entry) => coerceExperience(entry, original.experience!))
      .filter((e): e is WorkExperience => e !== null);
  } else if (original.experience !== undefined) {
    patch.experience = [...original.experience];
  }

  if (Array.isArray(obj.education) && original.education) {
    patch.education = obj.education
      .map((entry) => coerceEducation(entry, original.education!))
      .filter((e): e is Education => e !== null);
  } else if (original.education !== undefined) {
    patch.education = [...original.education];
  }

  if (Array.isArray(obj.skills) && original.skills) {
    const allowed = new Set(original.skills.map((s) => s.toLowerCase().trim()));
    const seen = new Set<string>();
    patch.skills = obj.skills
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => {
        if (!s) return false;
        const key = s.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        // Reviewer may rename a skill ("JS" → "JavaScript"). Keep its result
        // even if not in the original set — but if it hallucinates a totally
        // unrelated skill, reject it.
        return allowed.has(key) || isLikelyKnownSkill(s, original.skills!);
      });
  } else if (original.skills !== undefined) {
    patch.skills = [...original.skills];
  }

  return {
    patch,
    removed: {
      experience: countRemoved(original.experience, patch.experience),
      education: countRemoved(original.education, patch.education),
      skills: countRemoved(original.skills, patch.skills),
    },
  };
}

function coerceExperience(
  entry: unknown,
  originals: ReadonlyArray<WorkExperience>,
): WorkExperience | null {
  if (!isRecord(entry)) return null;
  const company = stringField(entry.company);
  const title = stringField(entry.title);
  if (!company && !title) return null;
  // Reviewer may rewrite slightly — anchor to an original entry by company+title
  // (case-insensitive substring) so we never accept a hallucinated role.
  const anchored = originals.find((o) => sharesRole(o, company ?? "", title ?? ""));
  if (!anchored) return null;
  return {
    company: company || anchored.company,
    title: title || anchored.title,
    startDate: stringField(entry.startDate) || anchored.startDate,
    endDate: stringField(entry.endDate) || anchored.endDate,
    description: stringField(entry.description) || anchored.description,
    location: stringField(entry.location) || anchored.location,
  };
}

function coerceEducation(
  entry: unknown,
  originals: ReadonlyArray<Education>,
): Education | null {
  if (!isRecord(entry)) return null;
  const school = stringField(entry.school);
  if (!school) return null;
  const anchored = originals.find((o) => sharesSchool(o, school));
  if (!anchored) return null;
  return {
    school: school || anchored.school,
    degree: stringField(entry.degree) || anchored.degree,
    field: stringField(entry.field) || anchored.field,
    startDate: stringField(entry.startDate) || anchored.startDate,
    endDate: stringField(entry.endDate) || anchored.endDate,
  };
}

function sharesRole(
  candidate: WorkExperience,
  company: string,
  title: string,
): boolean {
  const cc = candidate.company.toLowerCase();
  const ct = candidate.title.toLowerCase();
  const c = company.toLowerCase();
  const t = title.toLowerCase();
  const companyMatch = !company || cc.includes(c) || c.includes(cc);
  const titleMatch = !title || ct.includes(t) || t.includes(ct);
  return companyMatch && titleMatch;
}

function sharesSchool(candidate: Education, school: string): boolean {
  const cs = candidate.school.toLowerCase();
  const s = school.toLowerCase();
  return cs.includes(s) || s.includes(cs);
}

function isLikelyKnownSkill(skill: string, originals: ReadonlyArray<string>): boolean {
  const s = skill.toLowerCase();
  return originals.some((o) => {
    const lo = o.toLowerCase();
    return lo.includes(s) || s.includes(lo);
  });
}

function countRemoved<T>(
  before: ReadonlyArray<T> | undefined,
  after: ReadonlyArray<T> | undefined,
): number {
  const b = before?.length ?? 0;
  const a = after?.length ?? 0;
  return Math.max(0, b - a);
}

function stringField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
