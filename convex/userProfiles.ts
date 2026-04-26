//
// userProfiles — canonical UserProfile blob (lib/profile.ts shape).
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §4 + §6
//
// `merge(userId, patch, provenance)` deep-merges a Partial<UserProfile> into
// the stored doc, appends provenance entries, appends a log entry, and
// upserts if the row does not exist yet.

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import {
  EMPTY_PROFILE,
  type UserProfile,
  type WorkExperience,
  type Education,
  type ProfileLinks,
  type ProfilePrefs,
  type GitHubEnrichment,
  type GitHubRepo,
  type ProfileLogEntry,
  type ProfileSuggestion,
  type ProvenanceSource,
} from "../lib/profile";
import { linkedInExperienceDedupeKey } from "../lib/intake/linkedin/experience-dedupe";

const query = queryGeneric;
const mutation = mutationGeneric;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SOURCES: ReadonlySet<ProvenanceSource> = new Set([
  "chat",
  "resume",
  "github",
  "linkedin",
  "website",
  "devpost",
  "voice",
  "manual",
]);

function isProvenanceSource(value: unknown): value is ProvenanceSource {
  return typeof value === "string" && VALID_SOURCES.has(value as ProvenanceSource);
}

function inferSource(provenance: Record<string, string>): ProvenanceSource {
  for (const value of Object.values(provenance)) {
    if (isProvenanceSource(value)) return value;
  }
  return "manual";
}

function expKey(item: { company?: string; title?: string }): string {
  return `${(item.company ?? "").toLowerCase().trim()}::${(item.title ?? "").toLowerCase().trim()}`;
}

function eduKey(item: { school?: string; degree?: string; field?: string }): string {
  return `${(item.school ?? "").toLowerCase().trim()}::${(item.degree ?? "").toLowerCase().trim()}::${(item.field ?? "").toLowerCase().trim()}`;
}

function repoKey(item: { name?: string; url?: string }): string {
  return (item.url ?? item.name ?? "").toLowerCase().trim();
}

function suggestionKey(item: { id?: string }): string {
  return item.id ?? "";
}

function dedupBy<T>(items: ReadonlyArray<T>, keyOf: (x: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    // newer wins (later iteration overwrites earlier)
    seen.set(key, item);
  }
  return Array.from(seen.values());
}

function isNonEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function pickDefined<T>(next: T | undefined, prev: T | undefined): T | undefined {
  return next === undefined ? prev : next;
}

function ensureProfile(stored: unknown): UserProfile {
  if (!stored || typeof stored !== "object") return cloneEmpty();
  const partial = stored as Partial<UserProfile>;
  return {
    ...cloneEmpty(),
    ...partial,
    links: { ...EMPTY_PROFILE.links, ...(partial.links ?? {}) },
    experience: Array.isArray(partial.experience) ? partial.experience : [],
    education: Array.isArray(partial.education) ? partial.education : [],
    skills: Array.isArray(partial.skills) ? partial.skills : [],
    prefs: { ...EMPTY_PROFILE.prefs, ...(partial.prefs ?? {}) },
    suggestions: Array.isArray(partial.suggestions) ? partial.suggestions : [],
    provenance: { ...(partial.provenance ?? {}) },
    log: Array.isArray(partial.log) ? partial.log : [],
  };
}

