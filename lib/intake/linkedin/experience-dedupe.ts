// Dedupe helpers for LinkedIn snapshot fields.
//
// LinkedIn returns the same job/school/skill multiple times for a few reasons:
//   - the experience card is rendered both in the inline preview and the
//     "see all" subpage, and the parser visits both
//   - the same role re-appears under "promotions" with slightly different
//     dates ("Jan 2024" vs "Jan. 2024")
//   - LinkedIn's "Skills" graph repeats endorsements as separate entries
//
// Every dedupe step here is deterministic — the LLM duplicate-reviewer in
// `duplicate-reviewer.ts` runs after this as a safety net.
//
// Keys are normalized lowercase, whitespace-collapsed, and run through
// company/date/skill normalizers so cosmetic variants collide.

import type {
  LinkedInEducation,
  LinkedInExperience,
  LinkedInNamedSchema,
  LinkedInSnapshot,
} from "./types";

import { z } from "zod";

type LinkedInNamed = z.infer<typeof LinkedInNamedSchema>;

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export function dedupeLinkedInExperiences(
  experiences: ReadonlyArray<LinkedInExperience>,
): LinkedInExperience[] {
  const byKey = new Map<string, LinkedInExperience>();
  const order: string[] = [];

  for (const experience of experiences) {
    const key = linkedInExperienceDedupeKey(experience);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, mergeExperience(existing, experience));
      continue;
    }
    byKey.set(key, experience);
    order.push(key);
  }

  return order.map((key) => byKey.get(key)).filter((x): x is LinkedInExperience => Boolean(x));
}

export function linkedInExperienceDedupeKey(
  experience: Pick<LinkedInExperience, "company" | "position_title" | "from_date">,
): string {
  const company = normalizeCompany(experience.company);
  const title = normalizeTitle(experience.position_title);
  if (!company && !title) return "";
  if (company && title) return [company, title].join("::");
  return [
    company || "unknown-company",
    title || "unknown-title",
    normalizeDate(experience.from_date),
  ].join("::");
}

function mergeExperience(
  existing: LinkedInExperience,
  incoming: LinkedInExperience,
): LinkedInExperience {
  return {
    position_title: pickText(existing.position_title, incoming.position_title),
    company: pickText(existing.company, incoming.company),
    location: pickText(existing.location, incoming.location),
    from_date: pickText(existing.from_date, incoming.from_date),
    to_date: pickText(existing.to_date, incoming.to_date),
    description: pickLongerText(existing.description, incoming.description),
    linkedin_url: pickText(existing.linkedin_url, incoming.linkedin_url),
  };
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

export function dedupeLinkedInEducations(
  educations: ReadonlyArray<LinkedInEducation>,
): LinkedInEducation[] {
  const byKey = new Map<string, LinkedInEducation>();
  const order: string[] = [];

  for (const education of educations) {
    const key = linkedInEducationDedupeKey(education);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, mergeEducation(existing, education));
      continue;
    }
    byKey.set(key, education);
    order.push(key);
  }

  return order.map((key) => byKey.get(key)).filter((x): x is LinkedInEducation => Boolean(x));
}

export function linkedInEducationDedupeKey(
  education: Pick<LinkedInEducation, "institution" | "degree" | "from_date">,
): string {
  const school = normalizeInstitution(education.institution);
  const degree = normalizeDegree(education.degree);
  if (!school) return "";
  if (degree) return [school, degree].join("::");
  return [school, normalizeDate(education.from_date) || "unknown-date"].join("::");
}

function mergeEducation(
  existing: LinkedInEducation,
  incoming: LinkedInEducation,
): LinkedInEducation {
  return {
    institution: pickText(existing.institution, incoming.institution),
    degree: pickText(existing.degree, incoming.degree),
    from_date: pickText(existing.from_date, incoming.from_date),
    to_date: pickText(existing.to_date, incoming.to_date),
    description: pickLongerText(existing.description, incoming.description),
    linkedin_url: pickText(existing.linkedin_url, incoming.linkedin_url),
  };
}

