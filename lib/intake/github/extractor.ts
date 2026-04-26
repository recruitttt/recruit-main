// extractor — assembles a RawGithubSnapshot from REST + GraphQL + per-repo
// bulk source-file pre-fetch. Direct port of gh-app's packages/extractor entry
// flow; see specs/2026-04-25-recruit-merge-design.md §7.1.
//
// This module exposes:
//   - `runExtraction({ token, perRepoConcurrency })` — top-level entry that is
//     an async generator yielding `ExtractionProgress` events as they happen
//     and producing a `RawGithubSnapshot` as its return value (the third type
//     parameter of `AsyncGenerator`). Callers consume via `for await...of` and
//     pick up the snapshot from the final iterator result's `value`.
//   - `enrichOneRepo` — per-repo helper exported for tests / re-use.
//   - `IntakeAuthError` — thrown when GitHub responds 401/403 to auth-critical
//     calls, so callers can prompt the user to re-authenticate.
//
// Stages emitted:
//   starting → user → social → emails → orgs → repos → enrich-repos → complete

import pLimit from "p-limit";

import { fetchAchievements } from "./achievements";
import {
  getContributionsCollection,
  getExternalMergedPRs,
  getPinnedItems,
  getSponsorships,
  getViewerLogin,
  makeGraphQLClient,
} from "./graphql";
import { MANIFEST_FILE_LIST, parseManifest } from "./manifests";
import {
  getAuthenticatedUser,
  getEmails,
  getGists,
  getOrgs,
  getProfileReadme,
  getRepos,
  getSocialAccounts,
  getStarredSample,
  makeOctokit,
} from "./rest";
import { fetchSourceFiles } from "./source-files";

import type { Octokit } from "@octokit/rest";
import type {
  ManifestParsed,
  PerRepoEnrichment,
  RawGithubSnapshot,
  Release,
  Repository,
} from "@/lib/intake/shared";

/**
 * Thrown when an authoritative GitHub call (current user / emails / orgs)
 * comes back as 401 or 403. Callers should surface this distinctly so the UI
 * can prompt the user to reconnect their GitHub OAuth account rather than
 * showing a generic error.
 */
export class IntakeAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntakeAuthError";
  }
}

export interface ExtractionProgress {
  stage:
    | "starting"
    | "user"
    | "social"
    | "emails"
    | "orgs"
    | "repos"
    | "enrich-repos"
    | "complete";
  message?: string;
  done?: number;
  total?: number;
  /** Optional repo-specific marker for enrich-repos stage. */
  repo?: string;
  /** Severity for UI styling and log filtering. Defaults to info. */
  level?: "info" | "warn" | "error";
}

export interface RunExtractionInput {
  token: string;
  /** Per-repo bulk-fetch concurrency. Defaults to 5. */
  perRepoConcurrency?: number;
  /** Cap on enriched repos. Defaults to 30 (after fork/archive filter). */
  maxRepos?: number;
}

const DEFAULT_PER_REPO_CONCURRENCY = 5;
const DEFAULT_MAX_REPOS_TO_ENRICH = 30;

/**
 * Streaming GitHub extraction. Yields `ExtractionProgress` events as each
 * stage completes and returns the assembled `RawGithubSnapshot` as the
 * generator's final value (consume via `const { value: snapshot } = await
 * iterator.next();` after the loop, or via `yield* runExtraction(...)`).
 *
 * Wraps the three identity-critical REST calls (`getAuthenticatedUser`,
 * `getEmails`, `getOrgs`) so 401/403 responses surface as `IntakeAuthError`.
 */
