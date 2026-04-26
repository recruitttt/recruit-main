import assert from "node:assert/strict";

import {
  buildLeaderboardVisualOrder,
  normalizeLeaderboardRecommendations,
  preserveLeaderboardSelection,
  shouldTriggerCosmeticShuffle,
} from "../components/dashboard/leaderboard-helpers";

const normalized = normalizeLeaderboardRecommendations([
  { jobId: "  job-b  ", rank: 2, score: 88, company: "Bravo" },
  { jobId: "job-a", rank: 1, score: 79, company: "Alpha" },
  { jobId: "job-c", score: 91, company: "Charlie" },
  { jobId: "job-b", rank: 5, score: 99, company: "Bravo duplicate" },
  { jobId: "", rank: 3, score: 70, company: "Ignored" },
]);

assert.deepEqual(
  normalized.map((item) => ({
    jobId: item.jobId,
    company: item.company,
    rank: item.rank,
    trueRank: item.trueRank,
    sourceRank: item.sourceRank,
    score: item.score,
    originalIndex: item.originalIndex,
  })),
  [
    {
      jobId: "job-a",
      company: "Alpha",
      rank: 1,
      trueRank: 1,
      sourceRank: 1,
      score: 79,
      originalIndex: 1,
    },
    {
      jobId: "job-b",
      company: "Bravo",
      rank: 2,
      trueRank: 2,
      sourceRank: 2,
      score: 88,
      originalIndex: 0,
    },
    {
      jobId: "job-c",
      company: "Charlie",
      rank: 3,
      trueRank: 3,
      sourceRank: null,
      score: 91,
      originalIndex: 2,
    },
  ],
);

assert.deepEqual(
  preserveLeaderboardSelection(normalized, "job-b"),
  {
    selected: normalized[1],
    selectedJobId: "job-b",
  },
);

assert.deepEqual(
  preserveLeaderboardSelection(normalized, "missing-job"),
  {
    selected: normalized[0],
    selectedJobId: "job-a",
  },
);

assert.deepEqual(
  preserveLeaderboardSelection(normalized, "missing-job", { fallbackToFirst: false }),
  {
    selected: null,
    selectedJobId: null,
  },
);

assert.equal(shouldTriggerCosmeticShuffle(normalized, normalized), false);
assert.equal(shouldTriggerCosmeticShuffle([], normalized), false);
assert.equal(
  shouldTriggerCosmeticShuffle(normalized, [normalized[0]!, normalized[2]!, normalized[1]!]),
  true,
);
assert.equal(
  shouldTriggerCosmeticShuffle(normalized, normalized.slice(0, 2)),
  true,
);

const visualOrder = buildLeaderboardVisualOrder(normalized, {
  seed: "refresh-1",
  pinnedJobId: "job-b",
});

assert.deepEqual(visualOrder.settled, normalized);
assert.equal(visualOrder.shuffled[1]?.jobId, "job-b");
assert.deepEqual(
  [...visualOrder.shuffled].sort((left, right) => left.jobId.localeCompare(right.jobId)).map((item) => item.jobId),
  ["job-a", "job-b", "job-c"],
);
assert.notDeepEqual(
  visualOrder.shuffled.map((item) => item.jobId),
  visualOrder.settled.map((item) => item.jobId),
);

const deterministicOrder = buildLeaderboardVisualOrder(normalized, {
  seed: "refresh-1",
  pinnedJobId: "job-b",
});
assert.deepEqual(
  deterministicOrder.shuffled.map((item) => item.jobId),
  visualOrder.shuffled.map((item) => item.jobId),
);

const smallVisualOrder = buildLeaderboardVisualOrder(normalized.slice(0, 1), { seed: "refresh-2" });
assert.deepEqual(smallVisualOrder.shuffled, smallVisualOrder.settled);

console.log("Dashboard leaderboard helper tests passed");
