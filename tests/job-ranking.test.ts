import assert from "node:assert/strict";
import {
  buildProfileSearchQuery,
  evaluateHardFilters,
  normalizeScore,
  parseCompensation,
  type RankingJob,
  type RankingProfile,
} from "../lib/job-ranking";

const seniorBackendProfile: RankingProfile = {
  headline: "Senior backend engineer focused on distributed systems",
  skills: ["Node.js", "Postgres", "API design"],
  prefs: {
    roles: ["Senior Backend Engineer"],
    locations: ["Remote"],
    minSalary: "$160k",
  },
};

const baseJob: RankingJob = {
  id: "job_1",
  company: "Acme",
  title: "Senior Backend Engineer",
  location: "Remote",
  jobUrl: "https://jobs.ashbyhq.com/acme/1",
  salaryMax: 220000,
};

assert.deepEqual(parseCompensation("$180k - $220k").max, 220000);
assert.deepEqual(parseCompensation("$81K – $87K • 0.5% equity").min, 81000);

assert.equal(evaluateHardFilters(baseJob, seniorBackendProfile).status, "kept");

const junior = evaluateHardFilters(
  { ...baseJob, title: "Junior Backend Engineer" },
  seniorBackendProfile
);
assert.equal(junior.status, "rejected");
assert.ok(junior.reasons.includes("seniority_mismatch"));

const frontend = evaluateHardFilters(
  { ...baseJob, title: "Frontend Engineer" },
  seniorBackendProfile
);
assert.equal(frontend.status, "rejected");
assert.ok(frontend.reasons.includes("role_family_frontend_mismatch"));

const underpaid = evaluateHardFilters(
  { ...baseJob, compensationSummary: "$120k - $140k", salaryMax: undefined },
  seniorBackendProfile
);
assert.equal(underpaid.status, "rejected");
assert.ok(underpaid.reasons.includes("salary_below_minimum"));

const sales = evaluateHardFilters(
  { ...baseJob, title: "Enterprise Account Executive" },
  seniorBackendProfile
);
assert.equal(sales.status, "rejected");
assert.ok(sales.reasons.includes("role_family_business_mismatch"));

const localOnlyProfile: RankingProfile = {
  ...seniorBackendProfile,
  prefs: { ...seniorBackendProfile.prefs, locations: ["San Francisco"] },
};
const locationMismatch = evaluateHardFilters(
  { ...baseJob, location: "New York", isRemote: false },
  localOnlyProfile
);
assert.equal(locationMismatch.status, "rejected");
assert.ok(locationMismatch.reasons.includes("location_mismatch"));

const remoteAllowed = evaluateHardFilters(
  { ...baseJob, location: "Remote - US", isRemote: true },
  localOnlyProfile
);
assert.equal(remoteAllowed.status, "kept");

const exactFamilyScore = evaluateHardFilters(baseJob, seniorBackendProfile).ruleScore;
const genericScore = evaluateHardFilters(
  { ...baseJob, title: "Software Engineer", department: undefined, team: undefined },
  seniorBackendProfile
).ruleScore;
assert.ok(exactFamilyScore > genericScore);

assert.equal(parseCompensation("Competitive equity only").max, null);
assert.equal(normalizeScore(25, 50), 50);
assert.equal(normalizeScore(Number.NaN, 50), 0);

const query = buildProfileSearchQuery(seniorBackendProfile);
assert.match(query, /Senior Backend Engineer/);
assert.match(query, /Postgres/);

// Soft-mode: seniority + role-family + business mismatches demote to softSignals,
// salary-floor and location stay as hard rejects.
const softJunior = evaluateHardFilters(
  { ...baseJob, title: "Junior Backend Engineer" },
  seniorBackendProfile,
  { softMode: true }
);
assert.equal(softJunior.status, "kept");
assert.deepEqual(softJunior.reasons, []);
assert.ok(softJunior.softSignals.seniority_mismatch > 0);

const softFrontend = evaluateHardFilters(
  { ...baseJob, title: "Frontend Engineer" },
  seniorBackendProfile,
  { softMode: true }
);
assert.equal(softFrontend.status, "kept");
assert.ok(softFrontend.softSignals.role_family_frontend_mismatch > 0);

const softSales = evaluateHardFilters(
  { ...baseJob, title: "Enterprise Account Executive" },
  seniorBackendProfile,
  { softMode: true }
);
assert.equal(softSales.status, "kept");
assert.ok(softSales.softSignals.role_family_business_mismatch > 0);

const softUnderpaid = evaluateHardFilters(
  { ...baseJob, compensationSummary: "$120k - $140k", salaryMax: undefined },
  seniorBackendProfile,
  { softMode: true }
);
assert.equal(softUnderpaid.status, "rejected");
assert.ok(softUnderpaid.reasons.includes("salary_below_minimum"));

const softLocationMismatch = evaluateHardFilters(
  { ...baseJob, location: "New York", isRemote: false },
  localOnlyProfile,
  { softMode: true }
);
assert.equal(softLocationMismatch.status, "rejected");
assert.ok(softLocationMismatch.reasons.includes("location_mismatch"));

// Soft penalties reduce ruleScore but don't bring it to zero.
const cleanRule = evaluateHardFilters(baseJob, seniorBackendProfile, { softMode: true });
assert.ok(softJunior.ruleScore < cleanRule.ruleScore);
assert.ok(softJunior.ruleScore > 0);

// Rich profile fields surface in the BM25 query.
const richProfile: RankingProfile = {
  ...seniorBackendProfile,
  repoHighlights: [
    {
      name: "demo/distributed-cache",
      summary: "Sharded LRU cache with consistent hashing.",
      languages: ["Rust", "Tokio"],
      stars: 42,
    },
  ],
  education: [{ school: "State University", degree: "BS", field: "Computer Science" }],
};
const richQuery = buildProfileSearchQuery(richProfile);
assert.match(richQuery, /distributed-cache/);
assert.match(richQuery, /Computer Science/);
