export interface RepoSourceFileForPrompt {
  path: string;
  language: string | null;
  bytes: number;
  content: string;
}

export interface RepoPromptInput {
  fullName: string;
  description: string | null;
  topics: string[];
  language: string | null;
  stars: number;
  createdAt?: string;
  pushedAt?: string;
  readme: string | null;
  manifests: ReadonlyArray<{ ecosystem: string; dependencies: string[] }>;
  workflows: string[];
  hasDockerfile: boolean;
  sourceFiles: ReadonlyArray<RepoSourceFileForPrompt>;
}

// Total source-file budget folded into the Haiku prompt. Mirrors the
// extractor's 250 KB bulk pre-fetch cap but leaves headroom for README + meta
// sections and the model's response.
const PROMPT_SOURCE_BUDGET_BYTES = 220_000;
// Per-file truncation guard so a single large file can't dominate the budget.
// Aligned with the extractor's MAX_FILE_BYTES_DENSE (16 KB) so we don't
// re-truncate manifests/docs that the extractor already chose to send full.
const PROMPT_PER_FILE_CAP = 16_000;

export interface RepoUserPromptOptions {
  /** When true, Haiku has list_directory + read_file tools available. */
  tooluseEnabled: boolean;
  /** Per-summary cap on tool calls (only meaningful when `tooluseEnabled`). */
  maxToolCalls: number;
  /**
   * Optional reformat hint appended to the user prompt on the retry attempt.
   * When set, the model is told it failed validation and what to fix.
   */
  reformatHint?: string;
}

const DEFAULT_REPO_USER_PROMPT_OPTIONS: RepoUserPromptOptions = {
  tooluseEnabled: false,
  maxToolCalls: 0,
};

export function repoUserPrompt(
  r: RepoPromptInput,
  options: RepoUserPromptOptions = DEFAULT_REPO_USER_PROMPT_OPTIONS,
): string {
  const readme = (r.readme ?? "").slice(0, 4000);
  const manifestSummary = r.manifests
    .map((m) => `- ${m.ecosystem}: ${m.dependencies.slice(0, 30).join(", ")}`)
    .join("\n") || "(none detected)";

  const sourceBlock = renderSourceFiles(r.sourceFiles);
  const hasSource = r.sourceFiles.length > 0;
  const prefetchedPaths = r.sourceFiles.map((f) => f.path);

  const explorerHeader = options.tooluseEnabled
    ? buildExplorerHeader({
        maxToolCalls: options.maxToolCalls,
        prefetchedPaths,
      })
    : "";

  const reformatBlock = options.reformatHint
    ? [
        ``,
        `=== RETRY — YOUR PREVIOUS ATTEMPT WAS REJECTED ===`,
        options.reformatHint,
        `Read MORE source files this time and write a LONGER, more concrete whatItDoes.`,
        `=================================================`,
        ``,
      ].join("\n")
    : "";

  const sourceHeader = hasSource
    ? `Pre-fetched source files (${r.sourceFiles.length} file${r.sourceFiles.length === 1 ? "" : "s"}, total ${totalBytes(r.sourceFiles)} bytes). You have a comprehensive sample of source code from across the repo — manifests, docs, entry points, and a representative cross-section of source modules. The pre-fetched files are NOT exhaustive but they ARE a representative cross-section selected by tier (manifests > docs > entry points > conventional source dirs > everything else). Use them to ground every claim about what the code actually does:`
    : `No source files were pre-fetched (tree empty, all files filtered, or fetch failed). Fall back to README + manifest signal only — and lean conservative on starQuality and difficulty.`;
  return [
    `Analyze this GitHub repository to summarize what the developer built.`,
    `The MOST IMPORTANT field is "whatItDoes" — a comprehensive 4-6 sentence summary derived from reading the actual SOURCE CODE provided below. The README, topics and dependencies are secondary signals; they belong in the short "metadataSummary" subfield, not the main whatItDoes.`,
    explorerHeader ? `\n${explorerHeader}` : ``,
    reformatBlock,
    ``,
    `Repository: ${r.fullName}`,
    `Description: ${r.description ?? "(none)"}`,
    `Primary language: ${r.language ?? "(none)"}`,
    `Topics: ${r.topics.join(", ") || "(none)"}`,
    `Stars: ${r.stars}`,
    `Created: ${r.createdAt ?? "?"}`,
    `Last pushed: ${r.pushedAt ?? "?"}`,
    `Has Dockerfile: ${r.hasDockerfile ? "yes" : "no"}`,
    `CI workflows: ${r.workflows.join(", ") || "(none)"}`,
    ``,
    `Manifests detected:`,
    manifestSummary,
    ``,
    `README (first 4000 chars):`,
    "```",
    readme || "(no README)",
    "```",
    ``,
    sourceHeader,
    sourceBlock,
    ``,
    `Output a structured summary. Use third person ("the developer").`,
    `Hard rules:`,
    `- Ground every claim in either the code, the README, or the manifests. Do not invent features.`,
    `- whatItDoes (MOST IMPORTANT, MIN 400 chars, 4-6 sentences): describe what the code actually does (operations + data flow), the architectural shape it takes, key abstractions and patterns, and notable implementation choices. Cite specific identifiers, function names, file names, and behaviours you observed in the source. ${hasSource ? "DO NOT just paraphrase the README — synthesize from the source files above." : ""}`,
    `- metadataSummary (1-2 sentences): the README/dependency-derived recap. What the project says about itself in its docs and manifests, separate from what the code reveals.`,
    `- notableImplementationDetails: ${hasSource ? "2-5 specific implementation choices the code reveals (concurrency model, error-handling style, schema validation, custom abstractions, interesting algorithms, build/runtime tricks). Each bullet should reference a behaviour you saw in the source files above." : "Empty array — no source code was available."}`,
    `- userContributions: 2-3 sentences on the developer's contribution as evidenced by the code's design and the README.`,
    `- starQuality and difficulty: lean conservative if the README is thin AND the source is thin.`,
  ].join("\n");
}

