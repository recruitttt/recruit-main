// Pure diff between two UserProfile snapshots. Returns the list of FieldPaths
// that newly appeared (or got a non-empty value) in the next snapshot.
//
// Used by hooks/use-profile-growth.ts to drive the "field learned" reveal
// animation in the live profile sidebar.

import type {
  Education,
  GitHubRepo,
  ProfileLinks,
  UserProfile,
  WorkExperience,
} from "@/lib/profile";

export type FieldPath = string;

const SCALAR_PATHS: ReadonlyArray<keyof UserProfile> = [
  "name",
  "email",
  "location",
  "headline",
  "summary",
];

const LINK_KEYS: ReadonlyArray<keyof ProfileLinks> = [
  "github",
  "linkedin",
  "twitter",
  "devpost",
  "website",
];

export function diffProfile(
  prev: UserProfile,
  next: UserProfile,
): FieldPath[] {
  const added: FieldPath[] = [];

  // Scalar identity fields.
  for (const path of SCALAR_PATHS) {
    if (isEmpty(prev[path]) && !isEmpty(next[path])) {
      added.push(path);
    }
  }

  // Links — track per-key so the UI can pulse just the one chip that filled.
  for (const key of LINK_KEYS) {
    if (isEmpty(prev.links?.[key]) && !isEmpty(next.links?.[key])) {
      added.push(`links.${key}`);
    }
  }

  // Resume.
  if (!prev.resume?.filename && next.resume?.filename) {
    added.push("resume");
  }

  // Skills — string-set diff.
  const prevSkills = new Set((prev.skills ?? []).map((s) => s.toLowerCase()));
  for (const skill of next.skills ?? []) {
    if (!prevSkills.has(skill.toLowerCase())) {
      added.push(`skills.${skill}`);
    }
  }

  // Experience — keyed by company::title (matches convex/userProfiles.ts:56).
  const prevExp = new Set((prev.experience ?? []).map(experienceKey));
  (next.experience ?? []).forEach((item, i) => {
    if (!prevExp.has(experienceKey(item))) {
      added.push(`experience.${i}`);
    }
  });

  // Education — keyed by school::degree.
  const prevEdu = new Set((prev.education ?? []).map(educationKey));
  (next.education ?? []).forEach((item, i) => {
    if (!prevEdu.has(educationKey(item))) {
      added.push(`education.${i}`);
    }
  });

  // GitHub repos.
  const prevRepos = new Set(
    (prev.github?.topRepos ?? []).map((r) => repoKey(r)),
  );
  (next.github?.topRepos ?? []).forEach((repo, i) => {
    if (!prevRepos.has(repoKey(repo))) {
      added.push(`github.topRepos.${i}`);
    }
  });

  // Github bio / username.
  if (!prev.github?.bio && next.github?.bio) added.push("github.bio");
  if (!prev.github?.username && next.github?.username) {
    added.push("github.username");
  }

  // Prefs — top-level "filled" tracking only.
  const prevRoles = new Set(prev.prefs?.roles ?? []);
  for (const role of next.prefs?.roles ?? []) {
    if (!prevRoles.has(role)) added.push(`prefs.roles.${role}`);
  }
  const prevLocs = new Set(prev.prefs?.locations ?? []);
  for (const loc of next.prefs?.locations ?? []) {
    if (!prevLocs.has(loc)) added.push(`prefs.locations.${loc}`);
  }
  if (!prev.prefs?.workAuth && next.prefs?.workAuth) {
    added.push("prefs.workAuth");
  }

  return added;
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function experienceKey(item: Pick<WorkExperience, "company" | "title">): string {
  return `${(item.company ?? "").toLowerCase()}::${(item.title ?? "").toLowerCase()}`;
}

function educationKey(item: Pick<Education, "school" | "degree">): string {
  return `${(item.school ?? "").toLowerCase()}::${(item.degree ?? "").toLowerCase()}`;
}

function repoKey(repo: Pick<GitHubRepo, "name" | "url">): string {
  return `${(repo.name ?? "").toLowerCase()}@${repo.url ?? ""}`;
}
