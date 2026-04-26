// Run the v2 hybrid ranker against the labeled dataset and produce an eval
// report. Compares against a BM25-only baseline to verify embeddings + rerank
// add signal beyond lexical matching.
//
// Usage:
//   npx tsx scripts/poc-rank.ts
//   AI_GATEWAY_API_KEY=... npx tsx scripts/poc-rank.ts          (gateway-routed)
//   OPENAI_API_KEY=... COHERE_API_KEY=... npx tsx scripts/poc-rank.ts  (direct)
//
// Writes JSON reports to tmp/poc-rank/{timestamp}-{ranker}.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import MiniSearch, { type SearchResult } from "minisearch";

import {
  buildProfileSearchQuery,
  evaluateHardFilters,
  normalizeScore,
  type RankingJob,
} from "../lib/job-ranking";
import { rankWithHybridV2 } from "../lib/job-ranking-v2";
import {
  compareReports,
  loadDefaultDataset,
  runEval,
  type EvalSample,
  type LabeledJob,
  type RankedJob,
  type Ranker,
} from "../evals/ranking/runner";

const filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(filename), "..");
const outputDir = resolve(repoRoot, "tmp", "poc-rank");

async function main() {
  const samples = loadDefaultDataset();
  if (samples.length === 0) {
    throw new Error("Dataset has no samples — cannot run eval.");
  }
  console.log(`Loaded ${samples.length} eval samples.`);

  const baseline = await runEval("baseline_bm25_only", samples, bm25Ranker);
  console.log(`Baseline (BM25 only): NDCG@10=${baseline.meanNdcgAt10.toFixed(3)} P@5=${baseline.meanPrecisionAt5.toFixed(3)} MRR=${baseline.meanMrr.toFixed(3)}`);

  let v2Report;
  try {
    v2Report = await runEval("v2_hybrid", samples, v2Ranker);
    console.log(`v2 Hybrid: NDCG@10=${v2Report.meanNdcgAt10.toFixed(3)} P@5=${v2Report.meanPrecisionAt5.toFixed(3)} MRR=${v2Report.meanMrr.toFixed(3)}`);
  } catch (err) {
    console.warn(
      `v2 ranker failed (likely missing API keys). Skipping v2 comparison. Reason: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (v2Report) {
    const diff = compareReports(baseline, v2Report);
    console.log(
      `Δ NDCG@10=${signed(diff.ndcgDelta)} ΔP@5=${signed(diff.precisionAt5Delta)} ΔP@10=${signed(diff.precisionAt10Delta)} ΔMRR=${signed(diff.mrrDelta)}`
    );
  }

  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(
    resolve(outputDir, `${timestamp}-baseline.json`),
    JSON.stringify(baseline, null, 2)
  );
  if (v2Report) {
    writeFileSync(
      resolve(outputDir, `${timestamp}-v2.json`),
      JSON.stringify(v2Report, null, 2)
    );
  }
  console.log(`Reports written to ${outputDir}.`);
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

const bm25Ranker: Ranker = async (sample: EvalSample) => {
  const survivors = filterAndCarry(sample);
  const ranked = bm25Rank(sample.profile, survivors);
  const ordered: RankedJob[] = ranked.map((job, idx) => ({
    id: job.id,
    rank: idx + 1,
  }));
  return ordered;
};

const v2Ranker: Ranker = async (sample: EvalSample) => {
  const survivors = filterAndCarry(sample);
  const candidates = bm25Rank(sample.profile, survivors).map((job) => ({
    jobId: job.id,
    job,
    bm25Score: job.bm25Score,
    bm25Normalized: job.bm25Normalized,
    ruleScore: job.ruleScore,
    softSignals: {} as Record<string, number>,
  }));
  const result = await rankWithHybridV2({
    profile: sample.profile,
    candidates,
    recommendationCutoff: 0,
    maxRecommendations: candidates.length,
  });
  const orderedScores = [...result.scores].sort(
    (a, b) => b.totalScore - a.totalScore
  );
  return orderedScores.map((score, idx) => ({ id: score.jobId, rank: idx + 1 }));
};

type EnrichedJob = LabeledJob & {
  bm25Score: number;
  bm25Normalized: number;
  ruleScore: number;
};

function filterAndCarry(sample: EvalSample): EnrichedJob[] {
  return sample.jobs.map((job) => {
    const decision = evaluateHardFilters(job, sample.profile, { softMode: true });
    return {
      ...job,
      bm25Score: 0,
      bm25Normalized: 0,
      ruleScore: decision.ruleScore,
    };
  });
}

function bm25Rank(profile: EvalSample["profile"], jobs: EnrichedJob[]): EnrichedJob[] {
  if (jobs.length === 0) return jobs;
  const docs = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location ?? "",
    team: job.team ?? "",
    department: job.department ?? "",
    description: job.descriptionPlain ?? "",
  }));
  const query = buildProfileSearchQuery(profile);
  const search = new MiniSearch({
    fields: ["title", "team", "department", "location", "description"],
    storeFields: ["title"],
    searchOptions: {
      boost: { title: 5, team: 3, department: 2, description: 1, location: 0.5 },
      fuzzy: 0.1,
      prefix: true,
      combineWith: "OR",
    },
  });
  search.addAll(docs);
  const results: SearchResult[] = query ? search.search(query) : [];
  const byId = new Map(results.map((result) => [String(result.id), result.score]));
  const maxBm25 = Math.max(1, ...Array.from(byId.values()));

  return jobs
    .map((job) => {
      const raw = byId.get(job.id) ?? 0;
      return {
        ...job,
        bm25Score: raw,
        bm25Normalized: normalizeScore(raw, maxBm25),
      };
    })
    .sort((a, b) => b.bm25Normalized - a.bm25Normalized);
}

main().catch((err) => {
  console.error("poc-rank failed:", err);
  process.exit(1);
});