function buildExplorerHeader(args: { maxToolCalls: number; prefetchedPaths: string[] }): string {
  const prefetchedList = args.prefetchedPaths.length > 0
    ? args.prefetchedPaths.map((p) => `    - ${p}`).join("\n")
    : "    (none)";
  return [
    `=== TOOL USE IS MANDATORY ===`,
    `You have two tools to explore the repository:`,
    `  - list_directory(path): list files in a directory. Use "" for the repo root.`,
    `  - read_file(path): fetch up to 16 KB of a file's UTF-8 contents.`,
    ``,
    `You MUST follow this protocol BEFORE producing the final JSON summary:`,
    `  1. Call list_directory("") FIRST — even though pre-fetched files exist — so you see the full project layout.`,
    `  2. Call read_file at LEAST 3 times on source files NOT already in the pre-fetched bundle. Failing to do so is failing the task.`,
    `  3. Continue exploring (list_directory on subdirs, read_file on entry points / public APIs / interesting modules) until you have a confident, code-grounded picture.`,
    `  4. Only then produce the final structured JSON summary.`,
    ``,
    `Pre-fetched files already in the user prompt below (DO NOT spend tool calls re-reading these — pick OTHER files):`,
    prefetchedList,
    ``,
    `You may make up to ${args.maxToolCalls} tool calls total. Spend them on entry points (src/index.*, main.*, app.*, cmd/*), public API surfaces, configuration/setup, and any modules whose names suggest core functionality. Skip lockfiles, build artifacts, vendored code, minified bundles.`,
    `Tool errors come back as JSON like {"error": "..."} — treat them as missing files, do not retry.`,
    ``,
    `When you have enough information, stop calling tools and produce your final structured summary as a SINGLE JSON object — no prose, no markdown fences. Begin with { and end with }.`,
  ].join("\n");
}

function totalBytes(files: ReadonlyArray<RepoSourceFileForPrompt>): number {
  return files.reduce((sum, f) => sum + f.bytes, 0);
}

function renderSourceFiles(files: ReadonlyArray<RepoSourceFileForPrompt>): string {
  if (files.length === 0) {
    return "(no source files were fetched — falling back to README/manifest signal only)";
  }
  let usedBytes = 0;
  const blocks: string[] = [];
  for (const file of files) {
    if (usedBytes >= PROMPT_SOURCE_BUDGET_BYTES) {
      blocks.push(`(remaining files omitted to fit prompt budget)`);
      break;
    }
    const remainingBudget = PROMPT_SOURCE_BUDGET_BYTES - usedBytes;
    const cap = Math.min(PROMPT_PER_FILE_CAP, remainingBudget);
    const truncated = file.content.length > cap;
    const body = truncated ? `${file.content.slice(0, cap)}\n…(truncated, ${file.content.length - cap} more bytes)` : file.content;
    // Use explicit BEGIN/END markers instead of triple-backtick fences so file
    // contents that themselves contain ``` (e.g. markdown samples) do not
    // confuse delimiters. Prefix language hint inline for the model.
    const langHint = file.language ? ` [language=${file.language}]` : "";
    blocks.push(
      [
        `<<<FILE path="${file.path}" bytes="${file.bytes}"${truncated ? ` truncated="true"` : ""}${langHint}>>>`,
        body,
        `<<<END FILE>>>`,
      ].join("\n"),
    );
    usedBytes += body.length;
  }
  return blocks.join("\n\n");
}

