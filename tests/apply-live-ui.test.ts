import assert from "node:assert/strict";
import {
  applyHubMetrics,
  fieldProgress,
  normalizeConvexApplicationStatus,
  reduceLiveApplyEvent,
  seedLiveApplyJobs,
} from "../lib/apply-service/live-ui";
import type { ApplyRun } from "../lib/apply-service";

const run: ApplyRun = {
  id: "run_1",
  status: "filling",
  source: "recruit2-api",
  remoteRunId: "remote_1",
  settings: {
    maxApplicationsPerRun: 20,
    maxConcurrentApplications: 10,
    maxConcurrentPerDomain: 10,
    mode: "auto-strict",
    computerUseModel: "gpt-5.4-nano",
    devSkipRealSubmit: true,
  },
  jobs: [
    {
      id: "job_1",
      job: {
        id: "job_1",
        company: "Attio",
        title: "Solutions Engineer",
        url: "https://jobs.ashbyhq.com/attio/1",
      },
      status: "filling",
      remoteRunId: "remote_1",
      remoteJobSlug: "attio-1",
      screenshotPng: "raw",
      reviewItems: [],
      updatedAt: "2026-04-26T00:00:00.000Z",
    },
    {
      id: "job_2",
      job: {
        id: "job_2",
        company: "Aleph Alpha",
        title: "Engineer",
        url: "https://jobs.ashbyhq.com/aleph/2",
      },
      status: "review_ready",
      remoteRunId: "remote_1",
      remoteJobSlug: "aleph-2",
      reviewItems: [],
      updatedAt: "2026-04-26T00:00:00.000Z",
    },
  ],
  questionGroups: [],
  events: [],
  createdAt: "2026-04-26T00:00:00.000Z",
  updatedAt: "2026-04-26T00:00:00.000Z",
};

const seeded = seedLiveApplyJobs(run);
assert.equal(seeded.length, 2);
assert.equal(seeded[0]?.remoteSlug, "attio-1");
assert.equal(seeded[0]?.screenshotPng, "raw");

const withSnapshot = reduceLiveApplyEvent(seeded, {
  kind: "snapshot_taken",
  runId: "remote_1",
  jobSlug: "attio-1",
  fieldCount: 2,
  url: "https://jobs.ashbyhq.com/attio/1/application",
  title: "Attio application",
  annotatedScreenshotPng: "annotated",
});
assert.equal(withSnapshot[0]?.pageUrl, "https://jobs.ashbyhq.com/attio/1/application");
assert.equal(withSnapshot[0]?.screenshotPng, "annotated");
assert.equal(withSnapshot[0]?.fieldCount, 2);

const withSurfaceScreenshot = reduceLiveApplyEvent(withSnapshot, {
  kind: "surface_snapshot",
  runId: "remote_1",
  jobSlug: "aleph-2",
  fieldCount: 3,
  url: "https://jobs.ashbyhq.com/aleph/2/application",
  title: "Aleph application",
  screenshotPng: "surface",
});
assert.equal(withSurfaceScreenshot[1]?.pageUrl, "https://jobs.ashbyhq.com/aleph/2/application");
assert.equal(withSurfaceScreenshot[1]?.screenshotPng, "surface");
assert.equal(withSurfaceScreenshot[1]?.fieldCount, 3);

const withFields = [
  {
    kind: "field_set" as const,
    runId: "remote_1",
    jobSlug: "attio-1",
    fieldId: 1,
    label: "Name",
    selector: "#name",
    role: "textbox",
    required: true,
  },
  {
    kind: "field_set" as const,
    runId: "remote_1",
    jobSlug: "attio-1",
    fieldId: 2,
    label: "GitHub",
    selector: "#github",
    role: "textbox",
    required: false,
  },
  {
    kind: "field_filled" as const,
    runId: "remote_1",
    jobSlug: "attio-1",
    fieldId: 2,
    label: "GitHub",
    value: "https://github.com/anti-integral",
    via: "computer" as const,
  },
].reduce(reduceLiveApplyEvent, withSurfaceScreenshot);
assert.equal(withFields[0]?.fields.length, 2);
assert.deepEqual(fieldProgress(withFields[0]!), { total: 2, filled: 1, failed: 0, pending: 1 });

const withTimeline = reduceLiveApplyEvent(withFields, {
  kind: "agent_note",
  runId: "remote_1",
  jobSlug: "attio-1",
  stepIndex: 3,
  message: "AI filled GitHub from the profile links.",
});
assert.equal(withTimeline[0]?.timeline.at(-1)?.message, "AI filled GitHub from the profile links.");

const withStatus = reduceLiveApplyEvent(withTimeline, {
  kind: "status",
  runId: "remote_1",
  jobSlug: "attio-1",
  status: "submitted",
});
assert.equal(withStatus[0]?.status, "submitted");

const metrics = applyHubMetrics(withStatus);
assert.equal(metrics.total, 2);
assert.equal(metrics.active, 0);
assert.equal(metrics.needsReview, 1);
assert.equal(metrics.submitted, 1);
assert.equal(metrics.fieldsFilled, 1);
assert.equal(metrics.fieldsTotal, 5);

assert.equal(normalizeConvexApplicationStatus("browser_started"), "filling");
assert.equal(normalizeConvexApplicationStatus("filled_verified"), "review_ready");
assert.equal(normalizeConvexApplicationStatus("submitted_confirmed"), "submitted");
assert.equal(normalizeConvexApplicationStatus("failed_network"), "failed");
assert.equal(normalizeConvexApplicationStatus("failed_captcha_or_bot_challenge"), "awaiting_user_input");

console.log("Apply live UI tests passed");
