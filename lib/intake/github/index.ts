import pLimit from "p-limit";
import type { LinkedInSnapshot } from "@/lib/intake/linkedin";
import { dedupeLinkedInExperiences } from "@/lib/intake/linkedin/experience-dedupe";
import type { ApplicationProfile, RawGithubSnapshot, Repository } from "@/lib/intake/shared";
import { consolidateReport } from "./consolidate";
import { detectCredentials, type AICredentials } from "./models";
import { buildPromptInput, contentHash, summarizeRepo } from "./per-repo";
import { experienceContentHash, experienceKey, summarizeExperience } from "./per-experience";
import { DEFAULT_MAX_TOOL_CALLS, type RepoFileFetcher } from "./repo-explorer";
import {
  type ConsolidatedReport,
  type ExperienceSummary,
  type ReportProgress,
  type RepoSummary,
} from "./types";
import type { ConsolidatePromptInput } from "./prompts";

export * from "./types";
export { detectCredentials } from "./models";
export { experienceKey } from "./per-experience";
export {
  DEFAULT_MAX_TOOL_CALLS,
  MAX_TOOL_FILE_BYTES,
  looksBinary,
  shouldSkipPath,
  type DirEntry,
  type ListDirectoryResult,
  type ReadFileResult,
  type RepoFileFetcher,
} from "./repo-explorer";

export interface RunReportInput {
  snapshot: RawGithubSnapshot;
  profile: ApplicationProfile;
  linkedinSnapshot?: LinkedInSnapshot;
  cachedRepoSummaries?: RepoSummary[];
  cachedExperienceSummaries?: ExperienceSummary[];
  credentials?: AICredentials | null;
  maxRepos?: number;
  perRepoConcurrency?: number;
  perExperienceConcurrency?: number;
  forceResummarize?: boolean;
  onProgress?: (event: ReportProgress) => void;
  /**
   * Optional code-explorer fetcher. Only used when `enableRepoToolUse` is also
   * true. The function is called once per repo so each summary gets a fresh
   * per-call counter. When omitted (or when tool use is disabled, which is
   * the default), the model is given the bulk pre-fetched source bundle from
   * `@gh-app/extractor/fetchSourceFiles` (40 files / 250 KB) and produces a
   * summary in a single shot — no tools.
   */
  repoFileFetcher?: (repoFullName: string) => RepoFileFetcher;
  /**
   * Opt-in flag to actually run the per-repo tool-use exploration loop.
   * Defaults to false: empirically Haiku frequently chose NOT to call tools
   * even when available, leaving summaries shallow. The bulk pre-fetch path
   * is more reliable.
   */
  enableRepoToolUse?: boolean;
  /** Per-summary tool-call cap. Defaults to DEFAULT_MAX_TOOL_CALLS (30). Only used when enableRepoToolUse is true. */
  maxRepoToolCalls?: number;
}

export interface RunReportOutput {
  repoSummaries: RepoSummary[];
  experienceSummaries: ExperienceSummary[];
  report: ConsolidatedReport;
  consolidatePromptInput: ConsolidatePromptInput;
  reusedRepoSummaries: number;
  newRepoSummaries: number;
  reusedExperienceSummaries: number;
  newExperienceSummaries: number;
}

