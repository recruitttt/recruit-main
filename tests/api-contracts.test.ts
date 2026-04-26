import assert from "node:assert/strict";

import { GET as getCheckoutConfig, POST as postCheckout } from "../app/api/checkout/route";
import { POST as postResearchJob } from "../app/api/research/job/route";
import { POST as postTailorJob } from "../app/api/tailor/job/route";
import { POST as postParseResume } from "../app/api/parse/resume/route";
import { POST as postRunFirst3 } from "../app/api/dashboard/run-first-3/route";
import {
  POST as postRunIngestion,
  parseProviderSelection,
} from "../app/api/dashboard/run-ingestion/route";
import { GET as getJobDetail } from "../app/api/dashboard/job-detail/route";
import { GET as getDashboardLive } from "../app/api/dashboard/live/route";
import { POST as postCustomJd } from "../app/api/dashboard/custom-jd/route";
import { GET as getFollowups, POST as postFollowups } from "../app/api/dashboard/followups/route";
import { POST as postDashboardTailorJob } from "../app/api/dashboard/tailor-job/route";
import { POST as postDlq } from "../app/api/dlq/route";
import type { UserProfile } from "../lib/profile";
import type { Job, JobResearch } from "../lib/tailor/types";
import { assertJsonResponse, badJsonRequest, installFetchStub, jsonRequest, withEnvAsync } from "./helpers";

