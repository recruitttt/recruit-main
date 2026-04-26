// Eval-harness unit tests. Verifies metric correctness and dataset shape
// without making any API calls. Real ranker comparisons live in
// scripts/poc-rank.ts which requires AI_GATEWAY_API_KEY or provider keys.

import assert from "node:assert/strict";

import {
  ndcgAtK,
  precisionAtK,
  meanReciprocalRank,
  type RankedItem,
} from "../evals/ranking/metrics";
import {
  loadDefaultDataset,
  runEval,
  compareReports,
  type EvalReport,
  type Ranker,
} from "../evals/ranking/runner";

// NDCG: ideal ordering yields 1.0
{
  const items: RankedItem[] = [
    { id: "a", rank: 1, label: "great" },
    { id: "b", rank: 2, label: "good" },
    { id: "c", rank: 3, label: "meh" },
    { id: "d", rank: 4, label: "bad" },
  ];
  assert.equal(ndcgAtK(items, 4), 1, "ideal ordering should give NDCG=1");
  assert.equal(ndcgAtK(items, 2), 1, "top-2 prefix of ideal should give NDCG=1");
}

// NDCG: reverse ordering is meaningfully worse than ideal
{
  const reversed: RankedItem[] = [
    { id: "a", rank: 1, label: "bad" },
    { id: "b", rank: 2, label: "meh" },
    { id: "c", rank: 3, label: "good" },
    { id: "d", rank: 4, label: "great" },
  ];
  const reversedNdcg = ndcgAtK(reversed, 4);
  assert.ok(
    reversedNdcg < 0.75,
    `reversed ordering NDCG should be < 0.75, got ${reversedNdcg}`
  );
  assert.ok(reversedNdcg < 1, "reversed ordering must underperform ideal");
}

// Precision@K: counts items at "good" or above by default
{
  const items: RankedItem[] = [
    { id: "a", rank: 1, label: "great" },
    { id: "b", rank: 2, label: "bad" },
    { id: "c", rank: 3, label: "good" },
  ];
  assert.equal(precisionAtK(items, 3), 2 / 3);
  assert.equal(precisionAtK(items, 1), 1);
  assert.equal(precisionAtK(items, 3, "great"), 1 / 3);
}

// MRR: first relevant at rank R yields 1/R
{
  const items: RankedItem[] = [
    { id: "a", rank: 1, label: "bad" },
    { id: "b", rank: 2, label: "meh" },
    { id: "c", rank: 3, label: "good" },
    { id: "d", rank: 4, label: "great" },
  ];
  assert.equal(meanReciprocalRank(items), 1 / 3);
  assert.equal(meanReciprocalRank(items, "great"), 1 / 4);
}

// Empty cases
assert.equal(ndcgAtK([], 10), 0);
assert.equal(precisionAtK([], 10), 0);
assert.equal(meanReciprocalRank([]), 0);

// Dataset loads and has at least one sample with the expected shape
{
  const samples = loadDefaultDataset();
  assert.ok(samples.length > 0, "dataset should have at least one sample");
  for (const sample of samples) {
    assert.ok(sample.id.length > 0);
    assert.ok(sample.profile);
    assert.ok(sample.jobs.length >= 4, `${sample.id} should have ≥4 jobs`);
    const labels = new Set(sample.jobs.map((job) => job.label));
    assert.ok(
      labels.size >= 2,
      `${sample.id} should have at least 2 distinct labels for meaningful ranking`
    );
  }
}

async function runAsyncTests(): Promise<void> {
  const samples = loadDefaultDataset();
  const labelOrder = { great: 0, good: 1, meh: 2, bad: 3 } as const;

  const oracleRanker: Ranker = async (sample) =>
    [...sample.jobs]
      .sort((a, b) => labelOrder[a.label] - labelOrder[b.label])
      .map((job, idx) => ({ id: job.id, rank: idx + 1 }));

  const oracleReport: EvalReport = await runEval("oracle", samples, oracleRanker);
  assert.equal(oracleReport.totalSamples, samples.length);
  assert.ok(
    oracleReport.meanNdcgAt10 > 0.99,
    `oracle should yield NDCG@10 ≈ 1.0, got ${oracleReport.meanNdcgAt10}`
  );
  assert.equal(oracleReport.meanMrr, 1, "oracle's first hit is always rank 1");

  const adversarial: Ranker = async (sample) =>
    [...sample.jobs]
      .sort((a, b) => labelOrder[b.label] - labelOrder[a.label])
      .map((job, idx) => ({ id: job.id, rank: idx + 1 }));
  const adversReport = await runEval("adversarial", samples, adversarial);
  const diff = compareReports(oracleReport, adversReport);
  assert.ok(diff.ndcgDelta < 0, "adversarial should regress NDCG");
  assert.ok(diff.precisionAt5Delta <= 0, "adversarial should not improve P@5");
  assert.ok(diff.mrrDelta <= 0, "adversarial should not improve MRR");
}

runAsyncTests()
  .then(() => {
    console.log("ranking-eval tests passed");
  })
  .catch((err) => {
    console.error("ranking-eval tests failed:", err);
    process.exit(1);
  });