function cloneEmpty(): UserProfile {
  return {
    links: {},
    experience: [],
    education: [],
    skills: [],
    prefs: { roles: [], locations: [] },
    suggestions: [],
    provenance: {},
    log: [],
    updatedAt: new Date(0).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Field caps — keep the per-doc blob comfortably under Convex's 1 MB document
// limit even after many merges. Truncation drops the OLDEST entries (FIFO),
// which matches the existing `appendLog` semantics.
// ---------------------------------------------------------------------------
const CAP_EXPERIENCE = 50;
const CAP_EDUCATION = 30;
const CAP_SKILLS = 100;
const CAP_SUGGESTIONS = 100;
const CAP_TOP_REPOS = 50;
const CAP_LOG = 200;
// `summary` lives in the same field whether it's a free-form bio (~4 KB) or
// a serialized GitHub `profileReadme` (~8 KB). Use the larger of the two
// caps as the persisted ceiling — the GitHub adapter already truncates
// profileReadme to 4 KB upstream, so the 8 KB ceiling is just a safety net.
const CAP_SUMMARY_CHARS = 8_000;
const EDITABLE_PROFILE_LINK_KEYS = [
  "github",
  "linkedin",
  "website",
  "devpost",
  "twitter",
] as const;
const editableLinkValueValidator = v.union(v.string(), v.null());
const editableLinksValidator = v.object({
  github: v.optional(editableLinkValueValidator),
  linkedin: v.optional(editableLinkValueValidator),
  website: v.optional(editableLinkValueValidator),
  devpost: v.optional(editableLinkValueValidator),
  twitter: v.optional(editableLinkValueValidator),
});

type EditableProfileLinkKey = (typeof EDITABLE_PROFILE_LINK_KEYS)[number];

function capArray<T>(items: ReadonlyArray<T>, cap: number): T[] {
  if (items.length <= cap) return [...items];
  // Drop oldest first, keep the newest `cap` entries.
  return items.slice(items.length - cap);
}

function capString(value: string | undefined, cap: number): string | undefined {
  if (typeof value !== "string") return value;
  if (value.length <= cap) return value;
  return value.slice(0, cap);
}

function mergeProfileBlob(
  current: UserProfile,
  patch: Partial<UserProfile>
): UserProfile {
  const next: UserProfile = {
    ...current,
    name: pickDefined(patch.name, current.name),
    email: pickDefined(patch.email, current.email),
    location: pickDefined(patch.location, current.location),
    headline: pickDefined(patch.headline, current.headline),
    summary: capString(pickDefined(patch.summary, current.summary), CAP_SUMMARY_CHARS),
    links: mergeLinks(current.links, patch.links),
    resume: patch.resume ? { ...current.resume, ...patch.resume } : current.resume,
    experience: capArray(
      mergeArray<WorkExperience>(current.experience, patch.experience, expKey),
      CAP_EXPERIENCE
    ),
    education: capArray(
      mergeArray<Education>(current.education, patch.education, eduKey),
      CAP_EDUCATION
    ),
    skills: mergeStringSet(current.skills, patch.skills, CAP_SKILLS),
    github: capGithub(mergeGithub(current.github, patch.github)),
    prefs: mergePrefs(current.prefs, patch.prefs),
    suggestions: capArray(
      mergeArray<ProfileSuggestion>(
        current.suggestions,
        patch.suggestions,
        suggestionKey
      ),
      CAP_SUGGESTIONS
    ),
    // provenance + log are handled explicitly outside this function
    updatedAt: new Date().toISOString(),
  };
  return next;
}

function capGithub(
  github: GitHubEnrichment | undefined
): GitHubEnrichment | undefined {
  if (!github) return github;
  // Strip any per-repo `whatItDoes` strings — those live in the
  // `repoSummaries` table; duplicating them here would balloon the doc.
  const sanitizedRepos = github.topRepos.map((repo) => {
    const cleaned: GitHubRepo = {
      name: repo.name,
      description: repo.description,
      language: repo.language,
      stars: repo.stars,
      url: repo.url,
    };
    return cleaned;
  });
  return {
    ...github,
    topRepos: capArray(sanitizedRepos, CAP_TOP_REPOS),
  };
}

function mergeLinks(
  current: ProfileLinks,
  patch: ProfileLinks | undefined
): ProfileLinks {
  if (!patch) return current;
  const merged: ProfileLinks = { ...current };
  for (const key of Object.keys(patch) as Array<keyof ProfileLinks>) {
    const value = patch[key];
    if (isNonEmpty(value)) merged[key] = value;
  }
  return merged;
}

function hasOwn<T extends object, K extends PropertyKey>(
  object: T,
  key: K
): object is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function expandEditableLinkInput(
  key: EditableProfileLinkKey,
  value: string
): string {
  if (/^https?:\/\//i.test(value)) return value;

  const handle = value.replace(/^@+/, "");
  if (key === "github" && !/[./]/.test(handle)) {
    return `https://github.com/${handle}`;
  }
  if (key === "linkedin" && !/[./]/.test(handle)) {
    return `https://www.linkedin.com/in/${handle}`;
  }
  if (key === "devpost" && !/[./]/.test(handle)) {
    return `https://devpost.com/${handle}`;
  }
  if (key === "twitter" && !/[./]/.test(handle)) {
    return `https://x.com/${handle}`;
  }

  return `https://${value}`;
}

function hostMatches(hostname: string, root: string): boolean {
  return hostname === root || hostname.endsWith(`.${root}`);
}

function normalizeEditableLink(
  key: EditableProfileLinkKey,
  value: string | null | undefined
): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let url: URL;
  try {
    url = new URL(expandEditableLinkInput(key, trimmed));
  } catch {
    throw new Error(`Invalid ${key} URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid ${key} URL.`);
  }
  url.protocol = "https:";
  url.hash = "";

  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (key === "github" && !hostMatches(host, "github.com")) {
    throw new Error("GitHub link must be on github.com.");
  }
  if (key === "linkedin" && (!hostMatches(host, "linkedin.com") || !path.startsWith("/in/"))) {
    throw new Error("LinkedIn link must look like linkedin.com/in/<handle>.");
  }
  if (key === "devpost" && !hostMatches(host, "devpost.com")) {
    throw new Error("DevPost link must be on devpost.com.");
  }
  if (key === "twitter" && !hostMatches(host, "x.com") && !hostMatches(host, "twitter.com")) {
    throw new Error("X / Twitter link must be on x.com or twitter.com.");
  }

  return url.toString();
}

function mergePrefs(
  current: ProfilePrefs,
  patch: ProfilePrefs | undefined
): ProfilePrefs {
  if (!patch) return current;
  return {
    roles: mergeStringSet(current.roles, patch.roles, 20),
    locations: mergeStringSet(current.locations, patch.locations, 20),
    workAuth: pickDefined(patch.workAuth, current.workAuth),
    minSalary: pickDefined(patch.minSalary, current.minSalary),
    companySizes: patch.companySizes && patch.companySizes.length > 0
      ? mergeStringSet(current.companySizes ?? [], patch.companySizes, 20)
      : current.companySizes,
  };
}

function mergeGithub(
  current: GitHubEnrichment | undefined,
  patch: GitHubEnrichment | undefined
): GitHubEnrichment | undefined {
  if (!patch) return current;
  const base = current ?? { topRepos: [] as GitHubRepo[] };
  return {
    username: pickDefined(patch.username, base.username),
    bio: pickDefined(patch.bio, base.bio),
    company: pickDefined(patch.company, base.company),
    publicRepos: pickDefined(patch.publicRepos, base.publicRepos),
    followers: pickDefined(patch.followers, base.followers),
    topRepos: mergeArray<GitHubRepo>(base.topRepos, patch.topRepos, repoKey),
  };
}

function mergeArray<T>(
  current: ReadonlyArray<T>,
  patch: ReadonlyArray<T> | undefined,
  keyOf: (x: T) => string
): T[] {
  if (!patch || patch.length === 0) return [...current];
  // patch entries come AFTER current so newer wins on duplicate key
  return dedupBy([...current, ...patch], keyOf);
}

function mergeStringSet(
  current: ReadonlyArray<string>,
  patch: ReadonlyArray<string> | undefined,
  cap: number
): string[] {
  if (!patch || patch.length === 0) return [...current];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [...current, ...patch]) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(trimmed);
    if (result.length >= cap) break;
  }
  return result;
}

