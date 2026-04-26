import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchJobsForSource, normalizeSource } from "./adapters";
import type {
  IngestionFetch,
  IngestionProvider,
  IngestionSmokeSummary,
  IngestionSource,
  NormalizedIngestionJob,
  ProviderTotals,
  SourceFetchResult,
} from "./types";
import { INGESTION_PROVIDERS } from "./types";
import { canonicalUrl, parallelMap } from "./utils";

export type SmokeRunOptions = {
  providers?: IngestionProvider[];
  limit?: number;
  concurrency?: number;
  sourcesPath?: string;
  outputRoot?: string;
  fetchFn?: IngestionFetch;
  now?: Date;
};

export type SmokeRunResult = {
  summary: IngestionSmokeSummary;
  artifactPath: string;
};

const DEFAULT_SOURCES_PATH = "config/ingestion-sources.json";
const DEFAULT_OUTPUT_ROOT = "manual-runs";
const DEFAULT_CONCURRENCY = 5;

export async function runIngestionSmoke(options: SmokeRunOptions = {}): Promise<SmokeRunResult> {
  const startedAt = options.now ?? new Date();
  const startedMs = Date.now();
  const providers = options.providers ?? [...INGESTION_PROVIDERS];
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const sources = await loadSources(options.sourcesPath ?? DEFAULT_SOURCES_PATH);
  const selectedSources = selectSources(sources, providers, options.limit);

  const sourceResults = await parallelMap(
    selectedSources,
    concurrency,
    (source) => fetchJobsForSource(source, options.fetchFn ?? fetch)
  );
  const { jobs, duplicateCount } = dedupeJobs(sourceResults.flatMap((result) => result.jobs));
  const completedAt = new Date();
  const providerTotals = summarizeProviders(providers, selectedSources, sourceResults, jobs);
  const summary: IngestionSmokeSummary = {
    ok: sourceResults.every((result) => result.sourceStatus.ok),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Date.now() - startedMs,
    providers,
    sourceCount: selectedSources.length,
    rawJobCount: sourceResults.reduce((sum, result) => sum + result.jobs.length, 0),
    dedupedJobCount: jobs.length,
    duplicateCount,
    providerTotals,
    sourceStatuses: sourceResults.map((result) => result.sourceStatus),
    errors: sourceResults.flatMap((result) =>
      result.errors.map((message) => ({
        provider: result.source.provider,
        company: result.source.company,
        slug: result.source.slug,
        message,
      }))
    ),
    sampleJobs: jobs.slice(0, 25),
  };

  const artifactPath = await writeSummary(
    summary,
    options.outputRoot ?? DEFAULT_OUTPUT_ROOT,
    startedAt
  );
  return { summary, artifactPath };
}

export async function loadSources(sourcesPath: string): Promise<IngestionSource[]> {
  const absolutePath = path.resolve(process.cwd(), sourcesPath);
  const text = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("ingestion_sources_must_be_array");
  }
  return parsed
    .map((source) => normalizeSource(source))
    .filter((source): source is IngestionSource => source !== null);
}

export function selectSources(
  sources: IngestionSource[],
  providers: IngestionProvider[],
  limit?: number
) {
  const providerSet = new Set(providers);
  const selected: IngestionSource[] = [];
  const counts = new Map<IngestionProvider, number>();
  for (const source of sources) {
    if (source.enabled === false || !providerSet.has(source.provider)) continue;
    const currentCount = counts.get(source.provider) ?? 0;
    if (typeof limit === "number" && currentCount >= limit) continue;
    selected.push(source);
    counts.set(source.provider, currentCount + 1);
  }
  return selected;
}

export function dedupeJobs(jobs: NormalizedIngestionJob[]) {
  const seenDedupeKeys = new Set<string>();
  const seenUrls = new Set<string>();
  const deduped: NormalizedIngestionJob[] = [];
  let duplicateCount = 0;

  for (const job of jobs) {
    const urlKey = canonicalUrl(job.jobUrl);
    if (seenDedupeKeys.has(job.dedupeKey) || seenUrls.has(urlKey)) {
      duplicateCount++;
      continue;
    }
    seenDedupeKeys.add(job.dedupeKey);
    seenUrls.add(urlKey);
    deduped.push(job);
  }

  return { jobs: deduped, duplicateCount };
}

function summarizeProviders(
  providers: IngestionProvider[],
  sources: IngestionSource[],
  sourceResults: SourceFetchResult[],
  dedupedJobs: NormalizedIngestionJob[]
): ProviderTotals[] {
  return providers.map((provider) => {
    const providerSources = sources.filter((source) => source.provider === provider);
    const providerResults = sourceResults.filter((result) => result.source.provider === provider);
    return {
      provider,
      sourceCount: providerSources.length,
      okSourceCount: providerResults.filter((result) => result.sourceStatus.ok).length,
      failedSourceCount: providerResults.filter((result) => !result.sourceStatus.ok).length,
      rawJobCount: providerResults.reduce((sum, result) => sum + result.jobs.length, 0),
      dedupedJobCount: dedupedJobs.filter((job) => job.provider === provider).length,
    };
  });
}

async function writeSummary(
  summary: IngestionSmokeSummary,
  outputRoot: string,
  startedAt: Date
) {
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const dir = path.resolve(process.cwd(), outputRoot, `ingestion-smoke-${stamp}`);
  await mkdir(dir, { recursive: true });
  const artifactPath = path.join(dir, "summary.json");
  await writeFile(artifactPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return artifactPath;
}
