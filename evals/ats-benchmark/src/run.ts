import path from "node:path";
import { access } from "node:fs/promises";
import { RUN_PROFILES, type BenchmarkOptions, type BenchmarkResult, type BenchmarkSample, type JobKeywords, type RankingRow, type RunProfile } from "./types";
import { loadNormalizedSamples } from "./normalize";
import { ResumeMatcherClient } from "./resume-matcher";
import { extractFallbackKeywords, scoreResumeTextWithKeywords } from "./scoring";
import { tailorWithRecruit } from "./recruit-tailor";
import { writeReports } from "./report";

export async function runBenchmark(options: Partial<BenchmarkOptions> = {}) {
  const resolved = resolveOptions(options);
  const startedAt = resolved.now ?? new Date();
  const startedMs = Date.now();
  const inputPath = await existingInputPath(resolved.inputPath);
  const allSamples = await loadNormalizedSamples(inputPath);
  const samples = selectSamplesWithSkips(allSamples, RUN_PROFILES[resolved.profile]);
  const client = resolved.useSidecar
    ? new ResumeMatcherClient({ baseUrl: resolved.resumeMatcherUrl })
    : null;

  if (client && !(await client.health())) {
    throw new Error(`Resume Matcher sidecar is not healthy at ${resolved.resumeMatcherUrl}/api/v1/health`);
  }

  let cacheHits = 0;
  const results = await parallelMap(samples, resolved.concurrency, async (sample) => {
    const result = await evaluateSample(sample, resolved, client);
    if (result.cacheHit) cacheHits += 1;
    return result.result;
  });
  const rankings = buildRankings(samples, results);
  const durationMs = Date.now() - startedMs;
  const reports = await writeReports({
    outputRoot: resolved.outputRoot,
    startedAt,
    profile: resolved.profile,
    results,
    rankings,
    cacheHits,
    durationMs,
  });
  return { summary: reports.summary, results, rankings, runDir: reports.runDir };
}

async function existingInputPath(inputPath: string): Promise<string> {
  try {
    await access(inputPath);
    return inputPath;
  } catch {
    const fixturePath = path.join("evals", "ats-benchmark", "fixtures", "resume-score-details.jsonl");
    await access(fixturePath);
    return fixturePath;
  }
}

async function evaluateSample(
  sample: BenchmarkSample,
  options: BenchmarkOptions,
  client: ResumeMatcherClient | null
): Promise<{ result: BenchmarkResult; cacheHit: boolean }> {
  const errors: string[] = [];
  let cacheHit = false;
  let jobKeywords: JobKeywords = keywordsFromSample(sample);
  let resumeMatcherScore: number | undefined;
  const skipReason = skipReasonForSample(sample);

  if (skipReason) {
    return {
      result: skippedResult(sample, skipReason),
      cacheHit,
    };
  }

  if (client) {
    try {
      const analysis = await client.analyze({
        sampleId: sample.sampleId,
        resumeText: sample.resumeText,
        jobDescription: sample.jobDescription,
        includeTailoredPreview: options.includeResumeMatcherTailor,
      });
      jobKeywords = hasAnyKeywords(analysis.jobKeywords) ? analysis.jobKeywords : jobKeywords;
      resumeMatcherScore = analysis.score;
      cacheHit = analysis.cacheHit;
    } catch (err) {
      errors.push(`resume_matcher:${messageOf(err)}`);
    }
  }

  const baseline = scoreResumeTextWithKeywords(sample.resumeText, jobKeywords);
  errors.push(...dataQualityWarnings(sample));
  const baseResult: BenchmarkResult = {
    sampleId: sample.sampleId,
    source: sample.source,
    roleFamily: sample.roleFamily,
    valid: sample.valid,
    baselineScore: baseline.score,
    resumeMatcherScore,
    referenceScore: sample.referenceScore,
    referenceLabel: sample.referenceLabel,
    keywordCount: baseline.totalKeywords,
    matchedBefore: baseline.matchedKeywords.length,
    qualityIssues: [],
    status: "scored",
    errors,
  };

  if (options.tailor !== "recruit") {
    return { result: baseResult, cacheHit };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      result: {
        ...baseResult,
        status: errors.length > 0 ? "failed" : "scored",
        errors: [...errors, "recruit_tailor:no_openai_api_key"],
      },
      cacheHit,
    };
  }

  const tailored = await tailorWithRecruit(sample, jobKeywords, apiKey);
  if (!tailored.ok) {
    return {
      result: {
        ...baseResult,
        status: "failed",
        errors: [...errors, `recruit_tailor:${tailored.reason}`],
      },
      cacheHit,
    };
  }
  const recruit = scoreResumeTextWithKeywords(tailored.text, jobKeywords);
  return {
    result: {
      ...baseResult,
      recruitScore: recruit.score,
      scoreDelta: recruit.score - baseline.score,
      matchedAfter: recruit.matchedKeywords.length,
      qualityIssues: tailored.qualityIssues,
      tailoredResume: tailored.resume,
      status: "tailored",
    },
    cacheHit,
  };
}