function appendLog(
  current: ProfileLogEntry[],
  entry: ProfileLogEntry,
  cap = CAP_LOG
): ProfileLogEntry[] {
  return [...current, entry].slice(-cap);
}

async function requireOwner(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string } | null> } },
  userId: string
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  if (identity.subject !== userId) throw new Error("Forbidden");
}

// ---------------------------------------------------------------------------
// Queries / mutations
// ---------------------------------------------------------------------------

export const byUser = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const row = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    return row ?? null;
  },
});

// merge — apply a Partial<UserProfile> patch + provenance entries.
//
// Concurrency: each Convex mutation runs serially against a single document,
// so the read-modify-write inside this handler is atomic. However, two
// adapters issuing separate `merge` calls in parallel can still race on
// overlapping top-level fields — the second write wins on shared fields.
//
// In practice the GitHub / LinkedIn / Resume adapters write largely disjoint
// top-level slices (`github`, `experience`+`education`, `resume`+`summary`),
// so the race is benign. If you add an adapter that writes the same fields
// as another, fan in via a single dispatcher rather than parallel `merge`
// calls.
export const merge = mutation({
  args: {
    userId: v.string(),
    patch: v.any(),
    provenance: v.optional(v.record(v.string(), v.string())),
    label: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const currentProfile: UserProfile = ensureProfile(existing?.profile);
    const patch: Partial<UserProfile> = (args.patch && typeof args.patch === "object"
      ? (args.patch as Partial<UserProfile>)
      : {});
    const provenancePatch: Record<string, string> =
      args.provenance && typeof args.provenance === "object" ? args.provenance : {};

    const mergedProfile = mergeProfileBlob(currentProfile, patch);

    // Provenance: newer wins.
    const mergedProvenance: Record<string, string> = {
      ...(existing?.provenance ?? {}),
      ...currentProfile.provenance,
      ...provenancePatch,
    };
    mergedProfile.provenance = mergedProvenance as Record<string, ProvenanceSource>;

    // Log: append a single entry summarizing this merge.
    const inferredSource = inferSource(provenancePatch);
    const fieldCount = Object.keys(patch).length;
    const provCount = Object.keys(provenancePatch).length;
    const logEntry: ProfileLogEntry = {
      at: now,
      source: inferredSource,
      label:
        args.label ??
        (fieldCount > 0
          ? `merge(${fieldCount} field${fieldCount === 1 ? "" : "s"})`
          : `provenance(${provCount} entries)`),
      level: "info",
    };
    const existingLog: ProfileLogEntry[] = Array.isArray(existing?.log)
      ? (existing!.log as ProfileLogEntry[])
      : currentProfile.log;
    mergedProfile.log = appendLog(existingLog, logEntry);
    mergedProfile.updatedAt = now;

    if (existing) {
      await ctx.db.patch(existing._id, {
        profile: mergedProfile,
        provenance: mergedProvenance,
        log: mergedProfile.log,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId: args.userId,
      profile: mergedProfile,
      provenance: mergedProvenance,
      log: mergedProfile.log,
      updatedAt: now,
    });
  },
});

// updateProfile — overwrite the entire profile blob for a user.
//
// Used by the personalization agent to persist insights derived from chat
// answers. Unlike `merge`, this replaces the full `profile` object rather than
// deep-merging a patch — callers are responsible for preserving fields they
// don't intend to clobber.
export const updateProfile = mutation({
  args: { userId: v.string(), profile: v.any() },
  returns: v.any(),
  handler: async (ctx, { userId, profile }) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, { profile, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("userProfiles", {
      userId,
      profile,
      provenance: {},
      log: [],
      updatedAt: now,
    });
  },
});

// updateLinks — owner-scoped profile link editing for /profile.
//
// This deliberately has a narrower surface than `merge`: client UI can update
// public source URLs without being able to write arbitrary profile fields.
// Empty strings / null clear a link so users can remove stale sources.
export const updateLinks = mutation({
  args: {
    userId: v.string(),
    links: editableLinksValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const currentProfile: UserProfile = ensureProfile(existing?.profile);
    const nextLinks: ProfileLinks = { ...currentProfile.links };
    const provenancePatch: Record<string, string> = {};
    const changed: EditableProfileLinkKey[] = [];

    for (const key of EDITABLE_PROFILE_LINK_KEYS) {
      if (!hasOwn(args.links, key)) continue;
      const normalized = normalizeEditableLink(
        key,
        args.links[key] as string | null | undefined
      );
      const previous = currentProfile.links[key]?.trim() ?? "";

      if (normalized) {
        nextLinks[key] = normalized;
      } else {
        delete nextLinks[key];
      }

      if ((normalized ?? "") !== previous) {
        changed.push(key);
      }
      provenancePatch.links = "manual";
      provenancePatch[`links.${key}`] = "manual";
      provenancePatch[key] = "manual";
    }

    const mergedProvenance: Record<string, string> = {
      ...(existing?.provenance ?? {}),
      ...currentProfile.provenance,
      ...provenancePatch,
    };
    const existingLog: ProfileLogEntry[] = Array.isArray(existing?.log)
      ? (existing!.log as ProfileLogEntry[])
      : currentProfile.log;
    const logEntry: ProfileLogEntry = {
      at: now,
      source: "manual",
      label:
        changed.length > 0
          ? `Updated ${changed.length} source link${changed.length === 1 ? "" : "s"}`
          : "Reviewed source links",
      level: "success",
      payload: { changed },
    };
    const nextProfile: UserProfile = {
      ...currentProfile,
      links: nextLinks,
      provenance: mergedProvenance as Record<string, ProvenanceSource>,
      log: appendLog(existingLog, logEntry),
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        profile: nextProfile,
        provenance: mergedProvenance,
        log: nextProfile.log,
        updatedAt: now,
      });
      return { ok: true, changed };
    }

    const profileId = await ctx.db.insert("userProfiles", {
      userId: args.userId,
      profile: nextProfile,
      provenance: mergedProvenance,
      log: nextProfile.log,
      updatedAt: now,
    });
    return { ok: true, changed, profileId };
  },
});