export async function* runExtraction(
  input: RunExtractionInput,
): AsyncGenerator<ExtractionProgress, RawGithubSnapshot, void> {
  const octokit = makeOctokit(input.token);
  const graphqlClient = makeGraphQLClient(input.token);

  yield { stage: "starting", message: "Authenticating with GitHub" };

  // ---- Stage: user ----
  const user = await callWithAuthErrorMapping(() => getAuthenticatedUser(octokit));
  yield { stage: "user", message: `Loaded user @${user.login}`, done: 1, total: 1 };

  // ---- Stage: social ----
  const socialAccounts = await getSocialAccounts(octokit, user.login);
  yield {
    stage: "social",
    message: `Loaded ${socialAccounts.length} social account${socialAccounts.length === 1 ? "" : "s"}`,
    done: socialAccounts.length,
    total: socialAccounts.length,
  };

  // ---- Stage: emails ----
  const emails = await callWithAuthErrorMapping(() => getEmails(octokit));
  yield {
    stage: "emails",
    message: `Loaded ${emails.length} email${emails.length === 1 ? "" : "s"}`,
    done: emails.length,
    total: emails.length,
  };

  // ---- Stage: orgs ----
  const orgs = await callWithAuthErrorMapping(() => getOrgs(octokit));
  yield {
    stage: "orgs",
    message: `Loaded ${orgs.length} organization${orgs.length === 1 ? "" : "s"}`,
    done: orgs.length,
    total: orgs.length,
  };

  // ---- Stage: repos ----
  const repos = await getRepos(octokit);
  yield {
    stage: "repos",
    message: `Loaded ${repos.length} repositor${repos.length === 1 ? "y" : "ies"}`,
    done: repos.length,
    total: repos.length,
  };

  // ---- Side-quests fetched in parallel with enrichment ----
  // These are independent of per-repo enrichment so we kick them off now and
  // await the whole bundle alongside the enrichment work.
  const [
    pinnedItems,
    contributions,
    pullRequestsToOtherOrgs,
    sponsorships,
    achievements,
    starredSample,
    gists,
    profileReadme,
  ] = await Promise.all([
    getPinnedItems(graphqlClient).catch(() => []),
    getContributionsCollection(graphqlClient).catch(() => undefined),
    Promise.resolve(getViewerLogin(graphqlClient))
      .then((login) => getExternalMergedPRs(graphqlClient, login))
      .catch(() => []),
    getSponsorships(graphqlClient).catch(() => ({ received: [], given: [] })),
    fetchAchievements(user.login).catch(() => []),
    getStarredSample(octokit).catch(() => []),
    getGists(octokit).catch(() => []),
    getProfileReadme(octokit, user.login).catch(() => null),
  ]);

  // ---- Stage: enrich-repos ----
  // Per-repo enrichment runs concurrently via p-limit. We use a small async
  // queue with a single pre-armed signal Promise so the generator can yield
  // each repo's progress event as soon as that repo finishes — without
  // waiting for the whole batch.
  const reposToEnrich = pickReposToEnrich(repos, input.maxRepos ?? DEFAULT_MAX_REPOS_TO_ENRICH);
  const concurrency = input.perRepoConcurrency ?? DEFAULT_PER_REPO_CONCURRENCY;
  const limiter = pLimit(concurrency);
  const enrichmentResults: PerRepoEnrichmentWithTree[] = new Array(reposToEnrich.length);
  const progressQueue: ExtractionProgress[] = [];
  let enrichmentDone = 0;

  // Pre-armed deferred. Workers call `signal.fire()` after pushing to the
  // queue or finishing; the consumer awaits `signal.wait()` then re-arms via
  // `signal.reset()`. Pre-arming closes the race between a worker's
  // notification and the consumer creating its Promise.
  let signal = createSignal();

  const pushProgress = (event: ExtractionProgress): void => {
    progressQueue.push(event);
    signal.fire();
  };

  const enrichmentTasks = reposToEnrich.map((repo, i) =>
    limiter(async () => {
      let enrichment: PerRepoEnrichmentWithTree;
      try {
        enrichment = await enrichOneRepo(octokit, repo, {
          onSourceFilesWarn: (warning) => {
            pushProgress({
              stage: "enrich-repos",
              repo: warning.repoFullName,
              message: warning.message,
              level: "warn",
            });
          },
        });
      } catch {
        enrichment = emptyEnrichment(repo);
      }
      enrichmentResults[i] = enrichment;
      enrichmentDone += 1;
      pushProgress({
        stage: "enrich-repos",
        done: reposToEnrich.length === 0 ? 0 : enrichmentDone,
        total: reposToEnrich.length,
        repo: repo.fullName,
      });
    }),
  );

  const enrichmentDonePromise = Promise.all(enrichmentTasks).finally(() => {
    signal.fire();
  });

  while (enrichmentDone < reposToEnrich.length || progressQueue.length > 0) {
    while (progressQueue.length > 0) {
      yield progressQueue.shift() as ExtractionProgress;
    }
    if (enrichmentDone >= reposToEnrich.length) break;
    await signal.wait();
    signal = createSignal();
  }
  // Surface any error from the enrichment tasks (Promise.all rejects fast).
  await enrichmentDonePromise;

  const snapshot: RawGithubSnapshot = {
    fetchedAt: new Date().toISOString(),
    user,
    socialAccounts,
    emails,
    orgs,
    repos,
    pinnedItems,
    starredSample,
    gists: gists.map((g) => ({
      id: g.id,
      description: g.description ?? null,
      files: g.files,
      htmlUrl: g.htmlUrl,
    })),
    contributions,
    pullRequestsToOtherOrgs,
    reposContributedTo: [],
    sponsorships,
    achievements,
    profileReadme,
    perRepoEnrichment: enrichmentResults,
  };

  yield { stage: "complete", message: "GitHub extraction complete" };
  return snapshot;
}