export async function runReport(input: RunReportInput): Promise<RunReportOutput> {
  const credentials = input.credentials ?? detectCredentials();
  if (!credentials) throw new Error("No AI credentials configured (set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY).");
  const emit = input.onProgress ?? (() => undefined);

  const repos = pickRepos(input.snapshot.repos, input.maxRepos ?? 12);
  emit({ stage: "starting", message: `Selected ${repos.length} repos for analysis` });

  // ---- Parallel: per-repo summaries ----
  const enrichmentByRepo = new Map(input.snapshot.perRepoEnrichment.map((e) => [e.repo, e]));
  const repoCacheByName = new Map((input.cachedRepoSummaries ?? []).map((s) => [s.repoFullName, s]));

  const repoLimit = pLimit(input.perRepoConcurrency ?? 4);
  const repoResults: RepoSummary[] = new Array(repos.length);
  let repoReused = 0;
  let repoFresh = 0;
  let repoDone = 0;

  const tooluseEnabled = input.enableRepoToolUse === true && !!input.repoFileFetcher;
  const maxRepoToolCalls = input.maxRepoToolCalls ?? DEFAULT_MAX_TOOL_CALLS;

  await Promise.all(
    repos.map((repo, i) =>
      repoLimit(async () => {
        const enrichment = enrichmentByRepo.get(repo.fullName);
        // Use the shared prompt-input builder so the hash includes everything
        // the prompt sees, including fetched source files. The tool-use mode
        // is folded into the hash because explorer-on vs. -off summaries are
        // semantically different.
        const expectedHash = contentHash(buildPromptInput(repo, enrichment), { tooluseEnabled });
        const cached = repoCacheByName.get(repo.fullName);
        let summary: RepoSummary;
        if (!input.forceResummarize && cached && cached.sourceContentHash === expectedHash) {
          summary = cached;
          repoReused += 1;
        } else {
          // Build a fresh per-repo fetcher so the per-summary tool-call cap
          // resets. Only meaningful when tool use is explicitly enabled —
          // otherwise the model gets the bulk pre-fetched source bundle in
          // the prompt and ignores the fetcher.
          const repoFileFetcher = tooluseEnabled
            ? input.repoFileFetcher?.(repo.fullName)
            : undefined;
          summary = await summarizeRepo({
            repo,
            enrichment,
            credentials,
            repoFileFetcher,
            enableToolUse: tooluseEnabled,
            maxToolCalls: maxRepoToolCalls,
          });
          repoFresh += 1;
        }
        repoResults[i] = summary;
        repoDone += 1;
        emit({ stage: "summarize-repo", done: repoDone, total: repos.length, current: repo.fullName });
      }),
    ),
  );

  // ---- Parallel: per-experience summaries ----
  const experiences = dedupeLinkedInExperiences(input.linkedinSnapshot?.experiences ?? []);
  const expCacheByKey = new Map((input.cachedExperienceSummaries ?? []).map((s) => [s.experienceKey, s]));
  const expLimit = pLimit(input.perExperienceConcurrency ?? 4);
  const expResults: ExperienceSummary[] = new Array(experiences.length);
  let expReused = 0;
  let expFresh = 0;
  let expDone = 0;

  if (experiences.length > 0) {
    emit({ stage: "summarize-experience", done: 0, total: experiences.length, current: "" });
  }

  await Promise.all(
    experiences.map((experience, i) =>
      expLimit(async () => {
        const key = experienceKey(experience);
        const expectedHash = experienceContentHash(experience);
        const cached = expCacheByKey.get(key);
        let summary: ExperienceSummary;
        if (!input.forceResummarize && cached && cached.sourceContentHash === expectedHash) {
          summary = cached;
          expReused += 1;
        } else {
          summary = await summarizeExperience({ experience, credentials });
          expFresh += 1;
        }
        expResults[i] = summary;
        expDone += 1;
        emit({
          stage: "summarize-experience",
          done: expDone,
          total: experiences.length,
          current: `${summary.position} @ ${summary.company}`,
        });
      }),
    ),
  );

  // ---- Consolidator (single Sonnet call across both sources) ----
  emit({
    stage: "consolidate",
    message: experiences.length > 0
      ? "Synthesizing comprehensive profile (GitHub + LinkedIn)"
      : "Synthesizing comprehensive profile (GitHub only)",
  });

  const totalStars = input.snapshot.repos.reduce((s, r) => s + r.stargazersCount, 0);
  const accountAgeYears = input.snapshot.user.createdAt
    ? Math.floor((Date.now() - Date.parse(input.snapshot.user.createdAt)) / (365 * 24 * 3600 * 1000))
    : undefined;

  const { report, promptInput } = await consolidateReport({
    profile: input.profile,
    repoSummaries: repoResults,
    experienceSummaries: expResults,
    linkedinSnapshot: input.linkedinSnapshot,
    repoMetrics: Object.fromEntries(
      repos.map((r) => [r.fullName, { stars: r.stargazersCount, pushedAt: r.pushedAt ?? undefined }]),
    ),
    accountAgeYears,
    totalStars,
    pinnedRepoCount: input.snapshot.pinnedItems.length,
    sponsorsReceived: input.snapshot.sponsorships.received.length,
    achievementsCount: input.snapshot.achievements.length,
    credentials,
  });

  emit({ stage: "complete", message: "Report generated" });
  return {
    repoSummaries: repoResults,
    experienceSummaries: expResults,
    report,
    consolidatePromptInput: promptInput,
    reusedRepoSummaries: repoReused,
    newRepoSummaries: repoFresh,
    reusedExperienceSummaries: expReused,
    newExperienceSummaries: expFresh,
  };
}

function pickRepos(repos: Repository[], max: number): Repository[] {
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