// Stamp profile.onboardingCompletedAt so /(app) routes know whether to gate
// the user back to /onboarding. Cookie is the primary gate; this is the
// durable record (so e.g. analytics can see who finished onboarding and when).
export const markOnboardingComplete = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const baseProfile = existing?.profile ?? EMPTY_PROFILE;
    const nextProfile = { ...baseProfile, onboardingCompletedAt: now };

    if (existing) {
      await ctx.db.patch(existing._id, {
        profile: nextProfile,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId: args.userId,
      profile: nextProfile,
      provenance: {},
      log: [],
      updatedAt: now,
    });
  },
});

// Utility: reset the profile (used by sign-out / unlink flows).
export const deleteForUser = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

// ---------------------------------------------------------------------------
// assembleForPipeline — gather every intake source into a single
// `UserProfile`-shaped blob suitable for handing to the job-search /
// resume-tailoring pipeline.
//
// Sources merged:
//   - userProfiles.profile (base — chat answers, manual edits, resume blob)
//   - githubSnapshots      (handle, repos, totals → profile.github)
//   - repoSummaries        (per-repo Haiku → profile.github.topRepos[].whatItDoes,
//                           keyTechnologies, accomplishments)
//   - linkedinSnapshots    (experience/education/skills → profile.experience,
//                           profile.education, profile.skills)
//   - experienceSummaries  (per-experience Haiku → roleSummary,
//                           keyResponsibilities, technologiesMentioned attached
//                           to matching experience entry by company+title)
//
// Returns `null` if there's nothing at all to assemble (no profile row, no
// snapshot rows). Field caps mirror the merge cap constants above so the
// downstream pipeline never sees a payload bigger than what we'd persist.
// ---------------------------------------------------------------------------