// ---------------------------------------------------------------------------
// Tiny pre-armed deferred-signal helper. The consumer creates a signal,
// awaits `wait()`, then re-arms via `createSignal()`. Producers call `fire()`
// to wake the consumer. Because the underlying Promise is created up-front
// (not inside the consumer's wait window), notifications that arrive before
// the consumer awaits are not lost.
// ---------------------------------------------------------------------------

interface DeferredSignal {
  wait(): Promise<void>;
  fire(): void;
}

function createSignal(): DeferredSignal {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  let fired = false;
  return {
    wait(): Promise<void> {
      return promise;
    },
    fire(): void {
      if (fired) return;
      fired = true;
      resolve();
    },
  };
}

// ---------------------------------------------------------------------------
// Auth-error mapping. Wraps a single GitHub REST call: if it throws with a
// 401/403 response status, surface a typed `IntakeAuthError` so the UI can
// prompt the user to reconnect. Other errors propagate unchanged.
// ---------------------------------------------------------------------------

async function callWithAuthErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status = extractStatus(err);
    if (status === 401 || status === 403) {
      throw new IntakeAuthError(
        "GitHub token is invalid or expired. Please reconnect your account.",
      );
    }
    throw err;
  }
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const candidate = (err as { status?: unknown }).status;
  return typeof candidate === "number" ? candidate : undefined;
}

// ---------------------------------------------------------------------------
// Per-repo enrichment. Returns the same shape as the gh-app extractor's
// PerRepoEnrichment plus an optional `treeSha` field. The `treeSha` is not
// part of the canonical PerRepoEnrichment Zod schema (so it's stripped on
// re-parse) but it survives in-memory and over the `v.any()` Convex column,
// which is sufficient for the fresh-extraction → cache-key flow that needs it.
// ---------------------------------------------------------------------------

/**
 * Extension marker on the in-memory enrichment object. The cache hash in
 * `per-repo.ts` reads this property via cast to drive content-hash invalidation
 * on tree changes (force pushes, squash merges) that don't update `pushed_at`.
 */
export interface EnrichmentTreeSha {
  /** SHA of the GitHub tree we walked. Null when the tree fetch failed. */
  treeSha?: string | null;
}

export type PerRepoEnrichmentWithTree = PerRepoEnrichment & EnrichmentTreeSha;

export interface EnrichOneRepoOptions {
  /** Optional source-files warning sink. Forwarded to `fetchSourceFiles`. */
  onSourceFilesWarn?: (warning: {
    repoFullName: string;
    message: string;
    bytesIncluded: number;
    filesIncluded: number;
    bytesBudget: number;
  }) => void;
}

export async function enrichOneRepo(
  octokit: Octokit,
  repo: Repository,
  options: EnrichOneRepoOptions = {},
): Promise<PerRepoEnrichmentWithTree> {
  const owner = repo.owner;
  const name = repo.name;
  const defaultBranch = repo.defaultBranch ?? "main";

  const [
    readme,
    languages,
    manifests,
    workflows,
    hasDockerfile,
    releases,
  ] = await Promise.all([
    fetchReadme(octokit, owner, name).catch(() => null),
    fetchLanguages(octokit, owner, name).catch(() => ({})),
    fetchManifests(octokit, owner, name).catch(() => []),
    fetchWorkflows(octokit, owner, name).catch(() => []),
    fetchHasDockerfile(octokit, owner, name).catch(() => false),
    fetchReleases(octokit, owner, name).catch(() => []),
  ]);

  const { files: sourceFiles, treeSha } = await fetchSourceFiles({
    octokit,
    owner,
    repo: name,
    defaultBranch,
    primaryLanguage: repo.language ?? null,
    manifests,
    topics: repo.topics,
    onWarn: options.onSourceFilesWarn
      ? (warning) =>
          options.onSourceFilesWarn?.({
            repoFullName: warning.repoFullName,
            message: warning.message,
            bytesIncluded: warning.bytesIncluded,
            filesIncluded: warning.filesIncluded,
            bytesBudget: warning.bytesBudget,
          })
      : undefined,
  });

  return {
    repo: repo.fullName,
    readme,
    languages,
    topics: repo.topics,
    manifests,
    workflows,
    releases,
    license: repo.license ?? null,
    hasDockerfile,
    sourceFiles,
    treeSha,
  };
}

