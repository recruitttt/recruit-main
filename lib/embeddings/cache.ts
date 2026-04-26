// Helpers for content hashing and embedding-text construction.
// Pure JS — runs in Node (Convex actions), Next.js routes, and scripts.
//
// `contentHash` is a stable FNV-1a 64-bit hash; collision resistance is more
// than sufficient for cache invalidation across N < 1M items. Output is a
// fixed 16-char hex string.

import type { RankingProfile } from "../job-ranking";

const FNV_OFFSET_64 = BigInt("0xcbf29ce484222325");
const FNV_PRIME_64 = BigInt("0x100000001b3");
const UINT64_MASK = (BigInt(1) << BigInt(64)) - BigInt(1);

export function contentHash(text: string): string {
  let hash = FNV_OFFSET_64;
  for (let i = 0; i < text.length; i++) {
    hash = (hash ^ BigInt(text.charCodeAt(i))) & UINT64_MASK;
    hash = (hash * FNV_PRIME_64) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

export type EmbeddableJob = {
  title: string;
  company: string;
  department?: string;
  team?: string;
  location?: string;
  workplaceType?: string;
  descriptionPlain?: string;
};

const MAX_DESCRIPTION_CHARS = 4000;
const MAX_RESUME_CHARS = 5000;

export function buildJobEmbeddingText(job: EmbeddableJob): string {
  const headerParts = [
    job.title,
    job.company,
    job.department,
    job.team,
    job.location,
    job.workplaceType,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));
  const description = (job.descriptionPlain ?? "").slice(0, MAX_DESCRIPTION_CHARS);
  return [headerParts.join(" | "), description].filter(Boolean).join("\n\n").trim();
}

export function buildProfileEmbeddingText(profile: RankingProfile): string {
  const roles = profile.prefs?.roles ?? [];
  const skills = profile.skills ?? [];
  const experience = profile.experience ?? [];
  const repoHighlights = profile.repoHighlights ?? [];
  const education = profile.education ?? [];

  const sections = [
    profile.headline ?? "",
    roles.length > 0 ? `Looking for: ${roles.join(", ")}` : "",
    profile.summary ?? "",
    skills.length > 0 ? `Skills: ${skills.slice(0, 24).join(", ")}` : "",
    experience.length > 0
      ? "Experience:\n" +
        experience
          .slice(0, 6)
          .map((item) =>
            [item.title, item.company, item.description]
              .filter(Boolean)
              .join(" — ")
          )
          .join("\n")
      : "",
    repoHighlights.length > 0
      ? "Projects:\n" +
        repoHighlights
          .slice(0, 4)
          .map((repo) =>
            [repo.name, repo.summary, repo.languages.join("/")]
              .filter(Boolean)
              .join(" — ")
          )
          .join("\n")
      : "",
    profile.resumeText
      ? `Resume:\n${profile.resumeText.slice(0, MAX_RESUME_CHARS)}`
      : "",
    education.length > 0
      ? "Education: " +
        education
          .slice(0, 3)
          .map((entry) => [entry.degree, entry.field, entry.school].filter(Boolean).join(" "))
          .join("; ")
      : "",
  ];

  return sections.filter(Boolean).join("\n\n").trim();
}

export const PROFILE_SCHEMA_VERSION = "v1";
