import pLimit from "p-limit";
import type { Octokit } from "@octokit/rest";
import type { FetchedSourceFile, ManifestParsed, Repository } from "@/lib/intake/shared";

/**
 * Optional warning sink. The fetcher emits `truncated-by-byte-budget` once
 * per repo when the bulk pre-fetch had to drop candidate files because the
 * 250 KB total-byte budget was exhausted before MAX_FILES was reached.
 */
export interface SourceFilesWarning {
  kind: "truncated-by-byte-budget";
  repoFullName: string;
  message: string;
  /** Bytes actually included in the bundle. */
  bytesIncluded: number;
  /** Files actually included. */
  filesIncluded: number;
  /** Hard total-bytes cap for the bundle. */
  bytesBudget: number;
}

export interface FetchSourceFilesInput {
  octokit: Octokit;
  owner: string;
  repo: string;
  defaultBranch: string;
  primaryLanguage: string | null;
  manifests: ManifestParsed[];
  topics: string[];
  /**
   * Synchronous callback invoked when the pre-fetch was truncated by the
   * total-byte budget rather than the file-count cap. Used by the extractor
   * to surface a warn-level progress event so operators can spot repos that
   * lost meaningful source coverage.
   */
  onWarn?: (warning: SourceFilesWarning) => void;
}

export interface FetchSourceFilesOutput {
  files: FetchedSourceFile[];
  /**
   * The SHA of the tree that was walked. Mirrors GitHub's `getTree` response
   * `sha` field. Caches keyed on this value invalidate exactly when the tree
   * changes (force pushes, squash merges, amends) — unlike `pushed_at`, which
   * lags on quiet/admin-side commits.
   */
  treeSha: string | null;
}

// ---------------------------------------------------------------------------
// Bulk pre-fetch budget. Tuned to give Haiku a comprehensive cross-section of
// the repo without blowing the prompt cache. Mirrored (loosely) by the prompt
// renderer in @gh-app/ai-summarizer/prompts so the model sees most of what we
// fetched.
// ---------------------------------------------------------------------------
const MAX_TOTAL_BYTES = 250_000;
const MAX_FILES = 40;
// Per-file caps. Tier 1 (manifests) and Tier 2 (docs) are dense and important
// — give them more headroom; Tier 3+ source files keep the original 8 KB cap.
const MAX_FILE_BYTES_DEFAULT = 8_000;
const MAX_FILE_BYTES_DENSE = 16_000;
// Skip blobs the GitHub tree response reports as larger than this. 16 KB is
// the same upper bound as MAX_FILE_BYTES_DENSE — anything above that we'd
// truncate to noise anyway.
const MAX_BLOB_SIZE_BYTES = 16_000;
// Parallel blob-fetch concurrency. Octokit's getBlob is rate-limited by the
// REST API so we keep this conservative.
const BLOB_FETCH_CONCURRENCY = 8;

// ---------------------------------------------------------------------------
// Path/extension filters. Modelled on RepoGPT's IGNORED_PATHS plus a few extra
// patterns we've found noisy in practice (build outputs, virtualenvs, generated
// schema files, large data formats). package.json is intentionally NOT skipped
// — it's a high-signal manifest and tier 1 in our scoring.
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
  ".gitignore",
  ".npmignore",
  ".eslintrc.js",
  "tsconfig.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "go.sum",
  "poetry.lock",
  ".min.js",
  ".min.css",
];

const SKIP_EXTENSIONS: ReadonlyArray<string> = [
  // Images / media
  "png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp", "tif", "tiff",
  "pdf", "zip", "tar", "gz", "tgz", "bz2", "7z", "rar",
  "mp3", "mp4", "wav", "ogg", "flac", "mov", "avi", "mkv", "webm",
  // Fonts
  "ttf", "otf", "woff", "woff2", "eot",
  // Compiled / binary
  "pyc", "so", "dll", "exe", "dat", "bin", "class", "jar", "war",
  // ML / data
  "npy", "pt", "pkl", "h5", "parquet", "onnx", "safetensors", "ckpt",
];

// ---------------------------------------------------------------------------
// Tier scoring. Lower number = higher priority.
// ---------------------------------------------------------------------------
const TIER_MANIFEST = 1;
const TIER_DOCS = 2;
const TIER_ENTRY_POINT = 3;
const TIER_CONVENTIONAL = 4;
const TIER_OTHER = 5;

