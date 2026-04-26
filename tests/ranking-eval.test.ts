import assert from "node:assert/strict";
import {
  evaluateHardFilters,
  type RankingJob,
  type RankingProfile,
} from "../lib/job-ranking";

const profile: RankingProfile = {
  headline: "AI infrastructure engineer",
  skills: ["Python", "TypeScript", "Distributed systems"],
  prefs: {
    roles: ["Software Engineer", "AI Engineer"],
    locations: ["Remote", "New York"],
    minSalary: "$120k",
  },
};

const jobs: RankingJob[] = [
  {
    id: "great",
    company: "Acme AI",
    title: "AI Infrastructure Engineer",
    location: "Remote",
    jobUrl: "https://jobs.example.com/great",
    descriptionPlain: "Build Python and TypeScript systems for AI agents.",
    compensationSummary: "$150k - $190k",
  },
  {
    id: "bad",
    company: "SalesCo",
    title: "Enterprise Account Executive",
    location: "Austin",
    jobUrl: "https://jobs.example.com/bad",
    descriptionPlain: "Own outbound sales motions.",
    compensationSummary: "$90k - $110k",
  },
];

const evaluated = jobs.map((job) => ({
  id: job.id,
  decision: evaluateHardFilters(job, profile, { softMode: true }),
}));
evaluated.sort((a, b) => b.decision.ruleScore - a.decision.ruleScore);

assert.equal(evaluated[0]?.id, "great");
assert.equal(evaluated.find((item) => item.id === "great")?.decision.status, "kept");
assert.ok(
  evaluated.find((item) => item.id === "bad")?.decision.softSignals.role_family_business_mismatch,
);

console.log("Ranking eval smoke test passed");
