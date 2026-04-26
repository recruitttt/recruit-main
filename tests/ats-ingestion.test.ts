import assert from "node:assert/strict";
import {
  normalizeGreenhouseJob,
  normalizeLeverJob,
  normalizeWorkdayJob,
  normalizeWorkableJob,
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
assert.equal(greenhouseJob?.dedupeKey, "greenhouse:acme:123");

const greenhouseDuplicate = normalizeGreenhouseJob(
  greenhouseSource,
  {
    id: 123,
    name: "Senior Voice Engineer",
    absolute_url: "https://boards.greenhouse.io/acme/jobs/123?ignored=true",
  },
  "run2"
);
assert.equal(greenhouseDuplicate?.dedupeKey, greenhouseJob?.dedupeKey);
assert.equal(normalizeGreenhouseJob(greenhouseSource, { id: 124, name: "", absolute_url: "https://x" }, "run1"), null);
assert.equal(normalizeGreenhouseJob(greenhouseSource, { id: 124, name: "Engineer" }, "run1"), null);

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
assert.equal(leverJob?.isRemote, false);
assert.equal(leverJob?.dedupeKey, "lever:beta:abc");

const remoteLeverJob = normalizeLeverJob(
  leverSource,
  {
    id: "remote-1",
    text: "Backend Engineer",
    hostedUrl: "https://jobs.lever.co/beta/remote-1",
    categories: { location: "Remote - Canada" },
  },
  "run1"
);
assert.equal(remoteLeverJob?.isRemote, true);
assert.equal(normalizeLeverJob(leverSource, { id: "bad", hostedUrl: "https://jobs.lever.co/beta/bad" }, "run1"), null);

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
assert.equal(workdayJob?.publishedAt, "2026-04-18");
assert.equal(
  normalizeWorkdayJob(workdaySource, { Job_ID: "wd-bad", Job_URL: "https://gamma/jobs/wd-bad" }, "run1"),
  null
);

const workableSource: AtsSource = {
  provider: "workable",
  company: "Delta",
  slug: "delta",
};

const workableJob = normalizeWorkableJob(
  workableSource,
  {
    shortcode: "ABC123",
    title: "Solutions Engineer",
    url: "https://apply.workable.com/j/ABC123",
    application_url: "https://apply.workable.com/j/ABC123/apply",
    published_on: "2026-04-19",
    city: "London",
    country: "United Kingdom",
    telecommuting: true,
    employment_type: "Full-time",
    department: "Solutions",
    description: "<p>Work with customers.</p>",
  },
  "run1"
);

assert.equal(workableJob?.sourceSlug, "workable:delta");
assert.equal(workableJob?.dedupeKey, "workable:delta:ABC123");
assert.equal(workableJob?.isRemote, true);
assert.equal(workableJob?.location, "London, United Kingdom");
assert.equal(workableJob?.descriptionPlain, "Work with customers.");
assert.equal(normalizeWorkableJob(workableSource, { shortcode: "bad" }, "run1"), null);

assert.equal(stripHtml("<p>One&nbsp;&amp;&nbsp;two</p>"), "One & two");
assert.equal(stripHtml("<p>Line one</p><br><p>Line&nbsp;two</p>"), "Line one Line two");

console.log("ATS ingestion normalizer tests passed");