interface AssembledRepoExtras {
  whatItDoes?: string;
  oneLineDescription?: string;
  keyTechnologies?: string[];
  accomplishments?: string[];
}

interface AssembledTopRepo extends GitHubRepo, AssembledRepoExtras {}

interface AssembledExperienceExtras {
  roleSummary?: string;
  keyResponsibilities?: string[];
  technologiesMentioned?: string[];
}

interface AssembledExperience extends WorkExperience, AssembledExperienceExtras {}

interface AssembledProfile extends UserProfile {
  experience: AssembledExperience[];
  github?: GitHubEnrichment & { topRepos: AssembledTopRepo[] };
}

interface RepoSummaryRow {
  repoFullName?: string;
  summary?: {
    whatItDoes?: string;
    oneLineDescription?: string;
    keyTechnologies?: ReadonlyArray<string>;
    accomplishments?: ReadonlyArray<string>;
  } | null;
}

interface ExperienceSummaryRow {
  company?: string;
  position?: string;
  summary?: {
    roleSummary?: string;
    keyResponsibilities?: ReadonlyArray<string>;
    technologiesMentioned?: ReadonlyArray<string>;
  } | null;
}

interface LinkedinExperienceRaw {
  position_title?: string | null;
  company?: string | null;
  location?: string | null;
  from_date?: string | null;
  to_date?: string | null;
  description?: string | null;
}

