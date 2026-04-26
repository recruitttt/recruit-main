import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BenchmarkResult, BenchmarkSummary, RankingRow, RunProfile } from "./types";

export async function writeReports(input: {
  outputRoot: string;
  startedAt: Date;
  profile: RunProfile;
  results: BenchmarkResult[];
  rankings: RankingRow[];
  cacheHits: number;
  durationMs: number;
}): Promise<{ summary: BenchmarkSummary; runDir: string }> {
  const stamp = input.startedAt.toISOString().replace(/[:.]/g, "-");
  const runDir = path.resolve(process.cwd(), input.outputRoot, `ats-benchmark-${stamp}`);
  await mkdir(runDir, { recursive: true });
  const summary = summarize(input);
  await writeFile(path.join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(path.join(runDir, "samples.csv"), csv(samplesRows(input.results)), "utf8");
  await writeFile(path.join(runDir, "rankings.csv"), csv(rankingRows(input.rankings)), "utf8");
  await writeFile(path.join(runDir, "report.md"), markdownReport(summary), "utf8");
  return { summary, runDir };
}

export function summarize(input: {
  startedAt: Date;
  profile: RunProfile;
  results: BenchmarkResult[];
  rankings: RankingRow[];
  cacheHits: number;
  durationMs: number;
}): BenchmarkSummary {
  const valid = input.results.filter((result) => result.valid);
  const tailored = valid.filter((result) => typeof result.recruitScore === "number");
  const deltas = tailored.map((result) => result.scoreDelta ?? 0);
  const rankDeltas = input.rankings.map((row) => row.rankDelta);
  const penaltyCount = valid.filter((result) => result.qualityIssues.length > 0).length;
  return {
    ok: input.results.every((result) => result.status !== "failed"),
    startedAt: input.startedAt.toISOString(),
    completedAt: new Date(input.startedAt.getTime() + input.durationMs).toISOString(),
    durationMs: input.durationMs,
    profile: input.profile,
    sampleCount: input.results.length,
    validSampleCount: valid.length,
    skippedCount: input.results.filter((result) => result.status === "skipped").length,
    failedCount: input.results.filter((result) => result.status === "failed").length,
    tailoredCount: tailored.length,
    averageBaselineScore: average(valid.map((result) => result.baselineScore)),
    medianBaselineScore: median(valid.map((result) => result.baselineScore)),
    averageRecruitScore: average(tailored.map((result) => result.recruitScore ?? 0)),
    medianRecruitScore: median(tailored.map((result) => result.recruitScore ?? 0)),
    averageScoreDelta: average(deltas),
    medianScoreDelta: median(deltas),
    averageRankDelta: average(rankDeltas),
    top10Entrants: input.rankings.filter((row) => row.baselineRank > 10 && row.recruitRank <= 10).length,
    top25Entrants: input.rankings.filter((row) => row.baselineRank > 25 && row.recruitRank <= 25).length,
    sidecarFailures: input.results.filter((result) =>
      result.errors.some((error) => error.startsWith("resume_matcher"))
    ).length,
    recruitTailoringFailures: input.results.filter((result) =>
      result.errors.some((error) => error.startsWith("recruit_tailor"))
    ).length,
    invalidResumeLikeJob: input.results.filter((result) => result.skipReason === "invalid_resume_like_job").length,
    missingStructuredProfile: input.results.filter((result) =>
      result.errors.some((error) => error.includes("missing_structured_profile"))
    ).length,
    validationHardFailures: input.results.filter((result) =>
      result.errors.some((error) => error.includes("tailor_quality_failed"))
    ).length,
    validationPenaltyRate: valid.length > 0 ? Math.round((penaltyCount / valid.length) * 100) : 0,
    cacheHits: input.cacheHits,
  };
}

function samplesRows(results: BenchmarkResult[]): Array<Record<string, unknown>> {
  return results.map((result) => ({
    sampleId: result.sampleId,
    source: result.source,
    roleFamily: result.roleFamily ?? "",
    valid: result.valid,
    status: result.status,
    baselineScore: result.baselineScore,
    recruitScore: result.recruitScore ?? "",
    resumeMatcherScore: result.resumeMatcherScore ?? "",
    scoreDelta: result.scoreDelta ?? "",
    referenceScore: result.referenceScore ?? "",
    referenceLabel: result.referenceLabel ?? "",
    keywordCount: result.keywordCount,
    matchedBefore: result.matchedBefore,
    matchedAfter: result.matchedAfter ?? "",
    qualityIssueCount: result.qualityIssues.length,
    skipReason: result.skipReason ?? "",
    errors: result.errors.join(";"),
  }));
}

function rankingRows(rankings: RankingRow[]): Array<Record<string, unknown>> {
  return rankings.map((row) => ({ ...row }));
}

function csv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function markdownReport(summary: BenchmarkSummary): string {
  return [
    "# ATS Benchmark Report",
    "",
    `- Profile: ${summary.profile}`,
    `- Samples: ${summary.sampleCount} (${summary.validSampleCount} valid)`,
    `- Tailored: ${summary.tailoredCount}`,
    `- Average baseline score: ${summary.averageBaselineScore}`,
    `- Average Recruit score: ${summary.averageRecruitScore}`,
    `- Average score delta: ${summary.averageScoreDelta}`,
    `- Median score delta: ${summary.medianScoreDelta}`,
    `- Average rank delta: ${summary.averageRankDelta}`,
    `- Top-10 entrants: ${summary.top10Entrants}`,
    `- Top-25 entrants: ${summary.top25Entrants}`,
    `- Resume Matcher sidecar failures: ${summary.sidecarFailures}`,
    `- Recruit tailoring failures: ${summary.recruitTailoringFailures}`,
    `- Invalid resume-like-job skips: ${summary.invalidResumeLikeJob}`,
    `- Missing structured profiles: ${summary.missingStructuredProfile}`,
    `- Validation hard failures: ${summary.validationHardFailures}`,
    `- Validation penalty rate: ${summary.validationPenaltyRate}%`,
    `- Cache hits: ${summary.cacheHits}`,
    "",
    "Benchmark claim: Recruit improves resume ranking under an open-source ATS-style scoring engine.",
    "",
  ].join("\n");
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? round((sorted[middle - 1] + sorted[middle]) / 2) : round(sorted[middle]);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
