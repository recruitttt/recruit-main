import type { FetchedSourceFile, PerRepoEnrichment, Repository } from "@/lib/intake/shared";
import { generateText, stepCountIs, tool, type LanguageModel, type ToolSet } from "ai";
import { z } from "zod";
import { generateValidatedJson, JsonGenerationError } from "./json";
import { pickModel, type AICredentials } from "./models";
import {
  REPO_SYSTEM_PROMPT,
  REPO_TOOLUSE_SYSTEM_PROMPT,
  repoUserPrompt,
  type RepoPromptInput,
} from "./prompts";
import { RepoSummarySchema, REPO_SCHEMA_HINT, type RepoSummary } from "./types";

// ---------------------------------------------------------------------------
// Public types — interface used by the (optional) tool-use explorer to load
// directory listings and file content from a repo. The bulk pre-fetch flow
// produced by @gh-app/extractor's `fetchSourceFiles` is the default and does
// not need a fetcher; the tool-use loop is opt-in via `enableToolUse: true`.
// Implementations live in app code (e.g. an Octokit adapter in the Next.js
// app). Errors must be returned as { error } strings, not thrown — Anthropic's
// tool-use loop handles error strings gracefully but blows up on uncaught
// throws.
// ---------------------------------------------------------------------------

export interface DirEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule" | "other";
}

export type ReadFileResult =
  | { content: string; bytes: number; truncated: boolean }
  | { error: string };

export type ListDirectoryResult =
  | { entries: DirEntry[] }
  | { error: string };

export interface RepoFileFetcher {
  /** List entries for a path within `repoFullName` ("owner/repo"). */
  listDirectory(repoFullName: string, path: string): Promise<ListDirectoryResult>;
  /** Read up to MAX_TOOL_FILE_BYTES of a file's UTF-8 content. */
  readFile(repoFullName: string, path: string): Promise<ReadFileResult>;
}

// Cap on bytes returned per `read_file` call. Mirrors the extractor's larger
// per-file cap for dense files (manifests/docs).
export const MAX_TOOL_FILE_BYTES = 16_000;

// Default per-summary tool-call cap when tool use is explicitly enabled.
export const DEFAULT_MAX_TOOL_CALLS = 30;

// Minimum number of read_file calls the model must make before producing a
// summary, when source files OR a fetcher are available. Mirrors the
// guidance baked into REPO_TOOLUSE_SYSTEM_PROMPT.
const REQUIRED_READ_FILE_CALLS = 1;
// Minimum length (in characters) for whatItDoes when source/fetcher available.
// The 4-6 sentence comprehensive summary should comfortably exceed this.
const REQUIRED_WHAT_IT_DOES_LENGTH = 400;

// ---------------------------------------------------------------------------
// Shared filtering helpers — kept in lockstep with packages/extractor/src/source-files.ts
// so the (optional) explorer doesn't waste tool calls on lockfiles, build
// artifacts, etc.
// ---------------------------------------------------------------------------

const SKIP_PATH_FRAGMENTS: ReadonlyArray<string> = [
  "node_modules/",
  "/dist/",
  "/build/",
  "/coverage/",
  "/.github/",
  "/.git/",
  "/.vscode/",
  "/.idea/",
  "/.next/",
  "/out/",
  "/target/",
  "/vendor/",
  "/.venv/",
  "/__pycache__/",
  ".min.js",
  ".min.css",
  ".lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "go.sum",
  "poetry.lock",
];

export function shouldSkipPath(path: string): boolean {
  const normalized = `/${path}`;
  return SKIP_PATH_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

// Cheap binary-content heuristic — same as the extractor's. Used by fetchers
// to drop responses that look like binary blobs before they reach the model.
export function looksBinary(text: string): boolean {
  const sample = text.slice(0, 1024);
  if (sample.includes(" ")) return true;
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || code === 127) nonPrintable += 1;
  }
  return nonPrintable / Math.max(1, sample.length) > 0.2;
}

// ---------------------------------------------------------------------------
// Explorer entry point.
//
// By default this NOW behaves as a single-shot summarization that relies on
// the bulk pre-fetched source bundle from `@gh-app/extractor/fetchSourceFiles`
// (40 files / 250 KB / RepoGPT-style ignore list). The tool-use loop is opt-in
// via `enableToolUse: true` because in practice Haiku frequently chose NOT to
// call tools, leaving summaries shallow.
// ---------------------------------------------------------------------------

