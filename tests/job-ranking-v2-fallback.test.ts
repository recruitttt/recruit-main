import assert from "node:assert/strict";

import { rankWithHybridV2 } from "../lib/job-ranking-v2";
import type { RankingJob, RankingProfile } from "../lib/job-ranking";
import { withEnvAsync } from "./helpers";

const profile: RankingProfile = {
  headline: "Senior backend engineer",
  skills: ["Go", "Postgres", "Kafka"],
  prefs: { roles: ["Senior Backend Engineer"], locations: ["Remote"] },
};

const backendJob: RankingJob = {
  id: "backend",
  title: "Senior Backend Engineer",
  company: "Vector",
  location: "Remote",
  isRemote: true,
  descriptionPlain: "Build Go APIs, Kafka consumers, and Postgres-backed services.",
  jobUrl: "https://jobs.example/backend",
};

const frontendJob: RankingJob = {
  id: "frontend",
  title: "Frontend Engineer",
  company: "Canvas",
  location: "Remote",
  isRemote: true,
  descriptionPlain: "Build React design system components and UI polish.",
  jobUrl: "https://jobs.example/frontend",
};

async function main() {
  await withEnvAsync(
    {
      AI_GATEWAY_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      COHERE_API_KEY: undefined,
    },
    async () => {
      const result = await rankWithHybridV2({
        profile,
        candidates: [
          {
            jobId: backendJob.id,
            job: backendJob,
            bm25Score: 42,
            bm25Normalized: 100,
            ruleScore: 85,
            softSignals: {},
          },
          {
            jobId: frontendJob.id,
            job: frontendJob,
            bm25Score: 2,
            bm25Normalized: 5,
            ruleScore: 55,
            softSignals: { role_family_frontend_mismatch: 0.5 },
          },
        ],
        recommendationCutoff: 70,
        maxRecommendations: 2,
      });

      assert.equal(result.mode, "v2_bm25");
      assert.ok(
        result.recommendations.length > 0,
        "BM25-only fallback should still produce recommendations from retrieval score"
      );
      assert.equal(result.recommendations[0]?.jobId, "backend");
      assert.ok((result.scores[0]?.llmScore ?? 0) > 0, "fallback ML score should be non-zero");
    }
  );

  console.log("job ranking v2 fallback tests passed");
}

main().catch((err) => {
  console.error("job ranking v2 fallback tests failed:", err);
  process.exit(1);
});
