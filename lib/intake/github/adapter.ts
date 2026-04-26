// githubAdapter — IntakeAdapter wrapper around the gh-applicant extraction +
// per-repo summarization pipeline.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §6 + §7.1.
//
// Stages emitted (in order):
//   starting       — selected N repos
//   user           — authenticated user loaded
//   social         — social accounts loaded
//   emails         — verified emails loaded
//   orgs           — orgs loaded
//   repos          — repo list loaded
//   enrich-repos   — per-repo bulk-fetch progress
//   summarize-repos — per-repo Haiku summary progress
//   mapper         — emits final patch + provenance via deriveProjects/Skills/Links
//   complete       — done
//
// The bulk source-file pre-fetch is enabled by default; the tool-use repo
// explorer stays disabled (single-shot summaries are more reliable per spec).
//
// Persistence: snapshot, sharded source files, and per-repo summaries are
// written directly to Convex via `ctx.ctx.runMutation` inside this adapter
// (the events emitted to `intakeRuns` are kept small to fit the 1MB doc cap).

import pLimit from "p-limit";

import { api } from "../../../convex/_generated/api";

import { runExtraction, type ExtractionProgress } from "./extractor";
import { runReport } from "./index";

import { snapshotToProfile } from "@/lib/intake/shared/mapper";
import {
  aggregateLanguages,
  inferTooling,
} from "@/lib/intake/shared/mapper/skills";
import { deriveLinks } from "@/lib/intake/shared/mapper/links";
import { deriveProjects } from "@/lib/intake/shared/mapper/projects";

import type {
  ApplicationProfile,
  IntakeAdapter,
  IntakeContext,
  IntakeProgressEvent,
  Links,
  PerRepoEnrichment,
  ProvenanceSource,
  RawGithubSnapshot,
} from "@/lib/intake/shared";
import type { RepoSummary } from "./types";
import type {
  GitHubEnrichment,
  GitHubRepo,
  ProfileLinks,
  UserProfile,
} from "@/lib/profile";

export interface GithubAdapterInput {
  token: string;
}

const PER_REPO_CONCURRENCY = 5;

export const githubAdapter: IntakeAdapter<GithubAdapterInput> = {
  name: "github",

  async *run(
    input: GithubAdapterInput,
    ctx: IntakeContext,
  ): AsyncIterable<IntakeProgressEvent> {
    yield {
      stage: "starting",
      message: "Starting GitHub intake",
      level: "info",
    };

    // ---- Stage 1: extraction ----
    // Stream extractor events as they happen. The extractor's async generator
    // yields per-stage progress and returns the assembled snapshot as the
    // generator's final value, so we manually drive `next()` to capture both.
    const extractionIterator = runExtraction({
      token: input.token,
      perRepoConcurrency: PER_REPO_CONCURRENCY,
    });
    let snapshot: RawGithubSnapshot;
    for (;;) {
      const next = await extractionIterator.next();
      if (next.done) {
        snapshot = next.value;
        break;
      }
      const event = next.value;
      // The wrapper "starting"/"complete" markers are owned by this adapter.
      if (event.stage === "starting" || event.stage === "complete") continue;
      yield toIntakeEvent(event);
    }

    // Persist sharded source files immediately so that even if AI
    // summarization fails we still have the raw enrichment cached.
    await persistSourceFiles(ctx, snapshot);

    // ---- Stage 2: per-repo summarization (Haiku) ----
    const baseProfile = snapshotToProfile(snapshot);

    const summaryEvents: IntakeProgressEvent[] = [];
    let knownTotal = 0;
    const captureReport = (e: {
      stage: string;
      message?: string;
      done?: number;
      total?: number;
      current?: string;
    }): void => {
      if (e.stage === "summarize-repo") {
        knownTotal = e.total ?? knownTotal;
        summaryEvents.push({
          stage: "summarize-repos",
          done: e.done,
          total: e.total,
          message: e.current ? `Summarized ${e.current}` : undefined,
          data: e.current ? { repo: e.current } : undefined,
        });
      } else if (e.stage === "starting") {
        summaryEvents.push({
          stage: "summarize-repos",
          message: e.message,
          done: 0,
          total: knownTotal,
        });
      }
      // "consolidate" / "complete" / "summarize-experience" come from
      // `runReport` but they belong to the AI-report adapter, not the github
      // intake adapter. We deliberately ignore them here.
    };

    const reportOutput = await runReport({
      snapshot,
      profile: baseProfile,
      credentials: ctx.credentials,
      perRepoConcurrency: PER_REPO_CONCURRENCY,
      onProgress: captureReport,
    });

    for (const event of summaryEvents) {
      yield event;
    }

    // Persist per-repo summaries.
    await persistRepoSummaries(ctx, reportOutput.repoSummaries);

    // Persist the snapshot AFTER summarization (we strip out source files
    // since those live in their own table — keeps the snapshot doc small).
    await persistSnapshot(ctx, snapshot);

    // ---- Stage 3: mapper — emit final patch + provenance ----
    const { patch, provenance } = buildUserProfilePatch(snapshot, baseProfile);

    yield {
      stage: "mapper",
      message: "Built profile patch from GitHub",
      patch,
      provenance,
      data: {
        repoCount: snapshot.repos.length,
        enrichedCount: snapshot.perRepoEnrichment.length,
        summarizedCount: reportOutput.repoSummaries.length,
      },
    };

    yield {
      stage: "complete",
      message: "GitHub intake complete",
      level: "info",
    };
  },
};