export const REPO_SYSTEM_PROMPT =
  "You are a senior engineering hiring manager evaluating GitHub repos for technical depth and evidence-based skill claims. You read source code and only describe what the code, README, and manifests actually support — never inventing features. The most important field in your output is `whatItDoes`: a comprehensive 4-6 sentence, code-grounded summary. The README/dependencies are recapped separately in `metadataSummary` and must NOT dominate `whatItDoes`.";

// System prompt used when the model has list_directory / read_file tools.
// Keeps the same evaluator persona but explicitly enforces the tool-use
// protocol: list_directory first, then at least 3 read_file calls on files
// not in the pre-fetched bundle, before producing the final JSON.
export const REPO_TOOLUSE_SYSTEM_PROMPT = [
  "You are a senior engineering hiring manager evaluating GitHub repos for technical depth and evidence-based skill claims.",
  "",
  "TOOL USE IS MANDATORY — NOT OPTIONAL.",
  "You have two tools: `list_directory(path)` and `read_file(path)`. Before producing the final JSON summary you MUST:",
  '  1. Call list_directory("") first to see the full project layout.',
  "  2. Call read_file at least 3 times on source files that were NOT pre-fetched into the user prompt. The pre-fetched files are starting points, not a complete picture. Failing to read additional source code is a failure to do the task.",
  "  3. Prefer reading entry points (e.g. src/index.*, main.*, cmd/*, app/*), public API surfaces, configuration/setup files, and any modules whose names suggest core functionality.",
  "  4. Skip lockfiles, build artifacts, vendored code, and minified bundles — they will be filtered anyway.",
  "  5. You have a hard cap on tool calls per repo. Spend them deliberately. If you've seen enough after the mandatory minimum, stop and produce the summary.",
  '  6. Tool errors come back as JSON like `{"error": "..."}`. Treat them as missing files and move on — do not retry the same path.',
  "",
  "OUTPUT REQUIREMENTS:",
  "- The MOST IMPORTANT field is `whatItDoes`: a comprehensive 4-6 sentence (MIN 400 characters) summary derived primarily from the source code you read. Cover: what the code actually does (operations + data flow), the architectural shape it takes, key abstractions and patterns, notable implementation choices. Cite specific identifiers, file names, and behaviours.",
  "- `metadataSummary` (1-2 sentences) is the short README/dependency recap. It is a SUBFIELD, not the main story.",
  "- Output the final answer as a SINGLE JSON object matching the required schema. No prose. No markdown fences. Begin with `{` and end with `}`.",
  "- Ground every claim in either the code you read, the README, or the manifests. Never invent features.",
].join("\n");

export interface ConsolidatePromptInput {
  repoSummaries: Array<{
    repoFullName: string;
    oneLineDescription: string;
    whatItDoes: string;
    metadataSummary?: string;
    keyTechnologies: string[];
    userContributions: string;
    accomplishments: string[];
    difficulty: string;
    starQuality: string;
    notableImplementationDetails?: string[];
    metrics: { stars: number; pushedAt?: string };
  }>;
  experienceSummaries: Array<{
    position: string;
    company: string;
    fromDate?: string;
    toDate?: string;
    roleSummary: string;
    keyResponsibilities: string[];
    technologiesMentioned: string[];
    scopeSignals: string[];
    seniorityLevel: string;
  }>;
  rawEducations: Array<{
    institution: string;
    degree?: string;
    fromDate?: string;
    toDate?: string;
  }>;
  profile: {
    fullName: string;
    bio?: string;
    accountAgeYears?: number;
    skills: { languages: string[]; frameworks: string[]; tools: string[]; cloudPlatforms: string[]; databases: string[] };
    repoCount: number;
    pinnedRepoCount: number;
    starsReceived: number;
    externalContributions: number;
    sponsors: number;
    achievements: number;
  };
  hasLinkedIn: boolean;
}

