import assert from "node:assert/strict";
import {
  normalizeGreenhouseJob,
  normalizeLeverJob,
  normalizeWorkdayJob,
  stripHtml,
  type AtsSource,
} from "../convex/atsIngestion";

const greenhouseSource: AtsSource = {
  provider: "greenhouse",
  company: "Acme AI",
  slug: "acme",
};

const greenhouseJob = normalizeGreenhouseJob(
  greenhouseSource,
  {
    id: 123,
    name: "Senior Voice Engineer",
    absolute_url: "https://boards.greenhouse.io/acme/jobs/123",
    updated_at: "2026-04-20T00:00:00Z",
    location: { name: "Remote US" },
    departments: [{ name: "Engineering" }],
    offices: [{ name: "New York" }],
    content: "<p>Build voice agents.</p>",
    metadata: [
      { name: "Employment Type", value: "Full-time" },
      { name: "Compensation", value: "$180k - $220k" },
    ],
  },
  "run1"
);

assert.equal(greenhouseJob?.sourceSlug, "greenhouse:acme");
assert.equal(greenhouseJob?.department, "Engineering");
assert.equal(greenhouseJob?.isRemote, true);
assert.equal(greenhouseJob?.salaryMin, 180000);
assert.equal(greenhouseJob?.salaryMax, 220000);

const leverSource: AtsSource = {
  provider: "lever",
  company: "Beta Labs",
  slug: "beta",
  config: { region: "global" },
};

const leverJob = normalizeLeverJob(
  leverSource,
  {
    id: "abc",
    text: "Product Engineer",
    hostedUrl: "https://jobs.lever.co/beta/abc",
    applyUrl: "https://jobs.lever.co/beta/abc/apply",
    categories: {
      commitment: "Full-time",
      department: "Product",
      location: "San Francisco",
      team: "Core",
    },
    workplaceType: "hybrid",
    descriptionPlain: "Ship product.",
    salaryRange: { min: 150000, max: 190000, currency: "USD" },
  },
  "run1"
);

assert.equal(leverJob?.sourceSlug, "lever:beta");
assert.equal(leverJob?.employmentType, "Full-time");
assert.equal(leverJob?.team, "Core");
assert.equal(leverJob?.salaryMin, 150000);
assert.equal(leverJob?.currency, "USD");

const workdaySource: AtsSource = {
  provider: "workday",
  company: "Gamma",
  slug: "gamma-report",
  config: {
    columns: {
      jobId: "Job_ID",
      title: "Job_Title",
      jobUrl: "Job_URL",
      descriptionPlain: "Description",
      publishedAt: "Posted_Date",
    },
  },
};

const workdayJob = normalizeWorkdayJob(
  workdaySource,
  {
    Job_ID: "wd-1",
    Job_Title: "ML Platform Engineer",
    Job_URL: "https://gamma.wd1.myworkdayjobs.com/jobs/wd-1",
    Description: "Own model infrastructure.",
    Posted_Date: "2026-04-18",
    location: "Remote",
  },
  "run1"
);

assert.equal(workdayJob?.sourceSlug, "workday:gamma-report");
assert.equal(workdayJob?.dedupeKey, "workday:gamma-report:wd-1");
assert.equal(workdayJob?.isRemote, true);
assert.equal(workdayJob?.descriptionPlain, "Own model infrastructure.");
assert.equal(stripHtml("<p>One&nbsp;&amp;&nbsp;two</p>"), "One & two");

console.log("ATS ingestion normalizer tests passed");
