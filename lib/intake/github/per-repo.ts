import type { FetchedSourceFile, PerRepoEnrichment, Repository } from "@/lib/intake/shared";
import { generateValidatedJson } from "./json";
import { pickModel, type AICredentials } from "./models";
import {
  REPO_SYSTEM_PROMPT,
  repoUserPrompt,
  type RepoPromptInput,
  type RepoSourceFileForPrompt,
} from "./prompts";
import {
  DEFAULT_MAX_TOOL_CALLS,
  summarizeRepoWithExplorer,
  type RepoFileFetcher,
} from "./repo-explorer";
import { RepoSummarySchema, REPO_SCHEMA_HINT, type RepoSummary } from "./types";

/**
 * The cache hash uses a tree SHA derived from the enrichment when available.
 * `RepoPromptInput` (declared in `prompts.ts`) does not carry the SHA, so we
 * intersect it locally to thread the value through `buildPromptInput` →
 * `contentHash` without changing the prompt-renderer contract or the shared
 * Zod-validated `PerRepoEnrichment` schema.
 *
 * The tree SHA comes from the GitHub `getTree` response captured in
 * `lib/intake/github/source-files.ts` and stitched onto the enrichment by
 * `lib/intake/github/extractor.ts` as a non-schema property.
 */
export type RepoPromptInputWithTree = RepoPromptInput & {
  /** Tree SHA from GitHub's `git/getTree` response. */
  treeSha?: string | null;
};

