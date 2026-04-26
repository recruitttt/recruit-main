import type { UserProfile } from "../../profile";
import type { RankingProfile } from "../../job-ranking";

export type RepoSummaryDigest = {
  repoFullName: string;
  summary?: {
    whatItDoes?: string;
    oneLineDescription?: string;
    keyTechnologies?: ReadonlyArray<string>;
    accomplishments?: ReadonlyArray<string>;
  } | null;
  stars?: number;
};

const MAX_REPO_HIGHLIGHTS = 6;
const MAX_REPO_SUMMARY_CHARS = 400;
const MAX_EDUCATION = 4;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const SENIOR_RE = /\b(senior|principal|lead|head|director|manager)\b/i;
const STAFF_RE = /\bstaff\b/i;
const JUNIOR_RE = /\b(junior|new[- ]?grad|entry[-\s]?level|apprentice)\b/i;
const INTERN_RE = /\bintern(ship)?\b/i;

function inferTargetSeniority(profile: UserProfile): RankingProfile["targetSeniority"] {
  const text = [
    (profile.prefs?.roles ?? []).join(" "),
    profile.headline ?? "",
    profile.summary ?? "",
  ].join(" ");
  if (INTERN_RE.test(text)) return "intern";
  if (STAFF_RE.test(text)) return "staff";
  if (SENIOR_RE.test(text)) return "senior";
  if (JUNIOR_RE.test(text)) return "junior";
  return "mid";
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return Date.UTC(Number(trimmed), 0, 1);
  if (/^\d{4}-\d{1,2}$/.test(trimmed)) {
    const [year, month] = trimmed.split("-").map(Number);
    return Date.UTC(year, Math.max(0, month - 1), 1);
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function estimateYearsExperience(profile: UserProfile): number | undefined {
  const experiences = profile.experience ?? [];
  if (experiences.length === 0) return undefined;
  const now = Date.now();
  let totalMs = 0;
  for (const role of experiences) {
    const start = parseDate(role.startDate);
    if (start === undefined) continue;
    const end = parseDate(role.endDate) ?? now;
    if (end > start) totalMs += end - start;
  }
  if (totalMs === 0) return undefined;
  return Math.round((totalMs / MS_PER_YEAR) * 10) / 10;
}

function buildRepoHighlights(
  profile: UserProfile,
  repoSummaries: ReadonlyArray<RepoSummaryDigest>
): NonNullable<RankingProfile["repoHighlights"]> {
  const fromSummaries = [...repoSummaries]
    .filter((row) => {
      const text = row.summary?.whatItDoes ?? row.summary?.oneLineDescription ?? "";
      return text.trim().length > 0;
    })
    .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
    .slice(0, MAX_REPO_HIGHLIGHTS)
    .map((row) => {
      const text = row.summary?.whatItDoes ?? row.summary?.oneLineDescription ?? "";
      return {
        name: row.repoFullName,
        summary: text.slice(0, MAX_REPO_SUMMARY_CHARS),
        languages: [...(row.summary?.keyTechnologies ?? [])],
        stars: row.stars,
      };
    });

  if (fromSummaries.length > 0) return fromSummaries;

  const topRepos = profile.github?.topRepos ?? [];
  return topRepos.slice(0, MAX_REPO_HIGHLIGHTS).map((repo) => ({
    name: repo.name,
    summary: repoSummary(repo),
    languages: repoLanguages(repo),
    stars: repo.stars,
  }));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

function joinStringArray(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const joined = value.filter((item): item is string => typeof item === "string").join(" ");
  return joined.trim().length > 0 ? joined : undefined;
}

function experienceDescription(role: unknown): string | undefined {
  if (!role || typeof role !== "object") return undefined;
  const record = role as Record<string, unknown>;
  const parts = [
    asString(record.description),
    asString(record.roleSummary),
    joinStringArray(record.keyResponsibilities),
    joinStringArray(record.technologiesMentioned),
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function repoSummary(repo: unknown): string {
  if (!repo || typeof repo !== "object") return "";
  const record = repo as Record<string, unknown>;
  return (
    firstString(record.whatItDoes, record.oneLineDescription, record.description) ?? ""
  ).slice(0, MAX_REPO_SUMMARY_CHARS);
}

function repoLanguages(repo: unknown): string[] {
  if (!repo || typeof repo !== "object") return [];
  const record = repo as Record<string, unknown>;
  const language = asString(record.language);
  return Array.from(
    new Set([language, ...asStringArray(record.keyTechnologies)].filter((item): item is string => Boolean(item)))
  );
}

export function toRichRankingProfile(
  profile: UserProfile | null | undefined,
  repoSummaries: ReadonlyArray<RepoSummaryDigest> = []
): RankingProfile {
  if (!profile || typeof profile !== "object") {
    return {
      skills: [],
      experience: [],
      prefs: { roles: [], locations: [] },
    };
  }

  const experienceArr = Array.isArray(profile.experience) ? profile.experience : [];
  const educationArr = Array.isArray(profile.education) ? profile.education : [];
  const prefs = profile.prefs ?? {};
  const safeRepoSummaries = Array.isArray(repoSummaries) ? repoSummaries : [];

  return {
    headline: asString(profile.headline),
    summary: asString(profile.summary),
    resumeText: asString(profile.resume?.rawText),
    location: asString(profile.location),
    skills: asStringArray(profile.skills),
    experience: experienceArr.map((role) => ({
      title: asString(role?.title),
      company: asString(role?.company),
      description: experienceDescription(role),
    })),
    education: educationArr.slice(0, MAX_EDUCATION).map((entry) => ({
      school: asString(entry?.school),
      degree: asString(entry?.degree),
      field: asString(entry?.field),
    })),
    repoHighlights: buildRepoHighlights(profile, safeRepoSummaries),
    prefs: {
      roles: asStringArray(prefs.roles),
      locations: asStringArray(prefs.locations),
      workAuth: asString(prefs.workAuth),
      minSalary: asString(prefs.minSalary),
      companySizes: asStringArray(prefs.companySizes),
    },
    yearsExperience: estimateYearsExperience(profile),
    targetSeniority: inferTargetSeniority(profile),
  };
}