// ---------------------------------------------------------------------------
// Stage event mapping (extractor → intake)
// ---------------------------------------------------------------------------

function toIntakeEvent(e: ExtractionProgress): IntakeProgressEvent {
  return {
    stage: e.stage,
    message: e.message,
    done: e.done,
    total: e.total,
    level: e.level,
    data: e.repo ? { repo: e.repo } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Convex persistence helpers
// ---------------------------------------------------------------------------

async function persistSnapshot(
  ctx: IntakeContext,
  snapshot: RawGithubSnapshot,
): Promise<void> {
  const compact: RawGithubSnapshot = {
    ...snapshot,
    perRepoEnrichment: snapshot.perRepoEnrichment.map(stripSourceFilesFromEnrichment),
  };
  await ctx.ctx.runMutation(api.githubSnapshots.save, {
    userId: ctx.userId,
    raw: compact,
  } as never);
}

// Convex mutations are independent (each writes to a unique document keyed by
// `repoFullName`), so we fan them out concurrently. A small p-limit cap keeps
// us within Convex's per-action mutation budget and avoids hammering the
// transport layer when the enrichment set is large.
const PERSIST_MUTATION_CONCURRENCY = 6;

async function persistSourceFiles(
  ctx: IntakeContext,
  snapshot: RawGithubSnapshot,
): Promise<void> {
  const items = snapshot.perRepoEnrichment.filter((e) => e.sourceFiles.length > 0);
  if (items.length === 0) return;
  const limiter = pLimit(PERSIST_MUTATION_CONCURRENCY);
  await Promise.all(
    items.map((enrichment) =>
      limiter(() =>
        ctx.ctx.runMutation(api.repoSourceFiles.save, {
          userId: ctx.userId,
          repoFullName: enrichment.repo,
          files: enrichment.sourceFiles,
        } as never),
      ),
    ),
  );
}

async function persistRepoSummaries(
  ctx: IntakeContext,
  summaries: ReadonlyArray<RepoSummary>,
): Promise<void> {
  if (summaries.length === 0) return;
  const limiter = pLimit(PERSIST_MUTATION_CONCURRENCY);
  await Promise.all(
    summaries.map((summary) =>
      limiter(() =>
        ctx.ctx.runMutation(api.repoSummaries.upsert, {
          userId: ctx.userId,
          repoFullName: summary.repoFullName,
          sourceContentHash: summary.sourceContentHash,
          summary,
          generatedByModel: summary.generatedByModel,
          generatedAt: summary.generatedAt,
        } as never),
      ),
    ),
  );
}

function stripSourceFilesFromEnrichment(e: PerRepoEnrichment): PerRepoEnrichment {
  return { ...e, sourceFiles: [] };
}

// ---------------------------------------------------------------------------
// Build the Partial<UserProfile> patch + provenance map.
//
// The shared mapper (`snapshotToProfile`) returns a rich `ApplicationProfile`
// (gh-app shape). The recruit-main `UserProfile` (lib/profile.ts) is a
// simpler shape, so we adapt: identity → name, contact.email → email,
// links → links, projects → github.topRepos, skills.languages →
// skills (string[]), etc.
// ---------------------------------------------------------------------------

interface BuiltPatch {
  patch: Partial<UserProfile>;
  provenance: Record<string, ProvenanceSource>;
}

function buildUserProfilePatch(
  snapshot: RawGithubSnapshot,
  applicationProfile: ApplicationProfile,
): BuiltPatch {
  const provenance: Record<string, ProvenanceSource> = {};

  // ---- name ----
  const name = composeFullName(applicationProfile);
  if (name) provenance["name"] = "github";

  // ---- email ----
  const email = applicationProfile.contact.email || undefined;
  if (email) provenance["email"] = "github";

  // ---- location ----
  const location = snapshot.user.location ?? undefined;
  if (location) provenance["location"] = "github";

  // ---- headline / summary ----
  const headline = snapshot.user.bio ?? undefined;
  const summary = snapshot.profileReadme
    ? truncate(snapshot.profileReadme, 4_000)
    : undefined;
  if (headline) provenance["headline"] = "github";
  if (summary) provenance["summary"] = "github";

  // ---- links ----
  const linksFromMapper = deriveLinks(snapshot);
  const links = toUserProfileLinks(linksFromMapper);
  if (Object.keys(links).length > 0) provenance["links"] = "github";

  // ---- skills (UserProfile.skills is a flat string[]) ----
  const aggregatedLanguages = aggregateLanguages(snapshot.repos, snapshot.perRepoEnrichment);
  const tooling = inferTooling(snapshot.perRepoEnrichment);
  const skills = uniqueStrings([
    ...aggregatedLanguages.map((l) => l.name),
    ...applicationProfile.skills.frameworks.map((f) => f.name),
    ...tooling.tools,
    ...tooling.cloudPlatforms,
    ...applicationProfile.skills.databases,
  ]).slice(0, 30);
  if (skills.length > 0) provenance["skills"] = "github";

  // ---- github enrichment block ----
  const topRepos: GitHubRepo[] = deriveProjects(
    snapshot.repos,
    snapshot.pinnedItems,
    snapshot.perRepoEnrichment,
  ).map((p) => ({
    name: p.name,
    description: p.description,
    language: p.technologies?.[0],
    stars: p.metrics?.stars,
    url: p.repoUrl ?? p.url ?? `https://github.com/${snapshot.user.login}/${p.name}`,
  }));

  const github: GitHubEnrichment = {
    username: snapshot.user.login,
    bio: snapshot.user.bio ?? undefined,
    company: snapshot.user.company ?? undefined,
    publicRepos: snapshot.user.publicRepos,
    followers: snapshot.user.followers,
    topRepos,
  };
  provenance["github"] = "github";

  const patch: Partial<UserProfile> = {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(location ? { location } : {}),
    ...(headline ? { headline } : {}),
    ...(summary ? { summary } : {}),
    ...(Object.keys(links).length > 0 ? { links } : {}),
    ...(skills.length > 0 ? { skills } : {}),
    github,
  };

  return { patch, provenance };
}

function composeFullName(profile: ApplicationProfile): string | undefined {
  const parts = [
    profile.identity.legalFirstName,
    profile.identity.legalMiddleName,
    profile.identity.legalLastName,
  ].filter((p): p is string => Boolean(p && p.trim()));
  const composed = parts.join(" ").trim();
  if (composed) return composed;
  return profile.identity.preferredName?.trim() || undefined;
}

function toUserProfileLinks(rich: Links): ProfileLinks {
  const out: ProfileLinks = {};
  if (rich.github) out.github = rich.github;
  if (rich.linkedin) out.linkedin = rich.linkedin;
  if (rich.twitter) out.twitter = rich.twitter;
  if (rich.personalWebsite) out.website = rich.personalWebsite;
  else if (rich.portfolio) out.website = rich.portfolio;
  else if (rich.blog) out.website = rich.blog;
  return out;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}