export interface SummarizeRepoWithExplorerInput {
  repo: Repository;
  enrichment: PerRepoEnrichment | undefined;
  credentials: AICredentials;
  fetcher: RepoFileFetcher;
  promptInput: RepoPromptInput;
  maxToolCalls?: number;
  /**
   * Opt-in flag to actually run the tool-use exploration loop. Defaults to
   * false: the model is given the comprehensive bulk pre-fetch bundle in the
   * user prompt and asked to produce JSON in one shot, with no tools.
   */
  enableToolUse?: boolean;
}

export interface SummarizeRepoWithExplorerOutput {
  summary: RepoSummary;
}

const ListDirInputSchema = z.object({
  path: z.string().describe(
    "Repo-relative directory path. Use \"\" for the repo root. No leading slash. Example: \"src\" or \"src/components\".",
  ),
});

const ReadFileInputSchema = z.object({
  path: z.string().describe(
    "Repo-relative file path. No leading slash. Example: \"src/index.ts\" or \"package.json\". Returns up to ~16 KB of UTF-8 text.",
  ),
});

interface ExplorerRunResult {
  text: string;
  exploredFiles: string[];
}

export async function summarizeRepoWithExplorer(
  input: SummarizeRepoWithExplorerInput,
): Promise<SummarizeRepoWithExplorerOutput> {
  const { repo, credentials, fetcher, promptInput } = input;
  const enableToolUse = input.enableToolUse === true;
  const maxToolCalls = input.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS;

  const { model, modelId } = pickModel("fast", credentials);

  // Default path: bulk pre-fetch is comprehensive, do a single-shot validated
  // JSON generation and return. No tool use, no retry loop, no quality
  // rejection — the extractor already sampled a representative cross-section.
  if (!enableToolUse) {
    return {
      summary: await fallbackOneShot({ repo, credentials, promptInput, modelId }),
    };
  }

  // Opt-in tool-use path. Same behaviour as before.
  const firstAttempt = await runExplorerLoop({
    model: model as LanguageModel,
    fetcher,
    repoFullName: repo.fullName,
    promptInput,
    maxToolCalls,
    reformatHint: undefined,
  });
  if (firstAttempt === null) {
    return {
      summary: await fallbackOneShot({ repo, credentials, promptInput, modelId }),
    };
  }

  const hasPrefetchedSource = promptInput.sourceFiles.length > 0;
  const sourceAvailable = hasPrefetchedSource;

  const parsedFirst = tryParseSummary(firstAttempt.text);
  if (parsedFirst) {
    const reason = checkQualityRejection({
      summary: parsedFirst,
      exploredFiles: firstAttempt.exploredFiles,
      sourceAvailable,
    });
    if (!reason) {
      return {
        summary: buildRepoSummary(repo, modelId, parsedFirst, firstAttempt.exploredFiles),
      };
    }
    const retryHint = buildRetryHint(reason);
    const retry = await runExplorerLoop({
      model: model as LanguageModel,
      fetcher,
      repoFullName: repo.fullName,
      promptInput,
      maxToolCalls,
      reformatHint: retryHint,
      previousExploredFiles: firstAttempt.exploredFiles,
    });
    if (retry !== null) {
      const retryParsed = tryParseSummary(retry.text);
      if (retryParsed) {
        return {
          summary: buildRepoSummary(repo, modelId, retryParsed, retry.exploredFiles),
        };
      }
    }
  } else {
    const reformatted = await reformatToSchema({
      model: model as LanguageModel,
      badText: firstAttempt.text,
    });
    if (reformatted) {
      return {
        summary: buildRepoSummary(repo, modelId, reformatted, firstAttempt.exploredFiles),
      };
    }
    const retry = await runExplorerLoop({
      model: model as LanguageModel,
      fetcher,
      repoFullName: repo.fullName,
      promptInput,
      maxToolCalls,
      reformatHint:
        "Your previous response was not valid JSON for the required schema. This time, after exploring the code, output ONE JSON object only — begin with { and end with }, no prose, no markdown fences.",
      previousExploredFiles: firstAttempt.exploredFiles,
    });
    if (retry !== null) {
      const retryParsed = tryParseSummary(retry.text);
      if (retryParsed) {
        return {
          summary: buildRepoSummary(repo, modelId, retryParsed, retry.exploredFiles),
        };
      }
    }
  }

  const fallback = await fallbackOneShot({ repo, credentials, promptInput, modelId });
  return {
    summary: { ...fallback, exploredFiles: firstAttempt.exploredFiles },
  };
}