function buildRankings(samples: BenchmarkSample[], results: BenchmarkResult[]): RankingRow[] {
  const rankableSamples = samples.filter((sample) => !skipReasonForSample(sample));
  const anchors = pickAnchorJobs(rankableSamples);
  const byId = new Map(results.map((result) => [result.sampleId, result]));
  const rows: RankingRow[] = [];
  for (const anchor of anchors) {
    const keywords = keywordsFromSample(anchor);
    const scored = rankableSamples
      .map((sample) => {
        const result = byId.get(sample.sampleId);
        const baselineScore = scoreResumeTextWithKeywords(sample.resumeText, keywords).score;
        const recruitScore = result?.recruitScore ?? baselineScore;
        return { sampleId: sample.sampleId, baselineScore, recruitScore };
      })
      .filter((row) => byId.has(row.sampleId));
    const baselineRanks = ranks(scored, "baselineScore");
    const recruitRanks = ranks(scored, "recruitScore");
    for (const row of scored) {
      const baselineRank = baselineRanks.get(row.sampleId) ?? 0;
      const recruitRank = recruitRanks.get(row.sampleId) ?? 0;
      rows.push({
        anchorJobId: anchor.sampleId,
        sampleId: row.sampleId,
        baselineScore: row.baselineScore,
        recruitScore: row.recruitScore,
        baselineRank,
        recruitRank,
        rankDelta: baselineRank - recruitRank,
      });
    }
  }
  return rows;
}

function pickAnchorJobs(samples: BenchmarkSample[]): BenchmarkSample[] {
  const anchors: BenchmarkSample[] = [];
  const seen = new Set<string>();
  for (const sample of samples) {
    const family = sample.roleFamily ?? "general";
    if (seen.has(family)) continue;
    seen.add(family);
    anchors.push(sample);
    if (anchors.length >= 5) break;
  }
  return anchors.length > 0 ? anchors : samples.slice(0, 1);
}

function ranks<T extends { sampleId: string }>(
  rows: Array<T & Record<string, string | number>>,
  field: string
): Map<string, number> {
  return new Map(
    [...rows]
      .sort((a, b) => Number(b[field]) - Number(a[field]) || a.sampleId.localeCompare(b.sampleId))
      .map((row, index) => [row.sampleId, index + 1])
  );
}

function keywordsFromSample(sample: BenchmarkSample): JobKeywords {
  const fallback = extractFallbackKeywords(sample.jobDescription);
  if (sample.minimumRequirements.length === 0) return fallback;
  const requirementKeywords = extractFallbackKeywords(sample.minimumRequirements.join("\n")).keywords ?? [];
  return {
    required_skills: requirementKeywords.length > 0 ? requirementKeywords : sample.minimumRequirements,
  };
}

function selectSamplesWithSkips(samples: BenchmarkSample[], targetValidCount: number): BenchmarkSample[] {
  const selected: BenchmarkSample[] = [];
  let runnableCount = 0;
  for (const sample of samples) {
    selected.push(sample);
    if (!skipReasonForSample(sample)) {
      runnableCount += 1;
    }
    if (runnableCount >= targetValidCount) break;
  }
  return selected;
}