export function consolidateUserPrompt(input: ConsolidatePromptInput): string {
  const linkedinBlock = input.hasLinkedIn
    ? [
        `## LinkedIn (per-experience AI summaries already produced)`,
        JSON.stringify(input.experienceSummaries, null, 2),
        ``,
        `## LinkedIn — education (raw)`,
        JSON.stringify(input.rawEducations, null, 2),
      ].join("\n")
    : `## LinkedIn\n(no LinkedIn data imported — work-history insights will rely on GitHub signal alone)`;

  return [
    `You are writing a comprehensive, candid profile of a developer based on the entirety of their GitHub footprint AND (when available) their LinkedIn work history.`,
    `This is NOT job-tailored — it is a high-detail, evidence-based portrait of who this developer is, what they have built, and how they work.`,
    `Cite specific repos and specific employer names whenever you make a claim.`,
    ``,
    `## Developer profile`,
    `Name: ${input.profile.fullName || "(unknown)"}`,
    `Bio: ${input.profile.bio ?? "(none)"}`,
    `Account age: ${input.profile.accountAgeYears ?? "?"} years on GitHub`,
    `Total accessible repos: ${input.profile.repoCount}`,
    `Pinned repos: ${input.profile.pinnedRepoCount}`,
    `Stars received: ${input.profile.starsReceived}`,
    `External OSS contributions: ${input.profile.externalContributions}`,
    `Sponsors: ${input.profile.sponsors}`,
    `GitHub achievements: ${input.profile.achievements}`,
    ``,
    `## Aggregated tech footprint (from GitHub)`,
    `Languages: ${input.profile.skills.languages.join(", ") || "(none)"}`,
    `Frameworks: ${input.profile.skills.frameworks.join(", ") || "(none)"}`,
    `Tools: ${input.profile.skills.tools.join(", ") || "(none)"}`,
    `Cloud platforms: ${input.profile.skills.cloudPlatforms.join(", ") || "(none)"}`,
    `Databases: ${input.profile.skills.databases.join(", ") || "(none)"}`,
    ``,
    `## GitHub — per-repo AI summaries (already produced)`,
    JSON.stringify(input.repoSummaries, null, 2),
    ``,
    linkedinBlock,
    ``,
    `## Output requirements`,
    `Produce a structured comprehensive profile that fuses both sources:`,
    ``,
    `1. executiveSummary: 4–6 sentences. Top-line portrait. If LinkedIn is present, weave their formal job titles and company names with their GitHub-evidenced engineering work.`,
    `2. technicalIdentity: 2–3 paragraphs. What kind of engineer are they? Generalist or specialist? Dominant stack? Where do their LinkedIn job titles and GitHub repos overlap or diverge?`,
    `3. coreStrengths: 4–7 bullets, each with concrete citations.`,
    `4. domainsAndInterests: 3–6 problem domains.`,
    `5. projectThemes: 2–4 cross-cutting patterns visible across their repos.`,
    `6. engineeringPractices: 4–7 bullets on how they work (CI/CD, testing, README quality, OSS practices).`,
    `7. notableTools: 4–8 specific tools or technologies that appear repeatedly.`,
    `8. notableAccomplishments: 4–6 bragging-rights items grounded in actual repos OR LinkedIn scope signals.`,
    `9. growthAreas: 2–4 candid observations about gaps. Phrase respectfully.`,
    `10. portfolioImprovements: 3–5 concrete suggestions.`,
    `11. careerNarrative: ${
      input.hasLinkedIn
        ? '2–4 sentences tracing their arc through LinkedIn jobs in time order — what trajectory does it tell?'
        : '2–3 sentences inferred from GitHub account age + repo cadence + topic shifts. Mark as "LinkedIn would sharpen this".'
    }`,
    `12. githubLinkedinAlignment: ${
      input.hasLinkedIn
        ? '3–5 bullets on where GitHub work and LinkedIn jobs corroborate (e.g., "shipped Python ML at TechCo — backed by 4 PyTorch repos") OR diverge (e.g., "Java listed at LinkedIn role X but no Java repos visible on GitHub"). Use the actual data.'
        : 'Empty array — no LinkedIn data to compare.'
    }`,
    `13. linkedinOnlySummary: ${
      input.hasLinkedIn
        ? '3–5 sentences describing what the LinkedIn data alone says about this person — completely ignore GitHub for this field. Cover their work history arc, current/most-recent role, scope signals (team size, revenue, users if mentioned), and any notable patterns. Be candid about thin or missing data.'
        : 'Empty string ""'
    }`,
    `14. linkedinDataQuality: ${
      input.hasLinkedIn
        ? '2–5 bullets noting which LinkedIn fields look RICH (e.g., "experiences have detailed descriptions"), which look THIN (e.g., "no education entries imported"), and which look MISSING / suspicious (e.g., "About section is empty", "no scope signals in any role"). Be specific about field names.'
        : 'Empty array — no LinkedIn data to assess.'
    }`,
    ``,
    `Hard rules: Cite repos and employers explicitly. Never fabricate. If thin in a category, say so.`,
  ].join("\n");
}

export const CONSOLIDATE_SYSTEM_PROMPT =
  "You are a senior engineering writer producing a candid, comprehensive profile of a developer from their GitHub and (where available) LinkedIn footprint. You cite specific repos and employers as evidence and never fabricate.";
