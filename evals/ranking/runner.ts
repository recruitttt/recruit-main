// Eval driver — takes a labeled dataset and a ranker function, produces
// aggregate metrics. Decoupled from any specific ranker implementation so
// both v1 (BM25 + LLM) and v2 (RRF + Rerank + LLM) can be measured against
// the same dataset.
//
// Loaders read the dataset.json sibling. Tests use synthetic samples.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { RankingJob, RankingProfile } from "../../lib/job-ranking";
import {
  meanReciprocalRank,
  ndcgAtK,
  precisionAtK,
  type LabelLevel,
  type RankedItem,
} from "./metrics";

export type LabeledJob = RankingJob & { label: LabelLevel };

export type EvalSample = {
  id: string;
  profile: RankingProfile;
  jobs: LabeledJob[];
};

export type RankedJob = {
  id: string;
  rank: number;
};

export type Ranker = (sample: EvalSample) => Promise<RankedJob[]>;

export type SampleReport = {
  sampleId: string;
  ndcgAt10: number;
  precisionAt3: number;
  precisionAt5: number;
  precisionAt10: number;
  mrr: number;
};

export type EvalReport = {
  rankerName: string;
  totalSamples: number;
  meanNdcgAt10: number;
  meanPrecisionAt3: number;
  meanPrecisionAt5: number;
  meanPrecisionAt10: number;
  meanMrr: number;
  perSample: SampleReport[];
};

export async function runEval(
  rankerName: string,
  samples: EvalSample[],
  ranker: Ranker
): Promise<EvalReport> {
  const perSample: SampleReport[] = [];
  for (const sample of samples) {
    const rankings = await ranker(sample);
    const labelById = new Map(sample.jobs.map((job) => [job.id, job.label]));
    const ranked: RankedItem[] = rankings
      .map((entry) => {
        const label = labelById.get(entry.id);
        if (!label) return null;
        return { id: entry.id, rank: entry.rank, label };
      })
      .filter((item): item is RankedItem => item !== null);
    perSample.push({
      sampleId: sample.id,
      ndcgAt10: ndcgAtK(ranked, 10),
      precisionAt3: precisionAtK(ranked, 3),
      precisionAt5: precisionAtK(ranked, 5),
      precisionAt10: precisionAtK(ranked, 10),
      mrr: meanReciprocalRank(ranked),
    });
  }
  const total = perSample.length || 1;
  const sum = (selector: (item: SampleReport) => number) =>
    perSample.reduce((acc, item) => acc + selector(item), 0);
  return {
    rankerName,
    totalSamples: perSample.length,
    meanNdcgAt10: sum((item) => item.ndcgAt10) / total,
    meanPrecisionAt3: sum((item) => item.precisionAt3) / total,
    meanPrecisionAt5: sum((item) => item.precisionAt5) / total,
    meanPrecisionAt10: sum((item) => item.precisionAt10) / total,
    meanMrr: sum((item) => item.mrr) / total,
    perSample,
  };
}

export function loadDefaultDataset(): EvalSample[] {
  const filename = fileURLToPath(import.meta.url);
  const datasetPath = resolve(dirname(filename), "dataset.json");
  const raw = readFileSync(datasetPath, "utf-8");
  const parsed = JSON.parse(raw) as { samples?: unknown[] };
  return (parsed.samples ?? [])
    .map(parseSample)
    .filter((sample): sample is EvalSample => sample !== null);
}

function parseSample(value: unknown): EvalSample | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : null;
  const profile = record.profile as RankingProfile | undefined;
  const rawJobs = record.jobs as unknown[] | undefined;
  if (!id || !profile || !Array.isArray(rawJobs)) return null;
  const jobs = rawJobs
    .map(parseJob)
    .filter((job): job is LabeledJob => job !== null);
  if (jobs.length === 0) return null;
  return { id, profile, jobs };
}

function parseJob(value: unknown): LabeledJob | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : null;
  const title = typeof record.title === "string" ? record.title : null;
  const company = typeof record.company === "string" ? record.company : null;
  const jobUrl = typeof record.jobUrl === "string" ? record.jobUrl : null;
  const label = typeof record.label === "string" ? (record.label as LabelLevel) : null;
  if (!id || !title || !company || !jobUrl || !label) return null;
  if (!["great", "good", "meh", "bad"].includes(label)) return null;
  return {
    id,
    title,
    company,
    jobUrl,
    label,
    location: typeof record.location === "string" ? record.location : undefined,
    isRemote: typeof record.isRemote === "boolean" ? record.isRemote : undefined,
    workplaceType:
      typeof record.workplaceType === "string" ? record.workplaceType : undefined,
    employmentType:
      typeof record.employmentType === "string" ? record.employmentType : undefined,
    department: typeof record.department === "string" ? record.department : undefined,
    team: typeof record.team === "string" ? record.team : undefined,
    descriptionPlain:
      typeof record.descriptionPlain === "string"
        ? record.descriptionPlain
        : undefined,
    compensationSummary:
      typeof record.compensationSummary === "string"
        ? record.compensationSummary
        : undefined,
    salaryMin: typeof record.salaryMin === "number" ? record.salaryMin : undefined,
    salaryMax: typeof record.salaryMax === "number" ? record.salaryMax : undefined,
    currency: typeof record.currency === "string" ? record.currency : undefined,
  };
}

export function compareReports(
  baseline: EvalReport,
  candidate: EvalReport
): {
  ndcgDelta: number;
  precisionAt5Delta: number;
  precisionAt10Delta: number;
  mrrDelta: number;
} {
  return {
    ndcgDelta: candidate.meanNdcgAt10 - baseline.meanNdcgAt10,
    precisionAt5Delta: candidate.meanPrecisionAt5 - baseline.meanPrecisionAt5,
    precisionAt10Delta: candidate.meanPrecisionAt10 - baseline.meanPrecisionAt10,
    mrrDelta: candidate.meanMrr - baseline.meanMrr,
  };
}