const MANIFEST_BASENAMES: ReadonlyArray<string> = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Pipfile",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "composer.json",
  "build.gradle",
  "build.gradle.kts",
  "pom.xml",
  "Project.toml",
  "Package.swift",
  "pubspec.yaml",
  "mix.exs",
];

const DOCS_BASENAMES_LOWER: ReadonlyArray<string> = [
  "readme.md",
  "readme.rst",
  "readme",
  "readme.txt",
  "architecture.md",
  "design.md",
  "contributing.md",
  "overview.md",
];

// Conventional source-tree directories. Files inside these dirs get a tier-4
// boost over arbitrary loose files at repo root.
const CONVENTIONAL_DIRS: ReadonlyArray<string> = [
  "src/",
  "lib/",
  "app/",
  "cmd/",
  "internal/",
  "pkg/",
  "core/",
  "services/",
  "routes/",
  "controllers/",
  "models/",
  "handlers/",
  "components/",
  "pages/",
  "api/",
];

// Entry-point file basenames. We promote anything matching these regardless of
// where they live — entry points are valuable signal.
const ENTRY_POINT_PATTERNS: ReadonlyArray<RegExp> = [
  /^index\.(ts|tsx|js|jsx|mjs|cjs)$/,
  /^main\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|cpp|c|java|kt|swift|dart)$/,
  /^app\.(ts|tsx|js|jsx|mjs|cjs|py)$/,
  /^server\.(ts|tsx|js|jsx|mjs|cjs|py|go)$/,
  /^lib\.rs$/,
  /^_app\.(ts|tsx|js|jsx)$/,
  /^layout\.(ts|tsx|js|jsx)$/,
  /^Program\.cs$/,
];

// File extensions we always consider source-y. Anything else passing the path
// filter is still candidate but slots into the lowest tier.
const SOURCE_EXTENSIONS: ReadonlyArray<string> = [
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "go", "rs", "rb", "java", "kt", "swift",
  "cpp", "cc", "c", "h", "hpp", "cs", "php", "dart",
  "scala", "clj", "ex", "exs", "erl", "hs", "ml", "fs",
  "vue", "svelte", "astro",
  "toml", "yaml", "yml",
  "md", "mdx", "rst",
  "sh", "bash", "zsh",
  "sql", "graphql", "gql", "proto",
];

// ---------------------------------------------------------------------------
// Internal types.
// ---------------------------------------------------------------------------

interface TreeBlobNode {
  path: string;
  sha: string;
  /** size from the GitHub tree response. May be undefined for some submodules. */
  size: number | undefined;
}

interface LoadedTree {
  /** SHA of the tree object itself (returned by `getTree`). */
  treeSha: string | null;
  nodes: TreeBlobNode[];
}

interface ScoredCandidate {
  path: string;
  sha: string;
  size: number;
  tier: number;
  /** Within-tier tiebreaker. Lower is better. */
  rank: number;
}

// ---------------------------------------------------------------------------
// Public entry point. Failure tolerant — never throws into the parent
// enrichment flow; returns `{ files: [], treeSha: null }` on any unexpected
// error.
// ---------------------------------------------------------------------------

export async function fetchSourceFiles(input: FetchSourceFilesInput): Promise<FetchSourceFilesOutput> {
  try {
    const { treeSha, nodes } = await loadRepoTree(input);
    if (nodes.length === 0) return { files: [], treeSha };

    const candidates = scoreAndRankCandidates(nodes, input.primaryLanguage);
    if (candidates.length === 0) return { files: [], treeSha };

    const files = await fetchPrioritizedBlobs({
      octokit: input.octokit,
      owner: input.owner,
      repo: input.repo,
      candidates,
      onWarn: input.onWarn
        ? (bytesIncluded, filesIncluded) =>
            input.onWarn?.({
              kind: "truncated-by-byte-budget",
              repoFullName: `${input.owner}/${input.repo}`,
              message: `Truncated source files for repo ${input.owner}/${input.repo}: budget exhausted at ${bytesIncluded}/${MAX_TOTAL_BYTES} bytes (${filesIncluded}/${MAX_FILES} files included)`,
              bytesIncluded,
              filesIncluded,
              bytesBudget: MAX_TOTAL_BYTES,
            })
        : undefined,
    });
    return { files, treeSha };
  } catch {
    return { files: [], treeSha: null };
  }
}

// ---------------------------------------------------------------------------
// Step 1: pull the entire tree in a single API call. We use the repo's default
// branch as the tree SHA — the GitHub API resolves branch names against the
// HEAD commit's tree.
// ---------------------------------------------------------------------------

