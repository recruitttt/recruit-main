import assert from "node:assert/strict";
import { POST as startBatch } from "../app/api/applications/batch/start/route";
import { GET as getRun } from "../app/api/applications/runs/[runId]/route";
import { GET as getEvents } from "../app/api/applications/runs/[runId]/events/route";
import {
  GET as getQuestions,
} from "../app/api/applications/runs/[runId]/questions/route";
import {
  POST as resolveQuestions,
} from "../app/api/applications/runs/[runId]/questions/resolve-batch/route";
import {
  POST as approveJob,
} from "../app/api/applications/runs/[runId]/jobs/[jobId]/approve/route";
import { getApplyRunStore } from "../lib/apply-service";

process.env.RECRUIT2_APPLY_API_URL = "";
process.env.APPLY_LAB_PUBLIC_BASE_URL = "";

function jsonRequest(body: unknown, url = "http://test.local/api/applications/batch/start") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function main() {
  const bad = await startBatch(new Request("http://test.local/api/applications/batch/start", {
    method: "POST",
    body: "{bad",
  }));
  assert.equal(bad.status, 400);
  assert.equal((await bad.json() as { ok: boolean; reason: string }).reason, "bad_request");

  const missingConsent = await startBatch(jsonRequest({
    jobs: [{ id: "job_1", company: "Acme", title: "Engineer", url: "https://jobs.example.com/1" }],
    profile: {},
  }));
  assert.equal(missingConsent.status, 403);

  const started = await startBatch(jsonRequest({
    jobs: [
      {
        id: "job_1",
        company: "Acme",
        title: "AI Engineer",
        url: "https://jobs.ashbyhq.com/acme/1",
        applicationUrl: "https://jobs.ashbyhq.com/acme/1/application",
      },
      {
        id: "job_2",
        company: "Beta",
        title: "Backend Engineer",
        url: "https://jobs.ashbyhq.com/beta/2",
      },
    ],
    profile: {
      name: "Om Sanan",
      email: "om@example.com",
      phone: "914-282-7737",
      workAuthorization: {
        citizenship: ["United States"],
        authorizedToWorkUS: true,
        requiresSponsorshipNow: false,
        requiresSponsorshipFuture: false,
      },
    },
    tailoredResumes: {
      job_1: {
        jobId: "job_1",
        filename: "Om_Sanan_Acme.pdf",
        path: "/tmp/Om_Sanan_Acme.pdf",
      },
    },
    settings: {
      maxApplicationsPerRun: 20,
      maxConcurrentApplications: 15,
      maxConcurrentPerDomain: 15,
      computerUseModel: "gpt-5.4-mini",
    },
    consent: { externalTargetsApproved: true },
  }));
  assert.equal(started.status, 200);
  const startedBody = await started.json() as {
    ok: true;
    run: { id: string; jobs: Array<{ id: string; status: string }>; settings: { maxConcurrentApplications: number } };
  };
  assert.equal(startedBody.ok, true);
  assert.equal(startedBody.run.jobs.length, 2);
  assert.equal(startedBody.run.settings.maxConcurrentApplications, 15);

  const runId = startedBody.run.id;
  const jobId = startedBody.run.jobs[0]!.id;
  const runResponse = await getRun(new Request(`http://test.local/api/applications/runs/${runId}`), {
    params: { runId },
  } as never);
  assert.equal(runResponse.status, 200);
  assert.equal((await runResponse.json() as { run: { id: string } }).run.id, runId);

  const eventsResponse = await getEvents(new Request(`http://test.local/api/applications/runs/${runId}/events`), {
    params: { runId },
  } as never);
  assert.equal(eventsResponse.status, 200);
  assert.ok((await eventsResponse.json() as { events: unknown[] }).events.length >= 2);

  getApplyRunStore().recordDeferredQuestion(runId, {
    id: "q1",
    jobId,
    jobTitle: "AI Engineer",
    company: "Acme",
    prompt: "What is your main development language?",
    provisionalAnswer: "Python",
    confidence: 0.4,
    category: "primary_programming_language",
    field: { label: "Language", selector: "#language" },
  });

  const questionsResponse = await getQuestions(new Request(`http://test.local/api/applications/runs/${runId}/questions`), {
    params: { runId },
  } as never);
  assert.equal(questionsResponse.status, 200);
  assert.equal((await questionsResponse.json() as { groups: unknown[] }).groups.length, 1);

  const resolvedResponse = await resolveQuestions(jsonRequest({
    answers: {
      primary_programming_language: {
        answer: "Python",
        remember: true,
      },
    },
  }, `http://test.local/api/applications/runs/${runId}/questions/resolve-batch`), {
    params: { runId },
  } as never);
  assert.equal(resolvedResponse.status, 200);
  assert.equal((await resolvedResponse.json() as { groups: Array<{ status: string }> }).groups[0]?.status, "resolved");

  const approveResponse = await approveJob(jsonRequest({
    devSkipRealSubmit: true,
  }, `http://test.local/api/applications/runs/${runId}/jobs/${jobId}/approve`), {
    params: { runId, jobId },
  } as never);
  assert.equal(approveResponse.status, 200);
  assert.equal((await approveResponse.json() as { job: { status: string } }).job.status, "submitted_dev");

  console.log("Apply service API tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