function emptyEnrichment(repo: Repository): PerRepoEnrichmentWithTree {
  return {
    repo: repo.fullName,
    readme: null,
    languages: {},
    topics: repo.topics,
    manifests: [],
    workflows: [],
    releases: [],
    license: repo.license ?? null,
    hasDockerfile: false,
    sourceFiles: [],
    treeSha: null,
  };
}

// ---------------------------------------------------------------------------
// Per-repo fetch helpers. Tolerant of 404 / 403 / archived-repo errors —
// always return an empty fallback so a single failing repo can't poison the
// whole enrichment pass.
// ---------------------------------------------------------------------------

async function fetchReadme(octokit: Octokit, owner: string, repo: string): Promise<string | null> {
  try {
    const r = await octokit.rest.repos.getReadme({ owner, repo });
    if (typeof r.data.content !== "string") return null;
    return Buffer.from(r.data.content, (r.data.encoding ?? "base64") as BufferEncoding).toString("utf-8");
  } catch {
    return null;
  }
}

async function fetchLanguages(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<Record<string, number>> {
  try {
    const r = await octokit.rest.repos.listLanguages({ owner, repo });
    return r.data as Record<string, number>;
  } catch {
    return {};
  }
}

async function fetchManifests(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<ManifestParsed[]> {
  const out: ManifestParsed[] = [];
  for (const manifest of MANIFEST_FILE_LIST) {
    const content = await fetchFileContent(octokit, owner, repo, manifest.path).catch(() => null);
    if (content === null) continue;
    out.push(parseManifest(manifest.path, manifest.ecosystem, content));
  }
  return out;
}

async function fetchWorkflows(octokit: Octokit, owner: string, repo: string): Promise<string[]> {
  try {
    const r = await octokit.rest.repos.getContent({ owner, repo, path: ".github/workflows" });
    if (!Array.isArray(r.data)) return [];
    const out: string[] = [];
    for (const entry of r.data) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as { type?: unknown; name?: unknown };
      if (e.type !== "file") continue;
      if (typeof e.name !== "string") continue;
      out.push(e.name);
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchHasDockerfile(octokit: Octokit, owner: string, repo: string): Promise<boolean> {
  try {
    await octokit.rest.repos.getContent({ owner, repo, path: "Dockerfile" });
    return true;
  } catch {
    return false;
  }
}

async function fetchReleases(octokit: Octokit, owner: string, repo: string): Promise<Release[]> {
  try {
    const r = await octokit.rest.repos.listReleases({ owner, repo, per_page: 10 });
    return r.data.map((rel) => ({
      tagName: rel.tag_name,
      name: rel.name ?? null,
      publishedAt: rel.published_at ?? null,
      url: rel.html_url,
    }));
  } catch {
    return [];
  }
}

async function fetchFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const r = await octokit.rest.repos.getContent({ owner, repo, path });
    const data = r.data as unknown;
    if (!data || typeof data !== "object") return null;
    if (Array.isArray(data)) return null;
    const file = data as { content?: string; encoding?: string };
    if (typeof file.content !== "string") return null;
    return Buffer.from(file.content, (file.encoding ?? "base64") as BufferEncoding).toString("utf-8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Repo selection — order by recency + popularity, drop forks and archived.
// Mirrors the lightweight scoring used in `runReport`'s `pickRepos`. Capped
// to keep the per-run API budget bounded.
// ---------------------------------------------------------------------------

function pickReposToEnrich(repos: Repository[], max: number): Repository[] {
  const filtered = repos.filter((r) => !r.fork && !r.archived);
  return filtered
    .map((r) => ({
      r,
      score:
        r.stargazersCount * 5 +
        (r.pushedAt ? Date.parse(r.pushedAt) / 1e10 : 0) +
        (r.description ? 5 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.r);
}