async function loadRepoTree(input: FetchSourceFilesInput): Promise<LoadedTree> {
  try {
    const r = await input.octokit.rest.git.getTree({
      owner: input.owner,
      repo: input.repo,
      tree_sha: input.defaultBranch,
      recursive: "true",
    });
    if (!r.data || !Array.isArray(r.data.tree)) return { treeSha: null, nodes: [] };
    const treeSha = typeof r.data.sha === "string" && r.data.sha.length > 0 ? r.data.sha : null;
    const nodes: TreeBlobNode[] = [];
    for (const entry of r.data.tree) {
      if (entry.type !== "blob") continue;
      if (typeof entry.path !== "string" || entry.path.length === 0) continue;
      if (typeof entry.sha !== "string" || entry.sha.length === 0) continue;
      nodes.push({
        path: entry.path,
        sha: entry.sha,
        size: typeof entry.size === "number" ? entry.size : undefined,
      });
    }
    return { treeSha, nodes };
  } catch {
    return { treeSha: null, nodes: [] };
  }
}

// ---------------------------------------------------------------------------
// Step 2: filter + score the tree into a prioritized candidate list.
// ---------------------------------------------------------------------------

function scoreAndRankCandidates(
  tree: ReadonlyArray<TreeBlobNode>,
  primaryLanguage: string | null,
): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  const langKey = (primaryLanguage ?? "").toLowerCase();

  for (const node of tree) {
    if (shouldSkipPath(node.path)) continue;
    const ext = extensionOf(node.path);
    if (ext && SKIP_EXTENSIONS.includes(ext)) continue;
    if (typeof node.size === "number" && node.size > MAX_BLOB_SIZE_BYTES) continue;
    if (!isCandidate(node.path, ext)) continue;

    const tier = computeTier(node.path, ext);
    const rank = computeRank(node.path, ext, langKey);
    out.push({
      path: node.path,
      sha: node.sha,
      size: typeof node.size === "number" ? node.size : 0,
      tier,
      rank,
    });
  }

  // Sort by tier, then by within-tier rank, then by path length, then alpha
  // for deterministic output.
  out.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.path.length !== b.path.length) return a.path.length - b.path.length;
    return a.path.localeCompare(b.path);
  });

  return out;
}

function isCandidate(path: string, ext: string | null): boolean {
  const base = basename(path).toLowerCase();
  if (MANIFEST_BASENAMES.includes(basename(path))) return true;
  if (DOCS_BASENAMES_LOWER.some((d) => base === d || base.startsWith(d.replace(/\.md$/, "")))) {
    return true;
  }
  if (!ext) return false;
  return SOURCE_EXTENSIONS.includes(ext);
}