interface LinkedinEducationRaw {
  institution?: string | null;
  degree?: string | null;
  from_date?: string | null;
  to_date?: string | null;
}

interface LinkedinSnapshotRaw {
  name?: string | null;
  about?: string | null;
  location?: string | null;
  jobTitle?: string | null;
  profileUrl?: string;
  experiences?: ReadonlyArray<LinkedinExperienceRaw>;
  educations?: ReadonlyArray<LinkedinEducationRaw>;
  skills?: ReadonlyArray<{ name?: string | null }>;
}

interface GithubSnapshotRaw {
  user?: {
    login?: string;
    bio?: string | null;
    company?: string | null;
    publicRepos?: number;
    followers?: number;
    location?: string | null;
  };
  repos?: ReadonlyArray<{
    name?: string;
    fullName?: string;
    description?: string | null;
    primaryLanguage?: string | null;
    stargazerCount?: number;
    url?: string;
  }>;
  profileReadme?: string | null;
}

function lowerTrim(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildExperienceFromLinkedin(
  raw: LinkedinSnapshotRaw | undefined
): WorkExperience[] {
  if (!raw?.experiences || !Array.isArray(raw.experiences)) return [];
  const out: WorkExperience[] = [];
  const seen = new Set<string>();
  for (const exp of raw.experiences) {
    const company = (exp.company ?? "").trim();
    const title = (exp.position_title ?? "").trim();
    if (!company && !title) continue;
    const key = linkedInExperienceDedupeKey(exp);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      company: company || "(unknown)",
      title: title || "(unknown)",
      startDate: exp.from_date ?? undefined,
      endDate: exp.to_date ?? undefined,
      description: exp.description ?? undefined,
      location: exp.location ?? undefined,
    });
  }
  return out;
}

function buildEducationFromLinkedin(
  raw: LinkedinSnapshotRaw | undefined
): Education[] {
  if (!raw?.educations || !Array.isArray(raw.educations)) return [];
  const out: Education[] = [];
  for (const edu of raw.educations) {
    const school = (edu.institution ?? "").trim();
    if (!school) continue;
    out.push({
      school,
      degree: edu.degree ?? undefined,
      startDate: edu.from_date ?? undefined,
      endDate: edu.to_date ?? undefined,
    });
  }
  return out;
}

function buildSkillsFromLinkedin(
  raw: LinkedinSnapshotRaw | undefined
): string[] {
  if (!raw?.skills || !Array.isArray(raw.skills)) return [];
  const out: string[] = [];
  for (const skill of raw.skills) {
    const name = nonEmptyString(skill?.name);
    if (name) out.push(name);
  }
  return out;
}

function buildGithubFromSnapshot(
  raw: GithubSnapshotRaw | undefined
): GitHubEnrichment | undefined {
  if (!raw?.user) return undefined;
  const reposIn = Array.isArray(raw.repos) ? raw.repos : [];
  const topRepos: GitHubRepo[] = [];
  for (const repo of reposIn) {
    const name = nonEmptyString(repo.name) ?? nonEmptyString(repo.fullName);
    const url = nonEmptyString(repo.url);
    if (!name && !url) continue;
    topRepos.push({
      name: name ?? "(unknown)",
      description: repo.description ?? undefined,
      language: repo.primaryLanguage ?? undefined,
      stars: typeof repo.stargazerCount === "number" ? repo.stargazerCount : undefined,
      url:
        url ??
        (raw.user?.login && name
          ? `https://github.com/${raw.user.login}/${name}`
          : `https://github.com/${name ?? ""}`),
    });
  }

  return {
    username: raw.user.login,
    bio: raw.user.bio ?? undefined,
    company: raw.user.company ?? undefined,
    publicRepos: typeof raw.user.publicRepos === "number" ? raw.user.publicRepos : undefined,
    followers: typeof raw.user.followers === "number" ? raw.user.followers : undefined,
    topRepos,
  };
}

