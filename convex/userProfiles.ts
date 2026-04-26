/* eslint-disable @typescript-eslint/no-explicit-any */
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