// ---------------------------------------------------------------------------
// Explorer loop — wraps generateText with the list_directory + read_file
// tools, an explored-files tracker, and a tool-call cap. Returns null on
// hard failure (exception during generateText) so the caller can fall back.
// Only invoked when enableToolUse is set.
// ---------------------------------------------------------------------------

interface RunExplorerLoopArgs {
  model: LanguageModel;
  fetcher: RepoFileFetcher;
  repoFullName: string;
  promptInput: RepoPromptInput;
  maxToolCalls: number;
  reformatHint?: string;
  previousExploredFiles?: ReadonlyArray<string>;
}

async function runExplorerLoop(args: RunExplorerLoopArgs): Promise<ExplorerRunResult | null> {
  const exploredFiles: string[] = [...(args.previousExploredFiles ?? [])];
  let toolCallsUsed = 0;

  const tools = {
    list_directory: tool({
      description:
        "List the contents of a directory inside the current repository. Returns an array of { name, path, type }. Use this to discover what files exist before requesting them. Always call list_directory(\"\") first to see the full project layout.",
      inputSchema: ListDirInputSchema,
      execute: async ({ path }: { path: string }): Promise<ListDirectoryResult & { _toolCallsUsed: number }> => {
        toolCallsUsed += 1;
        if (toolCallsUsed > args.maxToolCalls) {
          return { error: "tool call limit reached", _toolCallsUsed: toolCallsUsed };
        }
        try {
          const r = await args.fetcher.listDirectory(args.repoFullName, normalizePath(path));
          if ("error" in r) return { ...r, _toolCallsUsed: toolCallsUsed };
          const filtered = r.entries.filter((e) => !shouldSkipPath(e.path));
          return { entries: filtered, _toolCallsUsed: toolCallsUsed };
        } catch (e) {
          return { error: errorMessage(e), _toolCallsUsed: toolCallsUsed };
        }
      },
    }),
    read_file: tool({
      description:
        "Read the UTF-8 contents of a file inside the current repository. Returns { content, bytes, truncated } or { error }. Content is capped at ~16 KB. You MUST call read_file at least 3 times on files NOT in the pre-fetched bundle before producing the summary.",
      inputSchema: ReadFileInputSchema,
      execute: async ({ path }: { path: string }): Promise<ReadFileResult & { _toolCallsUsed: number }> => {
        toolCallsUsed += 1;
        if (toolCallsUsed > args.maxToolCalls) {
          return { error: "tool call limit reached", _toolCallsUsed: toolCallsUsed };
        }
        const cleaned = normalizePath(path);
        if (!cleaned) return { error: "empty path", _toolCallsUsed: toolCallsUsed };
        if (shouldSkipPath(cleaned)) return { error: "path is on the skip list (lockfile / build artifact)", _toolCallsUsed: toolCallsUsed };
        try {
          const r = await args.fetcher.readFile(args.repoFullName, cleaned);
          if ("error" in r) return { ...r, _toolCallsUsed: toolCallsUsed };
          if (!exploredFiles.includes(cleaned)) exploredFiles.push(cleaned);
          return { ...r, _toolCallsUsed: toolCallsUsed };
        } catch (e) {
          return { error: errorMessage(e), _toolCallsUsed: toolCallsUsed };
        }
      },
    }),
  } satisfies ToolSet;

  const userPrompt = repoUserPrompt(args.promptInput, {
    tooluseEnabled: true,
    maxToolCalls: args.maxToolCalls,
    reformatHint: args.reformatHint,
  });

  try {
    const result = await generateText({
      model: args.model,
      system: REPO_TOOLUSE_SYSTEM_PROMPT,
      prompt: userPrompt,
      tools,
      stopWhen: stepCountIs(args.maxToolCalls + 2),
    });
    return { text: result.text.trim(), exploredFiles };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Quality validation — separate from schema validation. Catches the case
// where the model returned valid JSON but didn't actually explore code or
// wrote a thin metadata-only whatItDoes. Only used in the tool-use path.
// ---------------------------------------------------------------------------

type QualityRejection =
  | { kind: "no-files-explored" }
  | { kind: "what-it-does-too-short"; length: number };

function checkQualityRejection(args: {
  summary: z.input<typeof RepoSummarySchema>;
  exploredFiles: ReadonlyArray<string>;
  sourceAvailable: boolean;
}): QualityRejection | null {
  if (!args.sourceAvailable) return null;
  if (args.exploredFiles.length < REQUIRED_READ_FILE_CALLS) {
    return { kind: "no-files-explored" };
  }
  const len = (args.summary.whatItDoes ?? "").length;
  if (len < REQUIRED_WHAT_IT_DOES_LENGTH) {
    return { kind: "what-it-does-too-short", length: len };
  }
  return null;
}

function buildRetryHint(reason: QualityRejection): string {
  switch (reason.kind) {
    case "no-files-explored":
      return [
        `Your previous attempt produced a summary WITHOUT reading any source files via read_file.`,
        `That is a failure of the task. This time you MUST:`,
        `  1. Call list_directory("") to see the project layout.`,
        `  2. Call read_file at least 3 times on source files (entry points, public APIs, core modules) NOT already in the pre-fetched bundle.`,
        `  3. Use what you learned from those files to write a substantive whatItDoes (4-6 sentences, MIN 400 chars).`,
      ].join("\n");
    case "what-it-does-too-short":
      return [
        `Your previous whatItDoes was only ${reason.length} characters — too short.`,
        `This time, write 4-6 sentences (MIN 400 chars) that COMPREHENSIVELY describe what the code does, the architectural shape, key abstractions, and notable implementation choices — all grounded in source files you actually read.`,
        `Read MORE source files via read_file if needed to support the longer summary.`,
      ].join("\n");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePath(p: string): string {
  let out = p.trim();
  while (out.startsWith("/")) out = out.slice(1);
  while (out.endsWith("/")) out = out.slice(0, -1);
  if (out === "." || out === "./") return "";
  return out;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 200);
  return String(e).slice(0, 200);
}

function tryParseSummary(text: string): z.input<typeof RepoSummarySchema> | null {
  const candidate = extractJsonObject(text);
  try {
    const parsed = JSON.parse(candidate);
    return RepoSummarySchema.parse(parsed);
  } catch {
    return null;
  }
}

function extractJsonObject(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fence?.[1]) return fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

async function reformatToSchema(args: {
  model: LanguageModel;
  badText: string;
}): Promise<z.input<typeof RepoSummarySchema> | null> {
  try {
    const r = await generateText({
      model: args.model,
      system: REPO_SYSTEM_PROMPT,
      prompt: [
        "Your previous answer was not valid JSON for the required schema.",
        "Reformat the content below as a SINGLE JSON object matching the shape:",
        REPO_SCHEMA_HINT,
        "",
        "IMPORTANT: respond with ONE JSON object. No prose. No markdown fences. Begin with { and end with }.",
        "",
        "Content to reformat:",
        args.badText.slice(0, 8_000),
      ].join("\n"),
    });
    return tryParseSummary(r.text);
  } catch {
    return null;
  }
}

async function fallbackOneShot(args: {
  repo: Repository;
  credentials: AICredentials;
  promptInput: RepoPromptInput;
  modelId: string;
}): Promise<RepoSummary> {
  const { model } = pickModel("fast", args.credentials);
  try {
    const { value } = await generateValidatedJson({
      model,
      system: REPO_SYSTEM_PROMPT,
      prompt: repoUserPrompt(args.promptInput, { tooluseEnabled: false, maxToolCalls: 0 }),
      schema: RepoSummarySchema,
      schemaHint: REPO_SCHEMA_HINT,
    });
    return buildRepoSummary(args.repo, args.modelId, value, []);
  } catch (e) {
    if (e instanceof JsonGenerationError) throw e;
    throw e;
  }
}

function buildRepoSummary(
  repo: Repository,
  modelId: string,
  fields: z.input<typeof RepoSummarySchema>,
  exploredFiles: ReadonlyArray<string>,
): RepoSummary {
  return {
    oneLineDescription: fields.oneLineDescription,
    whatItDoes: fields.whatItDoes,
    metadataSummary: fields.metadataSummary ?? "",
    keyTechnologies: fields.keyTechnologies,
    userContributions: fields.userContributions,
    accomplishments: fields.accomplishments,
    difficulty: fields.difficulty,
    starQuality: fields.starQuality,
    notableImplementationDetails: fields.notableImplementationDetails ?? [],
    exploredFiles: dedupePreserveOrder(exploredFiles),
    purposeFromCode: fields.purposeFromCode ?? "",
    architectureSummary: fields.architectureSummary ?? "",
    repoFullName: repo.fullName,
    generatedByModel: modelId,
    generatedAt: new Date().toISOString(),
    sourceContentHash: "",
  };
}

function dedupePreserveOrder(items: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (seen.has(it)) continue;
    seen.add(it);
    out.push(it);
  }
  return out;
}

export type { RepoPromptInput };
export type { FetchedSourceFile };