async function main() {
await assertJsonResponse(await postResearchJob(badJsonRequest()), 400, {
  ok: false,
  reason: "bad_request",
});
await assertJsonResponse(await postResearchJob(jsonRequest({})), 400, {
  ok: false,
  reason: "missing_job_url",
});
await assertJsonResponse(
  await postResearchJob(jsonRequest({ job: { id: "job_1", company: "Acme", role: "Engineer" } })),
  400,
  { ok: false, reason: "missing_job_url" }
);
await withEnvAsync(
  {
    OPENAI_API_KEY: undefined,
    AI_GATEWAY_API_KEY: undefined,
    GEMINI_API_KEY: undefined,
    RESEARCH_PROVIDER: undefined,
    RESEARCH_MODEL: undefined,
    GEMMA_RESEARCH_MODEL: undefined,
  },
  async () => {
    await assertJsonResponse(
      await postResearchJob(
        jsonRequest({
          job: {
            id: "job_1",
            company: "Acme",
            role: "Engineer",
            jobUrl: "https://jobs.example/acme/1",
          },
        })
      ),
      503,
      { ok: false, reason: "no_api_key" }
    );
  }
);

await assertJsonResponse(await postTailorJob(badJsonRequest()), 400, {
  ok: false,
  reason: "bad_request",
});
await assertJsonResponse(await postTailorJob(jsonRequest({})), 400, {
  ok: false,
  reason: "missing_profile_or_research_or_job",
});

const job: Job = {
  id: "job_1",
  company: "Acme",
  role: "Backend Engineer",
  jobUrl: "https://jobs.example/acme/1",
};
const research: JobResearch = {
  jobUrl: job.jobUrl,
  company: job.company,
  role: job.role,
  jdSummary: "Build APIs.",
  responsibilities: ["Build APIs"],
  requirements: ["TypeScript"],
  niceToHaves: [],
  techStack: ["TypeScript"],
  companyMission: "",
  companyProducts: [],
  cultureSignals: [],
  source: "title-only",
  modelDurationMs: 0,
};
const incompleteProfile = {
  name: "Ada",
  email: "ada@example.com",
  links: {},
  experience: [],
  education: [],
  skills: [],
  prefs: { roles: [], locations: [] },
  suggestions: [],
  provenance: {},
  log: [],
  updatedAt: "2026-04-25T00:00:00.000Z",
} satisfies UserProfile;

await assertJsonResponse(
  await postTailorJob(jsonRequest({ profile: incompleteProfile, research, job })),
  400,
  { ok: false, reason: "profile_incomplete" }
);
await withEnvAsync(
  {
    OPENAI_API_KEY: undefined,
    AI_GATEWAY_API_KEY: undefined,
    GEMINI_API_KEY: undefined,
    TAILOR_PROVIDER: undefined,
    TAILOR_MODEL: undefined,
    GEMMA_TAILOR_MODEL: undefined,
  },
  async () => {
    await assertJsonResponse(
      await postTailorJob(
        jsonRequest({
          profile: {
            ...incompleteProfile,
            experience: [{ company: "Acme", title: "Engineer" }],
          },
          research,
          job,
        })
      ),
      503,
      { ok: false, reason: "no_api_key" }
    );
  }
);

await assertJsonResponse(await postParseResume(badJsonRequest()), 400, {
  ok: false,
  reason: "bad_request",
});
await assertJsonResponse(
  await postParseResume(new Request("http://test.local/api/parse/resume", { method: "POST", body: new FormData() })),
  400,
  { ok: false, reason: "missing_file" }
);

await withEnvAsync({ STRIPE_SECRET_KEY: undefined, STRIPE_CHECKOUT_MOCK: undefined }, async () => {
  await assertJsonResponse(await getCheckoutConfig(), 200, { configured: false, mode: "disabled" });
  await assertJsonResponse(
    await postCheckout(jsonRequest({ tier: "standard" }, "http://test.local/api/checkout")),
    503,
    { error: "checkout_unconfigured" }
  );
});

await withEnvAsync({ STRIPE_SECRET_KEY: undefined, STRIPE_CHECKOUT_MOCK: "1" }, async () => {
  await assertJsonResponse(await getCheckoutConfig(), 200, { configured: true, mode: "mock" });
  const checkoutJson = await assertJsonResponse(
    await postCheckout(jsonRequest({ tier: "standard" }, "http://test.local/api/checkout")),
    200,
    {}
  );
  assert.equal(checkoutJson.url, "http://test.local/checkout/mock?tier=standard&plan=Standard&amount=1000");
});

await withEnvAsync({ STRIPE_SECRET_KEY: "sk_live_123", STRIPE_CHECKOUT_MOCK: "1" }, async () => {
  await assertJsonResponse(await getCheckoutConfig(), 200, { configured: false, mode: "disabled" });
  await assertJsonResponse(
    await postCheckout(jsonRequest({ tier: "standard" }, "http://test.local/api/checkout")),
    403,
    { error: "checkout_live_key_blocked" }
  );
});

await withEnvAsync({ STRIPE_SECRET_KEY: "sk_test_123", STRIPE_CHECKOUT_MOCK: undefined }, async () => {
  const restoreFetch = installFetchStub(async () => new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  try {
    await assertJsonResponse(await getCheckoutConfig(), 200, { configured: true, mode: "test" });
    await assertJsonResponse(
      await postCheckout(jsonRequest({ tier: "standard" }, "http://test.local/api/checkout")),
      200,
      { url: "https://checkout.stripe.test/session" }
    );
  } finally {
    restoreFetch();
  }
});

await withEnvAsync({
  DASHBOARD_DATA_SOURCE: undefined,
  NEXT_PUBLIC_CONVEX_URL: undefined,
  AI_GATEWAY_API_KEY: undefined,
  OPENAI_API_KEY: undefined,
  COHERE_API_KEY: undefined,
}, async () => {
  const replayJson = await assertJsonResponse(await postRunFirst3(), 200, {
    rankingWarning: null,
  });
  assert.equal((replayJson.ingestion as { runId?: string }).runId, "m973fa2ppmrpg4fxwz5kwdjzq185jszp");
  assert.equal((replayJson.fixture as { source?: string }).source, "data/om-demo");

  const liveJson = await assertJsonResponse(
    await getDashboardLive(new Request("http://test.local/api/dashboard/live")),
    200,
    {}
  );
  assert.equal((liveJson.recommendations as unknown[]).length, 9);
  assert.equal((liveJson.run as { recommendedCount?: number }).recommendedCount, 9);
  assert.match(
    String((liveJson.run as { scoringMode?: string }).scoringMode ?? ""),
    /^v2_/,
    "offline demo recommendations should be ranked by the v2 matching path"
  );
  const demoRecommendations = liveJson.recommendations as Array<{
    jobId?: string;
    company?: string;
    title?: string;
    score?: number;
    jobUrl?: string;
    organization?: { logoUrl?: string; prestigeTag?: string };
    job?: { jobUrl?: string; applyUrl?: string };
  }>;
  const firstRecommendation = demoRecommendations[0];
  assert.ok(firstRecommendation?.jobId, "first demo recommendation should have a job id");
  const demoCompanies = new Set(
    demoRecommendations.map((recommendation) => recommendation.company)
  );
  assert.equal(demoCompanies.has("Google DeepMind"), true);
  assert.equal(demoCompanies.has("OpenAI"), true);
  const deepMindRecommendation = demoRecommendations.find(
    (recommendation) => recommendation.company === "Google DeepMind"
  );
  assert.equal(deepMindRecommendation?.jobUrl, "https://recruit-company-pages.vercel.app/google-deepmind");
  assert.equal(deepMindRecommendation?.job?.jobUrl, "https://recruit-company-pages.vercel.app/google-deepmind");
  assert.equal(deepMindRecommendation?.job?.applyUrl, "https://recruit-company-pages.vercel.app/google-deepmind");
  assert.equal(
    demoRecommendations.every((recommendation) => Boolean(recommendation.jobUrl && recommendation.job?.jobUrl)),
    true
  );

  const omDetailJson = await assertJsonResponse(
    await getJobDetail(new Request(`http://test.local/api/dashboard/job-detail?jobId=${firstRecommendation.jobId}`)),
    200,
    {}
  );
  assert.equal((omDetailJson.detail as { job?: { company?: string } }).job?.company, firstRecommendation.company);
});

await withEnvAsync({
  DASHBOARD_DATA_SOURCE: undefined,
  NEXT_PUBLIC_CONVEX_URL: "https://convex.test",
  AI_GATEWAY_API_KEY: undefined,
  OPENAI_API_KEY: undefined,
  COHERE_API_KEY: undefined,
}, async () => {
  const liveJson = await assertJsonResponse(
    await getDashboardLive(new Request("http://test.local/api/dashboard/live")),
    200,
    {}
  );
  assert.equal(
    (liveJson.fixture as { source?: string }).source,
    "data/om-demo",
    "deployment builds with Convex configured should still serve checked-in sample jobs"
  );
});

await withEnvAsync({
  DASHBOARD_DATA_SOURCE: "convex",
  DASHBOARD_LIVE_CONVEX_ENABLED: "true",
  NEXT_PUBLIC_CONVEX_URL: undefined,
}, async () => {
  await assertJsonResponse(await postRunFirst3(), 500, {
    error: "NEXT_PUBLIC_CONVEX_URL is not configured.",
  });
  await assertJsonResponse(
    await postRunIngestion(jsonRequest({ providers: ["ashby"], limitSources: 1 })),
    503,
    { ok: false, reason: "missing_convex_url" }
  );
  await assertJsonResponse(
    await postRunIngestion(jsonRequest({ provider: "ashby" })),
    400,
    { ok: false, reason: "invalid_provider" }
  );
  await assertJsonResponse(
    await postRunIngestion(jsonRequest({ provider: "invalid" })),
    400,
    { ok: false, reason: "invalid_provider" }
  );
  await assertJsonResponse(
    await postRunIngestion(jsonRequest({})),
    503,
    { ok: false, reason: "missing_convex_url" }
  );
  await assertJsonResponse(
    await getJobDetail(new Request("http://test.local/api/dashboard/job-detail")),
    400,
    { error: "missing_job_id" }
  );
  await assertJsonResponse(
    await getJobDetail(new Request("http://test.local/api/dashboard/job-detail?jobId=job_1")),
    503,
    { error: "missing_convex_url" }
  );
  await assertJsonResponse(await postCustomJd(jsonRequest({})), 503, {
    ok: false,
    reason: "missing_convex_url",
  });
  const followupsJson = await assertJsonResponse(await getFollowups(), 200, {});
  assert.deepEqual(followupsJson.summary, {
    applications: [],
    dueTasks: [],
    scheduledTasks: [],
    counts: {
      applications: 0,
      applied: 0,
      due: 0,
      responses: 0,
      interviews: 0,
      rejectedClosed: 0,
    },
  });
  await assertJsonResponse(await postFollowups(jsonRequest({ action: "mark-applied" })), 503, {
    ok: false,
    reason: "missing_convex_url",
  });
  await assertJsonResponse(await postDashboardTailorJob(jsonRequest({ jobId: "job_1" })), 503, {
    ok: false,
    reason: "missing_convex_url",
  });
});

await withEnvAsync({ NEXT_PUBLIC_CONVEX_URL: "https://convex.test", RECRUIT_E2E_FIXTURES: undefined }, async () => {
  await assertJsonResponse(await postRunIngestion(badJsonRequest()), 400, {
    ok: false,
    reason: "bad_request",
  });
  await assertJsonResponse(
    await postRunIngestion(jsonRequest({ provider: "invalid" })),
    400,
    { ok: false, reason: "invalid_provider" }
  );
  await assertJsonResponse(
    await postRunIngestion(jsonRequest({ providers: ["ashby", "unknown"] })),
    400,
    { ok: false, reason: "invalid_provider" }
  );
  await assertJsonResponse(
    await postRunIngestion(jsonRequest({ providers: [] })),
    400,
    { ok: false, reason: "invalid_provider" }
  );
  await assertJsonResponse(
    await postRunIngestion(jsonRequest({ providers: ["ashby"], limitSources: 0 })),
    400,
    { ok: false, reason: "invalid_limit_sources" }
  );
  await assertJsonResponse(
    await getJobDetail(new Request("http://test.local/api/dashboard/job-detail")),
    400,
    { error: "missing_job_id" }
  );
  await assertJsonResponse(await postCustomJd(badJsonRequest()), 400, {
    ok: false,
    reason: "bad_request",
  });
  await assertJsonResponse(
    await postCustomJd(jsonRequest({ company: "Acme", role: "Engineer", descriptionPlain: "" })),
    400,
    { ok: false, reason: "missing_required_custom_jd_fields" }
  );
  await assertJsonResponse(await postFollowups(badJsonRequest()), 400, {
    ok: false,
    reason: "bad_request",
  });
  await assertJsonResponse(await postFollowups(jsonRequest({ action: "unknown" })), 400, {
    ok: false,
    reason: "unknown_action",
  });
  await assertJsonResponse(await postFollowups(jsonRequest({ action: "mark-test-applied" })), 403, {
    ok: false,
    reason: "fixtures_disabled",
  });
  await assertJsonResponse(
    await postDlq(jsonRequest({ action: "reset-test-fixture", itemId: "dlq_2" })),
    403,
    { error: "fixtures_disabled" }
  );
  await assertJsonResponse(
    await postFollowups(jsonRequest({ action: "mark-applied", company: "", title: "" })),
    400,
    { ok: false, reason: "missing_application_fields" }
  );
  await assertJsonResponse(await postDashboardTailorJob(badJsonRequest()), 400, {
    ok: false,
    reason: "bad_request",
  });
  await assertJsonResponse(await postDashboardTailorJob(jsonRequest({})), 400, {
    ok: false,
    reason: "missing_job",
  });
});

assert.deepEqual(parseProviderSelection(undefined), { ok: true, value: ["ashby"] });
assert.deepEqual(parseProviderSelection(["ashby"]), { ok: true, value: ["ashby"] });
assert.deepEqual(parseProviderSelection(["ashby", "greenhouse"]), {
  ok: true,
  value: ["ashby", "greenhouse"],
});
assert.deepEqual(parseProviderSelection(["unknown"]), { ok: false });

console.log("API contract tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
