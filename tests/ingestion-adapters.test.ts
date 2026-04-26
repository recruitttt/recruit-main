import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  normalizeAshbyJob,
  normalizeGreenhouseJob,
  normalizeLeverJob,
  normalizeSource,
  normalizeWorkableJob,
} from "../lib/ingestion/adapters";
import { dedupeJobs, runIngestionSmoke } from "../lib/ingestion/smoke";
import type { IngestionSource } from "../lib/ingestion/types";

async function main() {
const ashbySource: IngestionSource = {
  provider: "ashby",
  company: "Attio",
  slug: "attio",
};
const greenhouseSource: IngestionSource = {
  provider: "greenhouse",
  company: "Airtable",
  slug: "airtable",
};
const leverSource: IngestionSource = {
  provider: "lever",
  company: "Mistral AI",
  slug: "mistral",
};
const workableSource: IngestionSource = {
  provider: "workable",
  company: "Workable Demo",
  slug: "workable",
};

const ashbyJob = normalizeAshbyJob(ashbySource, {
  title: "Product Engineer",
  jobUrl: "https://jobs.ashbyhq.com/attio/abc?utm_source=test",
  location: "Remote",
  descriptionPlain: "Build CRM primitives.",
  compensation: { compensationTierSummary: "$120k - $160k" },
});
assert.equal(ashbyJob?.provider, "ashby");
assert.equal(ashbyJob?.isRemote, true);
assert.equal(ashbyJob?.salaryMin, 120000);
assert.equal(ashbyJob?.dedupeKey, "ashby:attio:https://jobs.ashbyhq.com/attio/abc");

const greenhouseJob = normalizeGreenhouseJob(greenhouseSource, {
  id: 123,
  title: "AI Engineer",
  absolute_url: "https://job-boards.greenhouse.io/airtable/jobs/123",
  location: { name: "San Francisco" },
  offices: [{ name: "Remote US" }],
  departments: [{ name: "Engineering" }],
  content: "<p>Ship AI features.</p>",
  metadata: [{ name: "Compensation", value: "$180k - $220k" }],
});
assert.equal(greenhouseJob?.sourceSlug, "greenhouse:airtable");
assert.equal(greenhouseJob?.descriptionPlain, "Ship AI features.");
assert.equal(greenhouseJob?.isRemote, true);

const leverJob = normalizeLeverJob(leverSource, {
  id: "post_1",
  text: "Forward Deployed Engineer",
  hostedUrl: "https://jobs.lever.co/mistral/post_1",
  categories: { team: "Deployment", location: "Paris" },
  salaryRange: { min: 100000, max: 140000, currency: "EUR" },
});
assert.equal(leverJob?.team, "Deployment");
assert.equal(leverJob?.currency, "EUR");

const workableJob = normalizeWorkableJob(workableSource, {
  shortcode: "ABC123",
  title: "Solutions Engineer",
  url: "https://apply.workable.com/workable/j/ABC123/",
  location: { city: "London", country: "United Kingdom" },
  description: "<p>Work with customers.</p>",
});
assert.equal(workableJob?.provider, "workable");
assert.equal(workableJob?.location, "London, United Kingdom");
assert.equal(workableJob?.descriptionPlain, "Work with customers.");

assert.equal(normalizeSource({ provider: "unknown", company: "Bad", slug: "bad" }), null);
assert.deepEqual(
  dedupeJobs([
    ashbyJob!,
    { ...ashbyJob!, dedupeKey: "different-key" },
  ]).duplicateCount,
  1
);

const tempRoot = await mkdtemp(path.join(tmpdir(), "recruit-ingestion-test-"));
const sourcesPath = path.join(tempRoot, "sources.json");
const outputRoot = path.join(tempRoot, "runs");
await writeFile(
  sourcesPath,
  JSON.stringify([
    ashbySource,
    greenhouseSource,
    { provider: "greenhouse", company: "Stale Co", slug: "stale", enabled: true },
    leverSource,
    workableSource,
  ]),
  "utf8"
);

const fetchStub = async (input: string | URL | Request) => {
  const url = String(input);
  if (url.includes("posting-api/job-board/attio")) {
    return jsonResponse({
      jobs: [
        {
          title: "Product Engineer",
          jobUrl: "https://jobs.ashbyhq.com/attio/abc",
          location: "Remote",
        },
      ],
    });
  }
  if (url.includes("boards-api.greenhouse.io") && url.includes("/airtable/")) {
    return jsonResponse({
      jobs: [
        {
          id: 123,
          title: "AI Engineer",
          absolute_url: "https://job-boards.greenhouse.io/airtable/jobs/123",
        },
      ],
    });
  }
  if (url.includes("boards-api.greenhouse.io") && url.includes("/stale/")) {
    return jsonResponse({ message: "not found" }, 404);
  }
  if (url.includes("api.lever.co") && url.includes("/mistral")) {
    return jsonResponse([
      {
        id: "post_1",
        text: "Forward Deployed Engineer",
        hostedUrl: "https://jobs.lever.co/mistral/post_1",
      },
    ]);
  }
  if (url.includes("apply.workable.com/api/v1/widget/accounts/workable")) {
    return jsonResponse({
      jobs: [
        {
          shortcode: "ABC123",
          title: "Solutions Engineer",
          url: "https://apply.workable.com/workable/j/ABC123/",
        },
      ],
    });
  }
  return jsonResponse({ message: `unexpected ${url}` }, 500);
};

const defaultSmoke = await runIngestionSmoke({
  sourcesPath,
  outputRoot,
  fetchFn: fetchStub as typeof fetch,
  now: new Date("2026-04-25T11:59:00.000Z"),
});
assert.deepEqual(defaultSmoke.summary.providers, ["ashby"]);
assert.equal(defaultSmoke.summary.sourceCount, 1);
assert.equal(defaultSmoke.summary.rawJobCount, 1);

const { summary, artifactPath } = await runIngestionSmoke({
  sourcesPath,
  outputRoot,
  providers: ["ashby", "greenhouse", "lever", "workable"],
  concurrency: 3,
  fetchFn: fetchStub as typeof fetch,
  now: new Date("2026-04-25T12:00:00.000Z"),
});

assert.equal(summary.ok, false);
assert.equal(summary.sourceCount, 5);
assert.equal(summary.rawJobCount, 4);
assert.equal(summary.dedupedJobCount, 4);
assert.equal(summary.errors.length, 1);
assert.equal(summary.errors[0].slug, "stale");
assert.equal(summary.sourceStatuses.find((status) => status.slug === "stale")?.statusCode, 404);
assert.equal(summary.providerTotals.find((total) => total.provider === "greenhouse")?.failedSourceCount, 1);

const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as typeof summary;
assert.equal(artifact.dedupedJobCount, 4);
assert.equal(artifact.sampleJobs.length, 4);

console.log("Local ingestion adapter tests passed");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