function computeTier(path: string, ext: string | null): number {
  const base = basename(path);
  const baseLower = base.toLowerCase();
  if (MANIFEST_BASENAMES.includes(base)) return TIER_MANIFEST;
  if (DOCS_BASENAMES_LOWER.includes(baseLower)) return TIER_DOCS;
  // Treat any markdown/rst directly under a docs/ folder as docs as well.
  if ((ext === "md" || ext === "mdx" || ext === "rst") && /(^|\/)docs\//.test(path)) return TIER_DOCS;
  if (ENTRY_POINT_PATTERNS.some((re) => re.test(base))) return TIER_ENTRY_POINT;
  if (CONVENTIONAL_DIRS.some((dir) => path.startsWith(dir) || path.includes(`/${dir}`))) {
    return TIER_CONVENTIONAL;
  }
  return TIER_OTHER;
}

function computeRank(path: string, ext: string | null, langKey: string): number {
  let rank = 0;
  // Penalize deeply nested files — closer to root usually = more important.
  rank += path.split("/").length * 10;
  // Reward files matching the repo's primary language.
  if (langKey && ext && extToLang(ext) === langKey) rank -= 25;
  // Slightly prefer entry-point-named files within their tier.
  if (ENTRY_POINT_PATTERNS.some((re) => re.test(basename(path)))) rank -= 5;
  return rank;
}

// ---------------------------------------------------------------------------
// Step 3: fetch the prioritized blobs in parallel, respecting the file count
// and total byte budgets. We over-fetch slightly (within concurrency) and then
// drop later results once budgets are exhausted — this avoids serialization
// overhead while still bounding cost.
// ---------------------------------------------------------------------------

interface FetchPrioritizedBlobsArgs {
  octokit: Octokit;
  owner: string;
  repo: string;
  candidates: ReadonlyArray<ScoredCandidate>;
  /**
   * Invoked once when at least one fetched file was dropped because the
   * MAX_TOTAL_BYTES budget was exhausted before MAX_FILES was reached.
   * Receives the bytes included and file count actually retained so the caller
   * can emit a warn-level event.
   */
  onWarn?: (bytesIncluded: number, filesIncluded: number) => void;
}

async function fetchPrioritizedBlobs(args: FetchPrioritizedBlobsArgs): Promise<FetchedSourceFile[]> {
  const limit = pLimit(BLOB_FETCH_CONCURRENCY);
  // Window the candidate list to avoid spawning N tasks for huge repos.
  // We pull a generous window — enough that even after binary/text rejection
  // we're likely to hit MAX_FILES, but not the entire tree.
  const windowSize = Math.min(args.candidates.length, MAX_FILES * 3);
  const windowed = args.candidates.slice(0, windowSize);

  const results = await Promise.all(
    windowed.map((c) =>
      limit(() => fetchOneBlob(args.octokit, args.owner, args.repo, c)),
    ),
  );

  // Apply MAX_FILES + MAX_TOTAL_BYTES caps on the ordered results. Order is
  // preserved by Promise.all so tier-1 files come first.
  const out: FetchedSourceFile[] = [];
  let totalBytes = 0;
  let droppedByByteBudget = false;
  for (const fetched of results) {
    if (!fetched) continue;
    if (out.length >= MAX_FILES) break;
    if (totalBytes + fetched.bytes > MAX_TOTAL_BYTES) {
      droppedByByteBudget = true;
      continue;
    }
    out.push(fetched);
    totalBytes += fetched.bytes;
  }
  // Only warn when the byte budget — not the file-count cap — was the binding
  // constraint. Hitting MAX_FILES is the expected/healthy case for big repos;
  // hitting MAX_TOTAL_BYTES with N < MAX_FILES means we lost coverage that
  // would otherwise have been included.
  if (droppedByByteBudget && out.length < MAX_FILES) {
    args.onWarn?.(totalBytes, out.length);
  }
  return out;
}

const TRUNCATION_MARKER = "\n…(truncated by source-files pre-fetch)";

async function fetchOneBlob(
  octokit: Octokit,
  owner: string,
  repo: string,
  candidate: ScoredCandidate,
): Promise<FetchedSourceFile | null> {
  try {
    const r = await octokit.rest.git.getBlob({
      owner,
      repo,
      file_sha: candidate.sha,
    });
    if (typeof r.data.content !== "string") return null;
    const decoded = Buffer.from(
      r.data.content,
      (r.data.encoding ?? "base64") as BufferEncoding,
    ).toString("utf-8");
    if (looksBinary(decoded)) return null;

    const cap = candidate.tier <= TIER_DOCS ? MAX_FILE_BYTES_DENSE : MAX_FILE_BYTES_DEFAULT;
    const truncated = decoded.length > cap;
    const content = truncated ? decoded.slice(0, cap) + TRUNCATION_MARKER : decoded;

    return {
      path: candidate.path,
      language: inferLanguage(candidate.path),
      bytes: content.length,
      content,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function shouldSkipPath(path: string): boolean {
  const normalized = `/${path}`;
  return SKIP_PATH_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function basename(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

function extensionOf(path: string): string | null {
  const base = basename(path);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  return base.slice(dot + 1).toLowerCase();
}

function looksBinary(text: string): boolean {
  // Cheap heuristic — scan first 1 KB for null bytes / high non-printable density.
  const sample = text.slice(0, 1024);
  if (sample.includes(" ")) return true;
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || code === 127) nonPrintable += 1;
  }
  return nonPrintable / Math.max(1, sample.length) > 0.2;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  go: "go",
  rs: "rust",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  cpp: "cpp",
  cc: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  dart: "dart",
  scala: "scala",
  clj: "clojure",
  hs: "haskell",
  ml: "ocaml",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  fs: "fsharp",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  mdx: "markdown",
  rst: "restructuredtext",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  proto: "protobuf",
};

function inferLanguage(path: string): string | null {
  const ext = extensionOf(path);
  if (!ext) return null;
  return EXT_TO_LANG[ext] ?? null;
}

function extToLang(ext: string): string | null {
  return EXT_TO_LANG[ext] ?? null;
}

export type { Repository };