function skipReasonForSample(sample: BenchmarkSample): string | null {
  if (!sample.valid) {
    if (sample.metadata?.dataQuality?.resumeLooksLikeJobDescription) return "invalid_resume_like_job";
    return "invalid_sample";
  }
  if (sample.metadata?.dataQuality?.resumeLooksLikeJobDescription) return "invalid_resume_like_job";
  return null;
}

function skippedResult(sample: BenchmarkSample, reason: string): BenchmarkResult {
  return {
    sampleId: sample.sampleId,
    source: sample.source,
    roleFamily: sample.roleFamily,
    valid: false,
    baselineScore: 0,
    referenceScore: sample.referenceScore,
    referenceLabel: sample.referenceLabel,
    keywordCount: 0,
    matchedBefore: 0,
    qualityIssues: [],
    status: "skipped",
    errors: [`skipped:${reason}`, ...dataQualityWarnings(sample)],
    skipReason: reason,
  };
}

function dataQualityWarnings(sample: BenchmarkSample): string[] {
  const reasons = sample.metadata?.dataQuality?.reasons ?? [];
  return reasons
    .filter((reason) => reason !== "resume_looks_like_job_description")
    .map((reason) => `data_quality:${reason}`);
}

function hasAnyKeywords(keywords: JobKeywords): boolean {
  return ["required_skills", "preferred_skills", "keywords", "key_responsibilities"].some((key) => {
    const value = keywords[key];
    return Array.isArray(value) && value.length > 0;
  });
}

function resolveOptions(options: Partial<BenchmarkOptions>): BenchmarkOptions {
  return {
    profile: options.profile ?? "smoke",
    inputPath: options.inputPath ?? path.join("evals", "ats-benchmark", ".data", "normalized", "resume-score-details.jsonl"),
    outputRoot: options.outputRoot ?? path.join("evals", "ats-benchmark", "runs"),
    scorer: "resume-matcher",
    tailor: options.tailor ?? "none",
    resumeMatcherUrl: options.resumeMatcherUrl ?? process.env.RESUME_MATCHER_URL ?? "http://localhost:3000",
    useSidecar: options.useSidecar ?? false,
    includeResumeMatcherTailor: options.includeResumeMatcherTailor ?? false,
    concurrency: options.concurrency ?? 3,
    now: options.now,
  };
}

async function parallelMap<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  });
  await Promise.all(runners);
  return results;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function parseBenchmarkArgs(args: string[]): Partial<BenchmarkOptions> {
  const options: Partial<BenchmarkOptions> = {};
  for (const arg of args) {
    const [name, value] = splitArg(arg);
    if (!name) continue;
    if (name === "profile") options.profile = parseProfile(value);
    else if (name === "input") options.inputPath = value;
    else if (name === "output") options.outputRoot = value;
    else if (name === "scorer") {
      if (value !== "resume-matcher") throw new Error("--scorer must be resume-matcher");
    } else if (name === "tailor") {
      options.tailor = value === "recruit" ? "recruit" : "none";
    } else if (name === "no-tailor") {
      options.tailor = "none";
    } else if (name === "sidecar") {
      options.useSidecar = value !== "false";
    } else if (name === "resume-matcher-url") {
      options.resumeMatcherUrl = value;
    } else if (name === "include-resume-matcher-tailor") {
      options.includeResumeMatcherTailor = value !== "false";
    } else if (name === "concurrency") {
      options.concurrency = parsePositiveInt(value, "concurrency");
    } else if (name === "no-llm") {
      options.tailor = "none";
      options.useSidecar = false;
    } else {
      throw new Error(`Unknown option --${name}`);
    }
  }
  return options;
}

function splitArg(arg: string): [string, string] {
  if (!arg.startsWith("--")) return ["", ""];
  const body = arg.slice(2);
  const eq = body.indexOf("=");
  return eq === -1 ? [body, "true"] : [body.slice(0, eq), body.slice(eq + 1)];
}

function parseProfile(value: string): RunProfile {
  if (value === "smoke" || value === "standard" || value === "full") return value;
  throw new Error("--profile must be smoke, standard, or full");
}

function parsePositiveInt(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer`);
  return parsed;
}