// Match summary rows to top repos. We match on (full repo name) first, then
// fall back to bare repo name. Returns a new repos array — never mutates.
function attachRepoSummaries(
  topRepos: ReadonlyArray<GitHubRepo>,
  summaries: ReadonlyArray<RepoSummaryRow>,
  githubLogin: string | undefined
): AssembledTopRepo[] {
  if (!summaries.length) return topRepos.map((r) => ({ ...r }));
  const summaryByFullName = new Map<string, RepoSummaryRow>();
  const summaryByBareName = new Map<string, RepoSummaryRow>();
  for (const row of summaries) {
    const full = lowerTrim(row.repoFullName);
    if (full) summaryByFullName.set(full, row);
    const bare = full.includes("/") ? full.split("/").pop() ?? "" : full;
    if (bare) summaryByBareName.set(bare, row);
  }
  return topRepos.map((repo) => {
    const bare = lowerTrim(repo.name);
    const fullByLogin = githubLogin ? `${lowerTrim(githubLogin)}/${bare}` : "";
    const summaryRow =
      (fullByLogin && summaryByFullName.get(fullByLogin)) ||
      summaryByBareName.get(bare) ||
      null;
    if (!summaryRow?.summary) return { ...repo };
    const s = summaryRow.summary;
    return {
      ...repo,
      whatItDoes: nonEmptyString(s.whatItDoes),
      oneLineDescription: nonEmptyString(s.oneLineDescription),
      keyTechnologies: Array.isArray(s.keyTechnologies)
        ? Array.from(s.keyTechnologies)
        : undefined,
      accomplishments: Array.isArray(s.accomplishments)
        ? Array.from(s.accomplishments)
        : undefined,
    };
  });
}

// Match per-experience Haiku summaries to experience entries by
// (company, title). LinkedIn `position_title` maps to UserProfile `title`.
// Match is case-insensitive on the trimmed pair.
function attachExperienceSummaries(
  experiences: ReadonlyArray<WorkExperience>,
  summaries: ReadonlyArray<ExperienceSummaryRow>
): AssembledExperience[] {
  if (!summaries.length) return experiences.map((e) => ({ ...e }));
  const byKey = new Map<string, ExperienceSummaryRow>();
  for (const row of summaries) {
    const key = `${lowerTrim(row.company)}::${lowerTrim(row.position)}`;
    if (key !== "::" && !byKey.has(key)) byKey.set(key, row);
  }
  return experiences.map((exp) => {
    const key = `${lowerTrim(exp.company)}::${lowerTrim(exp.title)}`;
    const summaryRow = byKey.get(key);
    if (!summaryRow?.summary) return { ...exp };
    const s = summaryRow.summary;
    return {
      ...exp,
      roleSummary: nonEmptyString(s.roleSummary),
      keyResponsibilities: Array.isArray(s.keyResponsibilities)
        ? Array.from(s.keyResponsibilities)
        : undefined,
      technologiesMentioned: Array.isArray(s.technologiesMentioned)
        ? Array.from(s.technologiesMentioned)
        : undefined,
    };
  });
}