// ---------------------------------------------------------------------------
// Skills (and other named entries)
// ---------------------------------------------------------------------------

export function dedupeLinkedInNamed(
  items: ReadonlyArray<LinkedInNamed>,
): LinkedInNamed[] {
  const byKey = new Map<string, LinkedInNamed>();
  const order: string[] = [];

  for (const item of items) {
    const key = normalizeSkillName(item.name);
    if (!key) continue;
    if (byKey.has(key)) continue;
    byKey.set(key, item);
    order.push(key);
  }

  return order.map((key) => byKey.get(key)).filter((x): x is LinkedInNamed => Boolean(x));
}

// ---------------------------------------------------------------------------
// Snapshot-level convenience: dedupe every list-shaped field in one call.
// ---------------------------------------------------------------------------

export function dedupeLinkedInSnapshotExperiences(
  snapshot: LinkedInSnapshot,
): LinkedInSnapshot {
  return dedupeLinkedInSnapshot(snapshot);
}

export function dedupeLinkedInSnapshot(
  snapshot: LinkedInSnapshot,
): LinkedInSnapshot {
  return {
    ...snapshot,
    experiences: dedupeLinkedInExperiences(snapshot.experiences),
    educations: dedupeLinkedInEducations(snapshot.educations),
    skills: dedupeLinkedInNamed(snapshot.skills),
    interests: dedupeLinkedInNamed(snapshot.interests),
    accomplishments: dedupeLinkedInNamed(snapshot.accomplishments),
  };
}

// ---------------------------------------------------------------------------
// Normalizers — exported so the Convex merge can apply the same key shape.
// ---------------------------------------------------------------------------

export function normalizeCompany(value: string | null | undefined): string {
  const base = baseNormalize(value);
  if (!base) return "";
  // Strip trailing legal suffixes that LinkedIn sometimes includes.
  let next = base.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    const stripped = next.replace(
      /\s+(inc|llc|ltd|gmbh|co|corp|corporation|company|plc|sa|nv)$/i,
      "",
    );
    if (stripped === next) break;
    next = stripped.trim();
  }
  return next;
}

export function normalizeTitle(value: string | null | undefined): string {
  const base = baseNormalize(value);
  if (!base) return "";
  // Collapse common synonyms that produce false uniques.
  return base
    .replace(/&/g, " and ")
    .replace(/\bsr\b\.?/g, "senior")
    .replace(/\bjr\b\.?/g, "junior")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeInstitution(value: string | null | undefined): string {
  const base = baseNormalize(value);
  if (!base) return "";
  return base
    .replace(/^the\s+/, "")
    .replace(/\s+(university|college|institute|school)\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim() || base;
}

export function normalizeDegree(value: string | null | undefined): string {
  const base = baseNormalize(value);
  if (!base) return "";
  return base
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSkillName(value: string | null | undefined): string {
  const base = baseNormalize(value);
  // Strip every separator so "TypeScript", "Type Script", "Type-Script",
  // and "Type_Script" all collapse to the same key.
  return base.replace(/[\s\-_/.,]+/g, "");
}

export function normalizeDate(value: string | null | undefined): string {
  const base = baseNormalize(value);
  if (!base) return "";
  const months: Record<string, string> = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };
  const cleaned = base.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  const monthYear = cleaned.match(/^([a-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const m = months[monthYear[1]] ?? "00";
    return `${monthYear[2]}-${m}`;
  }
  const yearMonth = cleaned.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonth) {
    return `${yearMonth[1]}-${yearMonth[2].padStart(2, "0")}`;
  }
  const yearOnly = cleaned.match(/^(\d{4})$/);
  if (yearOnly) return yearOnly[1];
  return cleaned;
}

function baseNormalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function pickText<T extends string | null | undefined>(current: T, next: T): T {
  if (typeof current === "string" && current.trim()) return current;
  return next;
}

function pickLongerText<T extends string | null | undefined>(current: T, next: T): T {
  const currentLength = typeof current === "string" ? current.trim().length : 0;
  const nextLength = typeof next === "string" ? next.trim().length : 0;
  return nextLength > currentLength ? next : current;
}
