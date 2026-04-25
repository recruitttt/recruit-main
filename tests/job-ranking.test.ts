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