export const assembleForPipeline = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);

    // Pull every source in parallel — Convex queries can read multiple
    // tables in one transaction without coordination concerns.
    const [
      profileRow,
      githubSnapshotRow,
      linkedinSnapshotRow,
      repoSummaryRows,
      experienceSummaryRows,
    ] = await Promise.all([
      ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .unique(),
      ctx.db
        .query("githubSnapshots")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .unique(),
      ctx.db
        .query("linkedinSnapshots")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .unique(),
      ctx.db
        .query("repoSummaries")
        .withIndex("by_user_repo", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("experienceSummaries")
        .withIndex("by_user_exp", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);

    const baseProfile = ensureProfile(profileRow?.profile);
    const githubRaw = (githubSnapshotRow as { raw?: GithubSnapshotRaw } | null)
      ?.raw;
    const linkedinRaw = (linkedinSnapshotRow as { raw?: LinkedinSnapshotRaw } | null)
      ?.raw;

    // ---- Build LinkedIn-derived patches --------------------------------
    const linkedinExperience = buildExperienceFromLinkedin(linkedinRaw);
    const linkedinEducation = buildEducationFromLinkedin(linkedinRaw);
    const linkedinSkills = buildSkillsFromLinkedin(linkedinRaw);
    const linkedinPatch: Partial<UserProfile> = {};
    if (linkedinRaw?.name) linkedinPatch.name = linkedinRaw.name;
    if (linkedinRaw?.location) linkedinPatch.location = linkedinRaw.location;
    if (linkedinRaw?.jobTitle) linkedinPatch.headline = linkedinRaw.jobTitle;
    if (linkedinRaw?.about) linkedinPatch.summary = linkedinRaw.about;
    if (linkedinRaw?.profileUrl) {
      linkedinPatch.links = { linkedin: linkedinRaw.profileUrl };
    }
    if (linkedinExperience.length > 0) linkedinPatch.experience = linkedinExperience;
    if (linkedinEducation.length > 0) linkedinPatch.education = linkedinEducation;
    if (linkedinSkills.length > 0) linkedinPatch.skills = linkedinSkills;

    // ---- Build GitHub-derived patch ------------------------------------
    const githubEnrichment = buildGithubFromSnapshot(githubRaw);
    const githubPatch: Partial<UserProfile> = {};
    if (githubEnrichment) githubPatch.github = githubEnrichment;

    // ---- Compose: base ← linkedin ← github -----------------------------
    // Apply LinkedIn first, then GitHub. LinkedIn is preferred for
    // identity/headline/summary because it's user-curated; GitHub fills in
    // structural data (the github enrichment block, repo list, etc.).
    let merged = mergeProfileBlob(baseProfile, linkedinPatch);
    merged = mergeProfileBlob(merged, githubPatch);

    // Backfill identity-ish fields that no source set yet from the GitHub
    // snapshot. We only fill when the field is still empty so we never
    // overwrite something LinkedIn or the user explicitly provided.
    if (!merged.location && githubRaw?.user?.location) {
      merged = { ...merged, location: githubRaw.user.location };
    }
    if (!merged.headline && githubRaw?.user?.bio) {
      merged = { ...merged, headline: githubRaw.user.bio };
    }

    // ---- Provenance: union of stored + freshly-applied source labels ---
    const mergedProvenance: Record<string, ProvenanceSource> = {
      ...(baseProfile.provenance ?? {}),
    };
    for (const key of Object.keys(linkedinPatch)) {
      if (key === "provenance" || key === "log" || key === "updatedAt") continue;
      mergedProvenance[key] = "linkedin";
    }
    for (const key of Object.keys(githubPatch)) {
      if (key === "provenance" || key === "log" || key === "updatedAt") continue;
      mergedProvenance[key] = "github";
    }
    if (baseProfile.resume) mergedProvenance["resume"] = mergedProvenance["resume"] ?? "resume";
    merged.provenance = mergedProvenance;

    // ---- Attach per-repo + per-experience summaries --------------------
    const githubLogin = merged.github?.username ?? githubRaw?.user?.login;
    const enrichedTopRepos = merged.github
      ? attachRepoSummaries(
          merged.github.topRepos,
          repoSummaryRows as ReadonlyArray<RepoSummaryRow>,
          githubLogin
        )
      : [];
    const enrichedExperience = attachExperienceSummaries(
      merged.experience,
      experienceSummaryRows as ReadonlyArray<ExperienceSummaryRow>
    );

    const assembled: AssembledProfile = {
      ...merged,
      experience: enrichedExperience,
      github: merged.github
        ? { ...merged.github, topRepos: enrichedTopRepos }
        : undefined,
    };

    // Did we actually have anything to merge? If the base row is missing AND
    // there's no GitHub/LinkedIn snapshot AND there's no resume, return null
    // so the caller can short-circuit.
    const hasAnything =
      Boolean(profileRow) ||
      Boolean(githubSnapshotRow) ||
      Boolean(linkedinSnapshotRow) ||
      repoSummaryRows.length > 0 ||
      experienceSummaryRows.length > 0;
    if (!hasAnything) return null;

    return {
      profile: assembled,
      sources: {
        userProfile: Boolean(profileRow),
        github: Boolean(githubSnapshotRow),
        linkedin: Boolean(linkedinSnapshotRow),
        resume: Boolean(baseProfile.resume),
        repoSummaryCount: repoSummaryRows.length,
        experienceSummaryCount: experienceSummaryRows.length,
      },
    };
  },
});