/** Read the (optional, non-schema) `treeSha` field off an enrichment. */
function readTreeSha(enrichment: PerRepoEnrichment | undefined): string | null {
  if (!enrichment) return null;
  const candidate = (enrichment as { treeSha?: unknown }).treeSha;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

export interface SummarizeRepoInput {
  repo: Repository;
  enrichment: PerRepoEnrichment | undefined;
  credentials: AICredentials;
  /**
   * Optional code-explorer fetcher. When `enableToolUse` is also true, Haiku
   * is given list_directory + read_file tools and may explore the repo on
   * demand. When omitted (or when `enableToolUse` is false), the model gets
   * the bulk pre-fetched source bundle in the user prompt and produces a
   * summary in a single shot — no tools.
   */
  repoFileFetcher?: RepoFileFetcher;
  /**
   * Opt-in flag to actually run the tool-use exploration loop. Defaults to
   * false: the bulk pre-fetch from `@gh-app/extractor/fetchSourceFiles`
   * (40 files / 250 KB) is comprehensive enough that tool use just adds
   * latency and variability.
   */
  enableToolUse?: boolean;
  /** Per-summary tool-call cap. Defaults to DEFAULT_MAX_TOOL_CALLS (30). Only meaningful with enableToolUse. */
  maxToolCalls?: number;
}

export async function summarizeRepo({
  repo,
  enrichment,
  credentials,
  repoFileFetcher,
  enableToolUse,
  maxToolCalls,
}: SummarizeRepoInput): Promise<RepoSummary> {
  // `RepoPromptInputWithTree` carries the optional `treeSha` used by the
  // cache hash; the wider type is assignable to `RepoPromptInput` so prompt
  // rendering downstream is unaffected.
  const promptInput: RepoPromptInputWithTree = buildPromptInput(repo, enrichment);
  const tooluseEnabled = enableToolUse === true && !!repoFileFetcher;
  const effectiveMaxToolCalls = maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS;

  if (tooluseEnabled && repoFileFetcher) {
    const { summary } = await summarizeRepoWithExplorer({
      repo,
      enrichment,
      credentials,
      fetcher: repoFileFetcher,
      promptInput,
      maxToolCalls: effectiveMaxToolCalls,
      enableToolUse: true,
    });
    return {
      ...normalizeRepoSummary(summary),
      exploredFiles: summary.exploredFiles ?? [],
      repoFullName: repo.fullName,
      generatedByModel: summary.generatedByModel,
      generatedAt: summary.generatedAt,
      sourceContentHash: contentHash(promptInput, { tooluseEnabled }),
    };
  }

  // Default code path — bulk pre-fetch + single-shot validated JSON. No tools.
  const { model, modelId } = pickModel("fast", credentials);
  const { value } = await generateValidatedJson({
    model,
    system: REPO_SYSTEM_PROMPT,
    prompt: repoUserPrompt(promptInput, { tooluseEnabled: false, maxToolCalls: 0 }),
    schema: RepoSummarySchema,
    schemaHint: REPO_SCHEMA_HINT,
  });
  return {
    ...normalizeRepoSummary(value),
    exploredFiles: [],
    repoFullName: repo.fullName,
    generatedByModel: modelId,
    generatedAt: new Date().toISOString(),
    sourceContentHash: contentHash(promptInput, { tooluseEnabled }),
  };
}

export function buildPromptInput(
  repo: Repository,
  enrichment: PerRepoEnrichment | undefined,
): RepoPromptInputWithTree {
  return {
    fullName: repo.fullName,
    description: repo.description ?? null,
    topics: enrichment?.topics ?? repo.topics,
    language: repo.language ?? null,
    stars: repo.stargazersCount,
    createdAt: repo.createdAt,
    pushedAt: repo.pushedAt ?? undefined,
    readme: enrichment?.readme ?? null,
    manifests: enrichment?.manifests ?? [],
    workflows: enrichment?.workflows ?? [],
    hasDockerfile: enrichment?.hasDockerfile ?? false,
    sourceFiles: toSourceFilesForPrompt(enrichment?.sourceFiles ?? []),
    treeSha: readTreeSha(enrichment),
  };
}

function toSourceFilesForPrompt(files: ReadonlyArray<FetchedSourceFile>): RepoSourceFileForPrompt[] {
  return files.map((f) => ({
    path: f.path,
    language: f.language ?? null,
    bytes: f.bytes,
    content: f.content,
  }));
}

const DIFFICULTY_VALUES = ["beginner", "intermediate", "advanced", "expert"] as const;
const QUALITY_VALUES = ["showcase", "solid", "experimental", "learning"] as const;

// whatItDoes is now the comprehensive code-grounded summary (4-6 sentences).
// Allow ~3000 chars to fit a substantial paragraph; enough for prose without
// runaway model output bloating the cache.
const WHAT_IT_DOES_MAX_CHARS = 3_000;
// metadataSummary is the short README/dependency recap. 600 chars matches the
// previous purposeFromCode cap.
const METADATA_SUMMARY_MAX_CHARS = 600;

function normalizeRepoSummary(o: {
  oneLineDescription: string;
  whatItDoes: string;
  metadataSummary?: string;
  keyTechnologies: string[];
  userContributions: string;
  accomplishments: string[];
  difficulty: string;
  starQuality: string;
  notableImplementationDetails?: string[];
}) {
  const diff = DIFFICULTY_VALUES.find((v) => o.difficulty.toLowerCase().includes(v)) ?? "intermediate";
  const quality = QUALITY_VALUES.find((v) => o.starQuality.toLowerCase().includes(v)) ?? "solid";
  return {
    oneLineDescription: o.oneLineDescription.slice(0, 240) || "(no description)",
    whatItDoes: (o.whatItDoes || "(no description)").slice(0, WHAT_IT_DOES_MAX_CHARS),
    metadataSummary: (o.metadataSummary ?? "").slice(0, METADATA_SUMMARY_MAX_CHARS),
    keyTechnologies: o.keyTechnologies.slice(0, 15),
    userContributions: o.userContributions || "(no contribution summary)",
    accomplishments: o.accomplishments.slice(0, 6),
    difficulty: diff as (typeof DIFFICULTY_VALUES)[number],
    starQuality: quality as (typeof QUALITY_VALUES)[number],
    notableImplementationDetails: (o.notableImplementationDetails ?? []).slice(0, 6),
    // Deprecated fields — kept on the persisted record only for back-compat
    // with the schema. New summaries leave them as empty strings.
    purposeFromCode: "",
    architectureSummary: "",
  };
}

export interface ContentHashOptions {
  /** Was the model allowed to explore via tools? Different mode → different summary. */
  tooluseEnabled: boolean;
}

export function contentHash(
  input: RepoPromptInput | RepoPromptInputWithTree,
  options: ContentHashOptions,
): string {
  // The cache key intentionally drops `pushed_at` in favour of the tree SHA:
  // GitHub's `pushed_at` lags on force pushes, quiet squash merges, and admin
  // edits, which produced stale cached summaries (cf. code review MED finding).
  // The tree SHA changes on any commit regardless of timestamp metadata, so we
  // re-summarize whenever the underlying tree actually changes. We additionally
  // keep `sourceFilesDigest` so edits caught by the bulk pre-fetch invalidate
  // the cache even when the tree fetch came back empty (treeSha = null).
  const treeSha = (input as RepoPromptInputWithTree).treeSha ?? "";
  const composed = [
    input.fullName,
    `tree=${treeSha}`,
    input.readme?.length ?? 0,
    input.manifests.length,
    input.topics.join(","),
    // Include the fetched source files so summaries re-run when code changes.
    // Hash a stable digest of (path|bytes|content) per file.
    sourceFilesDigest(input.sourceFiles),
    // Mode flag — tool-use vs. one-shot summaries are semantically different.
    // We do NOT hash the explored-file set: that's a model decision and would
    // force a re-summarize on every run.
    `toolu=${options.tooluseEnabled ? 1 : 0}`,
    // Bump when the prompt structure or hash composition changes meaningfully
    // so cached summaries produced under the old contract get re-computed.
    // pv=3: switched to RepoGPT-style bulk pre-fetch (40 files / 250 KB) and
    // disabled tool-use by default — every cached summary needs a refresh.
    // pv=4: dropped `pushed_at` from the hash and added the tree SHA so
    // force-push / squash-merge updates invalidate cached summaries reliably.
    `pv=4`,
  ].join("|");
  let h = 2166136261;
  for (let i = 0; i < composed.length; i++) {
    h ^= composed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function sourceFilesDigest(files: ReadonlyArray<RepoSourceFileForPrompt>): string {
  if (files.length === 0) return "no-source";
  // Concatenate path, byte count, and a cheap FNV-1a of the content per file —
  // we don't include raw content (would balloon the hash input) but the
  // per-file content hash + bytes catches edits.
  const parts: string[] = [];
  for (const f of files) {
    parts.push(`${f.path}:${f.bytes}:${fnv1a(f.content)}`);
  }
  return parts.sort().join(",");
}

function fnv1a(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
