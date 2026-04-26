import type { LinkedInExperience, LinkedInSnapshot } from "./types";

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

export function dedupeLinkedInSnapshotExperiences(
  snapshot: LinkedInSnapshot,
): LinkedInSnapshot {
  return {
    ...snapshot,
    experiences: dedupeLinkedInExperiences(snapshot.experiences),
  };
}

export function linkedInExperienceDedupeKey(
  experience: Pick<LinkedInExperience, "company" | "position_title" | "from_date">,
): string {
  const company = normalizeKeyPart(experience.company);
  const title = normalizeKeyPart(experience.position_title);
  if (!company && !title) return "";
  return [
    company || "unknown-company",
    title || "unknown-title",
    normalizeKeyPart(experience.from_date),
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

function normalizeKeyPart(value: string | null | undefined): string {
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
