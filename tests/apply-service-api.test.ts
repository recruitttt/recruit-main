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
import {
  POST as focusRecruit2Job,
} from "../app/api/applications/runs/[runId]/jobs/[jobId]/focus/route";
import {
  GET as proxyRecruit2Events,
} from "../app/api/applications/runs/[runId]/recruit2/events/route";
import { startConvexApplyRun } from "../lib/apply-service/convex-engine";
import { getApplyRunStore, startRecruit2ApplyRun } from "../lib/apply-service";

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

  const originalFetch = globalThis.fetch;
  process.env.RECRUIT2_APPLY_API_URL = "http://recruit2.test";
  globalThis.fetch = (async () => Response.json({
    runId: "remote_started_1",
    jobs: [
      { slug: "remote_job_1", url: "https://jobs.ashbyhq.com/acme/1/application" },
      { slug: "remote_job_2", url: "https://jobs.ashbyhq.com/beta/2" },
    ],
  })) as unknown as typeof fetch;
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
  globalThis.fetch = originalFetch;
  process.env.RECRUIT2_APPLY_API_URL = "";
  assert.equal(started.status, 200);
  const startedBody = await started.json() as {
    ok: true;
    run: { id: string; jobs: Array<{ id: string; status: string }>; settings: { maxConcurrentApplications: number } };
  };
  assert.equal(startedBody.ok, true);
  assert.equal(startedBody.run.jobs.length, 2);
  assert.equal(startedBody.run.settings.maxConcurrentApplications, 15);

  const unreachableRecruit2 = await startRecruit2ApplyRun({
    jobs: [
      {
        id: "job_unreachable_direct",
        company: "Acme",
        title: "AI Engineer",
        url: "https://jobs.ashbyhq.com/acme/unreachable-direct",
      },
    ],
    profile: { name: "Om Sanan", email: "om@example.com" },
    tailoredResumes: {},
    settings: {
      maxApplicationsPerRun: 20,
      maxConcurrentApplications: 10,
      maxConcurrentPerDomain: 10,
      mode: "manual",
      devSkipRealSubmit: true,
      computerUseModel: "gpt-5.4-nano",
    },
    consent: { externalTargetsApproved: true },
  }, {
    baseUrl: "http://recruit2.test",
    fetchImpl: (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch,
  });
  assert.equal(unreachableRecruit2.ok, false);
  assert.equal(unreachableRecruit2.status, 503);
  assert.match(unreachableRecruit2.reason, /^apply_engine_unreachable: fetch failed/);

  const convexStarted = await startConvexApplyRun({
    jobs: [
      {
        id: "job_convex_1",
        company: "Acme",
        title: "AI Engineer",
        url: "https://jobs.ashbyhq.com/acme/convex-1",
      },
      {
        id: "job_convex_2",
        company: "Beta",
        title: "Backend Engineer",
        url: "https://jobs.lever.co/beta/11111111-1111-4111-8111-111111111111",
      },
    ],
    profile: { name: "Om Sanan", email: "om@example.com" },
    tailoredResumes: {},
    settings: {
      maxApplicationsPerRun: 20,
      maxConcurrentApplications: 10,
      maxConcurrentPerDomain: 10,
      mode: "manual",
      devSkipRealSubmit: true,
      computerUseModel: "gpt-5.4-nano",
    },
    consent: { externalTargetsApproved: true },
  }, {
    client: {
      mutation: async (_ref: unknown, args: { targetUrl: string; providerHint?: string }) => ({
        jobId: `convex_${args.providerHint}_${args.targetUrl.includes("lever") ? "2" : "1"}`,
        scheduled: true,
      }),
    } as never,
  });
  assert.equal(convexStarted.ok, true);
  assert.equal(convexStarted.ok ? convexStarted.jobs.length : 0, 2);
  assert.equal(convexStarted.ok ? convexStarted.jobs[0]?.jobId : "", "convex_ashby_1");

  process.env.RECRUIT2_APPLY_API_URL = "http://recruit2.test";
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  try {
    const unavailableStarted = await startBatch(jsonRequest({
      jobs: [
        {
          id: "job_unreachable",
          company: "Acme",
          title: "AI Engineer",
          url: "https://jobs.ashbyhq.com/acme/unreachable",
        },
      ],
      profile: {
        name: "Om Sanan",
        email: "om@example.com",
      },
      settings: {
        devSkipRealSubmit: true,
      },
      consent: { externalTargetsApproved: true },
    }));
    assert.equal(unavailableStarted.status, 503);
    const unavailableStartedBody = await unavailableStarted.json() as { ok: false; reason: string };
    assert.equal(unavailableStartedBody.ok, false);
    assert.match(unavailableStartedBody.reason, /^apply_engine_unreachable: fetch failed/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.RECRUIT2_APPLY_API_URL = "";
  }

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

  process.env.RECRUIT2_APPLY_API_URL = "http://recruit2.test";
  const questionProxyRequests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    questionProxyRequests.push(String(input));
    const resolved = init?.method === "POST";
    return Response.json({
      ok: true,
      groups: [
        {
          groupId: "primary_programming_language",
          normalizedKey: "primary_programming_language",
          category: "primary_programming_language",
          displayQuestion: "What is your main development language?",
          provisionalValue: "Python",
          confidence: 0.4,
          status: resolved ? "resolved" : "pending",
          resolvedValue: resolved ? "Python" : undefined,
          targets: [
            {
              id: "remote_q1",
              jobSlug: "remote_job_1",
              fieldLabel: "Language",
              selector: "#language",
              provisionalValue: "Python",
            },
          ],
        },
      ],
    });
  }) as typeof fetch;
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
  assert.equal(
    questionProxyRequests[0],
    "http://recruit2.test/api/apply-lab/runs/remote_started_1/questions",
  );
  assert.equal(
    questionProxyRequests[1],
    "http://recruit2.test/api/apply-lab/runs/remote_started_1/questions/resolve-batch",
  );
  globalThis.fetch = originalFetch;
  process.env.RECRUIT2_APPLY_API_URL = "";

  const approveResponse = await approveJob(jsonRequest({
    devSkipRealSubmit: true,
  }, `http://test.local/api/applications/runs/${runId}/jobs/${jobId}/approve`), {
    params: { runId, jobId },
  } as never);
  assert.equal(approveResponse.status, 200);
  assert.equal((await approveResponse.json() as { job: { status: string } }).job.status, "submitted_dev");

  getApplyRunStore().attachRemoteRun(runId, "remote_run_1", [
    { slug: "remote_job_1", url: "https://jobs.ashbyhq.com/acme/1/application" },
    { slug: "remote_job_2", url: "https://jobs.ashbyhq.com/beta/2" },
  ]);
  process.env.RECRUIT2_APPLY_API_URL = "http://recruit2.test";
  const proxiedRequests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    proxiedRequests.push({ url: String(input), init });
    if (String(input).endsWith("/events")) {
      return new Response("event: status\ndata: {}\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    }
    return Response.json({ ok: true, screenshotPng: "focused" });
  }) as typeof fetch;
  try {
    const focusResponse = await focusRecruit2Job(jsonRequest({
      stepIndex: 0,
      selector: "#name",
      label: "Name",
    }, `http://test.local/api/applications/runs/${runId}/jobs/${jobId}/focus`), {
      params: { runId, jobId },
    } as never);
    assert.equal(focusResponse.status, 200);
    assert.equal((await focusResponse.json() as { screenshotPng: string }).screenshotPng, "focused");
    assert.equal(
      proxiedRequests[0]?.url,
      "http://recruit2.test/api/apply-lab/runs/remote_run_1/jobs/remote_job_1/focus",
    );

    const eventsProxyResponse = await proxyRecruit2Events(
      new Request(`http://test.local/api/applications/runs/${runId}/recruit2/events`),
      { params: { runId } } as never,
    );
    assert.equal(eventsProxyResponse.status, 200);
    assert.equal(eventsProxyResponse.headers.get("content-type"), "text/event-stream");
    assert.equal(await eventsProxyResponse.text(), "event: status\ndata: {}\n\n");
  } finally {
    globalThis.fetch = originalFetch;
    process.env.RECRUIT2_APPLY_API_URL = "";
  }

  console.log("Apply service API tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
