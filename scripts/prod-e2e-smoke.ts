#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { convexRefs } from "@/lib/convex-refs";
import { getPuppeteerBrowser } from "@/lib/pdf";
import { extractPdfTextForEvidence } from "@/lib/pdf-text";

type CliOptions = {
  baseUrl: string;
  label?: string;
  envFile: string;
  contractsOnly: boolean;
  skipIngestion: boolean;
  skipTailor: boolean;
  withFixtures: boolean;
  withAuthUi: boolean;
  withAtsStaging: boolean;
  dashboardIngestionFallback: boolean;
  limitSources: number;
  tailorLimit: number;
  pollTimeoutMs: number;
  help: boolean;
};

type StageStatus = "PASS" | "PARTIAL" | "FAIL" | "SKIP";

type StageResult = {
  stage: string;
  result: StageStatus;
  evidence: string;
  notes: string;
};

type RunContext = {
  runDir: string;
  resultsDir: string;
  artifacts: string[];
  stages: StageResult[];
  bugs: Array<{
    severity: string;
    stage: string;
    expected: string;
    actual: string;
    evidence: string;
    suggestedFix: string;
  }>;
  metrics: Record<string, string | number | null>;
  demoUserId: string | null;
  runId: string | null;
  topJobId: string | null;
  topJobLabel: string | null;
  authCookieHeader: string | null;
  realApplicationSubmitted: boolean;
  sensitiveFieldsGuessed: boolean;
  dlqAuditable: boolean | null;
};

const DEFAULT_BASE_URL = "https://recruit-main.vercel.app";
const DEFAULT_ENV_FILE = ".env.e2e.local";
const DEFAULT_POLL_TIMEOUT_MS = 8 * 60 * 1000;
const POLL_INTERVAL_MS = 5_000;
const TEST_PROFILE_UPDATED_AT = "2026-04-25T00:00:00.000Z";
const CONTRACTS = [
  {
    label: "research_malformed_json",
    method: "POST",
    path: "/api/research/job",
    rawBody: "{bad json",
    expectedStatus: 400,
    expectedKey: "reason",
    expectedValue: "bad_request",
  },
  {
    label: "research_missing_job_url",
    method: "POST",
    path: "/api/research/job",
    body: {},
    expectedStatus: 400,
    expectedKey: "reason",
    expectedValue: "missing_job_url",
  },
  {
    label: "tailor_missing_profile_research_job",
    method: "POST",
    path: "/api/tailor/job",
    body: {},
    expectedStatus: 400,
    expectedKey: "reason",
    expectedValue: "missing_profile_or_research_or_job",
  },
  {
    label: "run_ingestion_invalid_provider",
    method: "POST",
    path: "/api/dashboard/run-ingestion",
    body: { provider: "invalid" },
    expectedStatus: 400,
    expectedKey: "reason",
    expectedValue: "invalid_provider",
  },
  {
    label: "job_detail_missing_job_id",
    method: "GET",
    path: "/api/dashboard/job-detail",
    expectedStatus: 400,
    expectedKey: "error",
    expectedValue: "missing_job_id",
  },
] as const;

async function main() {
  if (process.argv.slice(2).some((arg) => arg === "--help" || arg === "-h")) {
    printHelp();
    return;
  }
  const envFile = parseEnvFileArg(process.argv.slice(2));
  const envLoad = await loadEnvFile(envFile);
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const startedAt = new Date();
  const runName = options.label ?? `prod-e2e-${stamp(startedAt)}`;
  const runDir = path.resolve(process.cwd(), "manual-runs", runName);
  const resultsDir = path.join(runDir, "results");
  await mkdir(resultsDir, { recursive: true });

  const ctx: RunContext = {
    runDir,
    resultsDir,
    artifacts: [],
    stages: [],
    bugs: [],
    metrics: {
      sourceCount: null,
      fetchedCount: null,
      rawJobCount: null,
      filteredCount: null,
      survivorCount: null,
      llmScoredCount: null,
      recommendedCount: null,
      tailoredCompletedCount: null,
      pdfByteLength: null,
      dlqCreatedCount: null,
      followupCount: null,
    },
    demoUserId: null,
    runId: null,
    topJobId: null,
    topJobLabel: null,
    authCookieHeader: null,
    realApplicationSubmitted: false,
    sensitiveFieldsGuessed: false,
    dlqAuditable: null,
  };

  console.log(`Recruit production smoke target: ${options.baseUrl}`);
  console.log(`E2E env file: ${envFile} (${envLoad.loaded ? "loaded" : "not found"})`);
  console.log(`Evidence directory: ${runDir}`);

  if (!options.contractsOnly && !preflightFullRun(options, ctx)) {
    const reportPath = await writeReport(options, ctx, startedAt);
    console.log(`Report: ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  await runApiContracts(options, ctx);

  if (options.contractsOnly) {
    addStage(ctx, "Auth/dashboard", "SKIP", "Not requested", "--contracts-only");
    addStage(ctx, "Onboarding/profile", "SKIP", "Not requested", "--contracts-only");
    addStage(ctx, "Ingestion", "SKIP", "Not requested", "--contracts-only");
    addStage(ctx, "Filtering/ranking", "SKIP", "Not requested", "--contracts-only");
    addStage(ctx, "Research", "SKIP", "Not requested", "--contracts-only");
    addStage(ctx, "Tailoring/PDF", "SKIP", "Not requested", "--contracts-only");
    addStage(ctx, "ATS staging", "SKIP", "Not requested", "--contracts-only");
    addStage(ctx, "DLQ/cache", "SKIP", "Not requested", "--contracts-only");
    addStage(ctx, "Follow-ups", "SKIP", "Not requested", "--contracts-only");
  } else {
    if (options.withAuthUi) {
      await runAuthenticatedUiSmoke(options, ctx);
    } else {
      addStage(ctx, "Auth/dashboard", "SKIP", "UI smoke not requested", "Use --with-auth-ui with E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.");
    }

    if (options.skipIngestion) {
      addStage(ctx, "Ingestion", "SKIP", "Not requested", "--skip-ingestion");
      addStage(ctx, "Filtering/ranking", "SKIP", "Not requested", "--skip-ingestion");
    } else {
      if (options.dashboardIngestionFallback) {
        await runDashboardIngestionFallback(options, ctx);
      } else {
        await runOnboardingPipeline(options, ctx);
      }
    }

    if (options.withAtsStaging) {
      await runAtsStaging(ctx);
    } else {
      addStage(ctx, "ATS staging", "SKIP", "Dry-run staging not requested", "Set E2E_ASHBY_STAGING_URL and pass --with-ats-staging.");
    }

    await runDlqAndFollowupChecks(options, ctx);
  }

  const reportPath = await writeReport(options, ctx, startedAt);
  console.log(`Report: ${reportPath}`);
  if (ctx.stages.some((stage) => stage.result === "FAIL")) {
    process.exitCode = 1;
  }
}

async function runApiContracts(options: CliOptions, ctx: RunContext) {
  const failures: string[] = [];
  for (const contract of CONTRACTS) {
    const response = await requestArtifact(ctx, contract.label, options.baseUrl, contract.path, {
      method: contract.method,
      headers: contract.method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: "rawBody" in contract
        ? contract.rawBody
        : "body" in contract
          ? JSON.stringify(contract.body)
          : undefined,
    });
    const actualValue = valueAt(response.json, contract.expectedKey);
    if (response.status !== contract.expectedStatus || actualValue !== contract.expectedValue) {
      failures.push(
        `${contract.label}: expected ${contract.expectedStatus} ${contract.expectedKey}=${contract.expectedValue}, got ${response.status} ${contract.expectedKey}=${String(actualValue)}`
      );
    }
  }

  if (failures.length === 0) {
    addStage(ctx, "API contracts", "PASS", "results/api_contracts_*.json", "All prompt payloads returned expected JSON errors.");
  } else {
    addStage(ctx, "API contracts", "FAIL", "results/api_contracts_*.json", failures.join("; "));
    for (const failure of failures) {
      addBug(ctx, "P0", "API contracts", "Exact runbook payload returns documented status/reason.", failure, "results/api_contracts_*.json", "Align route validation with production E2E contract.");
    }
  }
}

async function runOnboardingPipeline(options: CliOptions, ctx: RunContext) {
  const profile = buildE2ETestProfile();
  const launch = await requestArtifact(ctx, "onboarding_launch", options.baseUrl, "/api/onboarding/launch-pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile,
      limitSources: options.limitSources,
      tailorLimit: options.tailorLimit,
    }),
  });

  ctx.runId = stringOrNull(launch.json?.runId);
  ctx.demoUserId = stringOrNull(launch.json?.demoUserId);
  if (launch.status === 200 && launch.json?.ok === true && ctx.runId) {
    addStage(ctx, "Onboarding/profile", "PASS", "results/onboarding_launch.json", `runId=${ctx.runId}`);
  } else {
    addStage(ctx, "Onboarding/profile", "FAIL", "results/onboarding_launch.json", "Onboarding launch did not save the test profile and return a runId.");
    addBug(ctx, "P0", "Onboarding/profile", "Onboarding launch returns ok=true and runId.", JSON.stringify(launch.json), "results/onboarding_launch.json", "Check auth, Convex config, and onboarding launch route.");
    addStage(ctx, "Ingestion", "SKIP", "No onboarding run", "Cannot poll ingestion without runId.");
    addStage(ctx, "Filtering/ranking", "SKIP", "No onboarding run", "Cannot poll ranking without runId.");
    addStage(ctx, "Research", "SKIP", "No onboarding run", "Cannot fetch job detail without recommendations.");
    addStage(ctx, "Tailoring/PDF", "SKIP", "No onboarding run", "Cannot tailor without recommendations.");
    return;
  }

  const live = await pollDashboardLive(options, ctx, ctx.runId);
  const run = live.json?.run ?? null;
  const recommendations = Array.isArray(live.json?.recommendations) ? live.json.recommendations : [];
  assignMetric(ctx, "sourceCount", run?.sourceCount);
  assignMetric(ctx, "fetchedCount", run?.fetchedCount);
  assignMetric(ctx, "rawJobCount", run?.rawJobCount);
  assignMetric(ctx, "filteredCount", run?.filteredCount);
  assignMetric(ctx, "survivorCount", run?.survivorCount);
  assignMetric(ctx, "llmScoredCount", run?.llmScoredCount);
  assignMetric(ctx, "recommendedCount", run?.recommendedCount);

  const activeLogs = Array.isArray(live.json?.logs) && live.json.logs.length > 0;
  if (
    live.status === 200 &&
    run?._id === ctx.runId &&
    Number(run?.fetchedCount ?? 0) > 0 &&
    Number(run?.rawJobCount ?? 0) > 0 &&
    (run?.status === "completed" || activeLogs)
  ) {
    addStage(ctx, "Ingestion", "PASS", "results/dashboard_live.json", `runId=${ctx.runId}, status=${String(run.status)}`);
  } else {
    addStage(ctx, "Ingestion", "FAIL", "results/dashboard_live.json", "Onboarding-launched Ashby run did not fetch and store jobs before timeout.");
    addBug(ctx, "P0", "Ingestion", "Onboarding-launched Ashby run fetches and stores jobs.", JSON.stringify(live.json), "results/dashboard_live.json", "Check onboarding scheduled action, Ashby sources, and pipeline logs.");
  }

  if (
    recommendations.length > 0 &&
    Number(run?.survivorCount ?? 0) > 0 &&
    Number(run?.recommendedCount ?? 0) > 0 &&
    run?.scoringMode === "llm"
  ) {
    addStage(ctx, "Filtering/ranking", "PASS", "results/dashboard_live.json", `scoringMode=${String(run.scoringMode)}`);
  } else {
    addStage(ctx, "Filtering/ranking", "FAIL", "results/dashboard_live.json", `Expected recommendations with scoringMode=llm, got ${String(run?.scoringMode)}`);
    addBug(ctx, "P0", "Filtering/ranking", "Onboarding-launched run produces LLM recommendations.", JSON.stringify(run), "results/dashboard_live.json", "Verify OPENAI_API_KEY in Convex and ranking write results.");
  }

  await continueWithTopRecommendation(options, ctx, live);
}

async function runDashboardIngestionFallback(options: CliOptions, ctx: RunContext) {
  const ingestion = await requestArtifact(ctx, "bounded_ingestion", options.baseUrl, "/api/dashboard/run-ingestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providers: ["ashby"],
      limitSources: options.limitSources,
      rank: true,
    }),
  });

  const ashbyResult = Array.isArray(ingestion.json?.providers)
    ? ingestion.json.providers.find((item: any) => item?.provider === "ashby")
    : null;
  const ingestionBody = ashbyResult?.ingestion ?? null;
  const rankingBody = ashbyResult?.ranking ?? null;
  ctx.runId = stringOrNull(ingestionBody?.runId ?? rankingBody?.runId);
  assignMetric(ctx, "sourceCount", ingestionBody?.sourceCount);
  assignMetric(ctx, "fetchedCount", ingestionBody?.fetchedCount);
  assignMetric(ctx, "rawJobCount", ingestionBody?.rawJobCount);
  assignMetric(ctx, "filteredCount", rankingBody?.filteredCount);
  assignMetric(ctx, "survivorCount", rankingBody?.survivorCount);
  assignMetric(ctx, "llmScoredCount", rankingBody?.llmScoredCount);
  assignMetric(ctx, "recommendedCount", rankingBody?.recommendedCount);

  if (
    ingestion.status === 200 &&
    ashbyResult?.ok === true &&
    Number(ingestionBody?.fetchedCount ?? 0) > 0 &&
    Number(ingestionBody?.rawJobCount ?? 0) > 0
  ) {
    addStage(ctx, "Ingestion", "PASS", "results/bounded_ingestion.json", `runId=${ctx.runId ?? "unknown"}`);
  } else {
    addStage(ctx, "Ingestion", "FAIL", "results/bounded_ingestion.json", "Bounded Ashby ingestion did not return a successful run with fetched jobs.");
    addBug(ctx, "P0", "Ingestion", "Ashby-only bounded run fetches and stores jobs.", JSON.stringify(ingestion.json), "results/bounded_ingestion.json", "Check source seeding, provider selection, and Convex ingestion action logs.");
  }

  if (
    Number(rankingBody?.survivorCount ?? 0) > 0 &&
    Number(rankingBody?.recommendedCount ?? 0) > 0 &&
    rankingBody?.scoringMode === "llm"
  ) {
    addStage(ctx, "Filtering/ranking", "PASS", "results/bounded_ingestion.json", `scoringMode=${rankingBody.scoringMode}`);
  } else {
    addStage(ctx, "Filtering/ranking", "FAIL", "results/bounded_ingestion.json", `Expected recommendations with scoringMode=llm, got ${String(rankingBody?.scoringMode)}`);
    addBug(ctx, "P0", "Filtering/ranking", "LLM ranking produces at least one recommendation.", JSON.stringify(rankingBody), "results/bounded_ingestion.json", "Verify OPENAI_API_KEY in Convex and ranking write results.");
  }

  const live = await requestArtifact(ctx, "dashboard_live", options.baseUrl, scopedPath(ctx, "/api/dashboard/live"));
  await continueWithTopRecommendation(options, ctx, live);
}

async function continueWithTopRecommendation(
  options: CliOptions,
  ctx: RunContext,
  live: Awaited<ReturnType<typeof requestArtifact>>
) {
  const recommendations = Array.isArray(live.json?.recommendations) ? live.json.recommendations : [];
  const topRecommendation = recommendations[0];
  const topJob = topRecommendation?.job ?? null;
  ctx.topJobId = stringOrNull(topRecommendation?.jobId ?? topJob?._id);
  ctx.topJobLabel = [topJob?.company ?? topRecommendation?.company, topJob?.title ?? topRecommendation?.title]
    .filter(Boolean)
    .join(" - ") || null;

  if (!ctx.stages.some((stage) => stage.stage === "Onboarding/profile")) {
    if (live.status === 200 && ctx.topJobId) {
      addStage(ctx, "Onboarding/profile", "PARTIAL", "results/dashboard_live.json", "Profile persistence is not re-entered by this script; dashboard state loaded.");
    } else {
      addStage(ctx, "Onboarding/profile", "PARTIAL", "results/dashboard_live.json", "Dashboard live state did not expose a top recommendation.");
    }
  }

  if (!ctx.topJobId) {
    addStage(ctx, "Research", "SKIP", "No top recommendation", "Cannot fetch job detail without jobId.");
    addStage(ctx, "Tailoring/PDF", "SKIP", "No top recommendation", "Cannot tailor without jobId.");
    return;
  }

  const detail = await requestArtifact(
    ctx,
    "top_job_detail",
    options.baseUrl,
    scopedPath(ctx, `/api/dashboard/job-detail?jobId=${encodeURIComponent(ctx.topJobId)}`)
  );
  const research = detail.json?.detail?.tailoredApplication?.research ?? researchArtifact(detail.json?.detail?.artifacts);
  if (detail.status === 200 && research) {
    addStage(ctx, "Research", "PASS", "results/top_job_detail.json", `source=${String(research.source ?? "artifact")}`);
  } else {
    addStage(ctx, "Research", "PARTIAL", "results/top_job_detail.json", "Job detail loaded, but no persisted research snapshot was present before tailoring.");
  }

  if (options.skipTailor) {
    addStage(ctx, "Tailoring/PDF", "SKIP", "Not requested", "--skip-tailor");
    return;
  }

  const tailor = await requestArtifact(ctx, "tailor_top_job", options.baseUrl, "/api/dashboard/tailor-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: ctx.topJobId,
      ...(ctx.demoUserId ? { demoUserId: ctx.demoUserId } : {}),
    }),
  });

  const application = tailor.json?.application ?? null;
  const tailoredResume = application?.tailoredResume ?? null;
  const expectedName = stringOrNull(process.env.E2E_EXPECTED_CANDIDATE_NAME ?? "Recruit E2E Test Candidate");
  const expectedEmail = stringOrNull(tailoredResume?.email ?? process.env.E2E_AUTH_EMAIL);
  if (tailor.status === 200 && tailor.json?.ok === true) {
    ctx.metrics.tailoredCompletedCount = 1;
  }

  const pdf = await requestPdfArtifact(
    ctx,
    "tailored_resume",
    options.baseUrl,
    scopedPath(ctx, `/api/dashboard/resume-pdf?jobId=${encodeURIComponent(ctx.topJobId)}&inline=1`)
  );
  ctx.metrics.pdfByteLength = pdf.bytes.byteLength;
  const pdfHasHeader = startsWithPdfHeader(pdf.bytes);
  const pdfIsNonzero = pdf.bytes.byteLength > 0;
  const pdfText = await extractPdfTextForEvidence(Uint8Array.from(pdf.bytes)).catch((error) => {
    addBug(
      ctx,
      "P1",
      "Tailoring/PDF",
      "PDF text extraction returns readable resume content.",
      safeMessage(error),
      "results/tailored_resume.pdf",
      "Check local PDF text extraction dependencies and generated PDF structure."
    );
    return "";
  });
  await saveArtifact(ctx, "tailored_resume_text", `${pdfText}\n`, "txt");

  const pdfChecks = {
    header: pdfHasHeader,
    nonzero: pdfIsNonzero,
    name: expectedName ? containsText(pdfText, expectedName) : true,
    email: expectedEmail ? containsText(pdfText, expectedEmail) : true,
    keyword: roleKeywordPresent(pdfText, application),
  };

  if (tailor.status === 200 && tailor.json?.ok === true && Object.values(pdfChecks).every(Boolean)) {
    addStage(ctx, "Tailoring/PDF", "PASS", "results/tailor_top_job.json, results/tailored_resume.pdf, results/tailored_resume_text.txt", `pdfBytes=${pdf.bytes.byteLength}`);
  } else {
    addStage(ctx, "Tailoring/PDF", "FAIL", "results/tailor_top_job.json, results/tailored_resume.pdf, results/tailored_resume_text.txt", `PDF checks: ${JSON.stringify(pdfChecks)}`);
    addBug(ctx, "P0", "Tailoring/PDF", "Tailoring succeeds and PDF contains candidate identity plus role keywords.", `tailorStatus=${tailor.status}, checks=${JSON.stringify(pdfChecks)}`, "results/tailor_top_job.json", "Check fallback/header rendering and PDF generation runtime.");
  }
}

async function pollDashboardLive(
  options: CliOptions,
  ctx: RunContext,
  runId: string
): Promise<Awaited<ReturnType<typeof requestArtifact>>> {
  const started = Date.now();
  let attempt = 0;
  let last = await requestArtifact(
    ctx,
    "dashboard_live",
    options.baseUrl,
    scopedPath(ctx, `/api/dashboard/live?runId=${encodeURIComponent(runId)}`)
  );

  while (Date.now() - started < options.pollTimeoutMs) {
    const run = last.json?.run;
    const recommendations = Array.isArray(last.json?.recommendations) ? last.json.recommendations : [];
    if (
      run?._id === runId &&
      (recommendations.length > 0 || run.status === "completed" || run.status === "failed")
    ) {
      return last;
    }

    await sleep(POLL_INTERVAL_MS);
    attempt++;
    last = await requestArtifact(
      ctx,
      attempt % 6 === 0 ? `dashboard_live_poll_${attempt}` : "dashboard_live",
      options.baseUrl,
      scopedPath(ctx, `/api/dashboard/live?runId=${encodeURIComponent(runId)}`)
    );
  }

  return last;
}

async function runAtsStaging(ctx: RunContext) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const targetUrl = process.env.E2E_ASHBY_STAGING_URL;
  if (!ctx.topJobId) {
    addStage(ctx, "ATS staging", "SKIP", "No top recommendation", "Cannot run ATS staging without jobId.");
    return;
  }
  if (!convexUrl || !targetUrl) {
    addStage(ctx, "ATS staging", "SKIP", "Missing config", "Set NEXT_PUBLIC_CONVEX_URL and E2E_ASHBY_STAGING_URL.");
    return;
  }

  try {
    const client = new ConvexHttpClient(convexUrl.replace(/\/+$/, ""));
    const result = await client.action(convexRefs.ashbyActions.runAshbyFormFill, {
      targetUrl,
      ...(ctx.demoUserId ? { demoUserId: ctx.demoUserId } : {}),
      jobId: ctx.topJobId as never,
      submitPolicy: "dry_run",
      submit: false,
      openAiBestEffort: false,
    });
    await saveArtifact(ctx, "ats_staging", redactSecrets(result), "json");
    const evidence = (result as any)?.evidence ?? {};
    ctx.realApplicationSubmitted = Boolean((result as any)?.submitCompleted);
    ctx.sensitiveFieldsGuessed = detectsSensitiveGuess(evidence);
    const safe =
      (result as any)?.submitAttempted === false &&
      (result as any)?.submitCompleted === false &&
      evidence?.submitPolicy === "dry_run" &&
      !ctx.sensitiveFieldsGuessed;
    addStage(
      ctx,
      "ATS staging",
      safe ? "PASS" : "FAIL",
      "results/ats_staging.json",
      safe ? "Dry-run staged and blocked before submit." : "ATS staging did not preserve dry-run safety invariants."
    );
    if (!safe) {
      addBug(ctx, "P0", "ATS staging", "Dry-run form fill stages fields and never submits.", JSON.stringify(redactSecrets(result)), "results/ats_staging.json", "Inspect submitPolicy gating, field safety classification, and final evidence.");
    }
  } catch (error) {
    await saveArtifact(ctx, "ats_staging_error", { error: safeMessage(error) }, "json");
    addStage(ctx, "ATS staging", "FAIL", "results/ats_staging_error.json", safeMessage(error));
    addBug(ctx, "P1", "ATS staging", "Dry-run ATS staging completes or fails with classified evidence.", safeMessage(error), "results/ats_staging_error.json", "Check browser runtime and target test posting.");
  }
}

async function runDlqAndFollowupChecks(options: CliOptions, ctx: RunContext) {
  const beforeDlq = await requestArtifact(ctx, "dlq_before", options.baseUrl, "/api/dlq");
  if (beforeDlq.status === 200) {
    const items = Array.isArray(beforeDlq.json?.items) ? beforeDlq.json.items : [];
    ctx.metrics.dlqCreatedCount = Number(beforeDlq.json?.openCount ?? items.length ?? 0);
    ctx.dlqAuditable = items.some((item: any) => item?.question && item?.context);
  }

  if (options.withFixtures) {
    await requestArtifact(ctx, "dlq_reset_fixture", options.baseUrl, "/api/dlq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-test-fixture", itemId: "dlq_2" }),
    });
    await requestArtifact(ctx, "dlq_approve_fixture", options.baseUrl, "/api/dlq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve-cache", itemId: "dlq_2", answer: "4 weeks from offer." }),
    });
  }

  const afterDlq = await requestArtifact(ctx, "dlq_after", options.baseUrl, "/api/dlq");
  const dlqItems = Array.isArray(afterDlq.json?.items) ? afterDlq.json.items : [];
  const fixtureCached = dlqItems.some((item: any) => item?.id === "dlq_2" && item?.status === "cached");
  if (afterDlq.status === 200 && (options.withFixtures ? fixtureCached : dlqItems.length > 0)) {
    addStage(ctx, "DLQ/cache", options.withFixtures ? "PASS" : "PARTIAL", "results/dlq_before.json, results/dlq_after.json", options.withFixtures ? "Fixture answer cached." : "DLQ readable; fixture mutation not requested.");
  } else {
    addStage(ctx, "DLQ/cache", "FAIL", "results/dlq_after.json", "DLQ read or fixture verification failed.");
    addBug(ctx, "P2", "DLQ/cache", "DLQ exposes human-required answer state and fixture cache path.", JSON.stringify(afterDlq.json), "results/dlq_after.json", "Check Convex DLQ persistence and RECRUIT_E2E_FIXTURES gate.");
  }

  if (options.withFixtures) {
    await requestArtifact(ctx, "followups_mark_test_applied", options.baseUrl, "/api/dashboard/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-test-applied" }),
    });
  }

  const followups = await requestArtifact(ctx, "followups", options.baseUrl, "/api/dashboard/followups");
  const counts = followups.json?.summary?.counts ?? {};
  ctx.metrics.followupCount = Number(counts.applications ?? 0);
  if (followups.status === 200 && (options.withFixtures ? Number(counts.applications ?? 0) > 0 : true)) {
    addStage(ctx, "Follow-ups", options.withFixtures ? "PASS" : "PARTIAL", "results/followups.json", options.withFixtures ? `applications=${counts.applications ?? 0}` : "Follow-up surface readable; fixture mutation not requested.");
  } else {
    addStage(ctx, "Follow-ups", "FAIL", "results/followups.json", "Follow-up read or fixture verification failed.");
    addBug(ctx, "P2", "Follow-ups", "Test applied fixture appears in follow-up summary.", JSON.stringify(followups.json), "results/followups.json", "Check follow-up fixture route and Convex mutations.");
  }
}

async function runAuthenticatedUiSmoke(options: CliOptions, ctx: RunContext) {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;
  if (!email || !password) {
    addStage(ctx, "Auth/dashboard", "SKIP", "Missing credentials", "Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD.");
    return;
  }

  const screenshots: string[] = [];
  const consoleErrors: string[] = [];
  let browser: Awaited<ReturnType<typeof getPuppeteerBrowser>> | null = null;
  try {
    browser = await getPuppeteerBrowser();
    const page = await browser.newPage();
    const protectionHeaders = vercelProtectionHeaders();
    if (Object.keys(protectionHeaders).length > 0) {
      await page.setExtraHTTPHeaders(protectionHeaders);
    }
    page.on("console", (message: any) => {
      if (message.type?.() === "error") consoleErrors.push(message.text());
    });
    await page.goto(urlFor(options.baseUrl, "/sign-in?redirect_url=/dashboard"), {
      waitUntil: "networkidle2",
      timeout: 45_000,
    });
    await page.type('input[type="email"]', email, { delay: 5 });
    await page.type('input[type="password"]', password, { delay: 5 });
    await Promise.allSettled([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20_000 }),
      page.click('button[type="submit"]'),
    ]);
    await page.goto(urlFor(options.baseUrl, "/dashboard"), { waitUntil: "networkidle2", timeout: 45_000 });
    const cookies = await page.cookies(options.baseUrl);
    ctx.authCookieHeader = cookies
      .filter((cookie: { name?: string; value?: string }) => cookie.name && cookie.value)
      .map((cookie: { name: string; value: string }) => `${cookie.name}=${cookie.value}`)
      .join("; ") || null;

    for (const targetPath of ["/dashboard", "/dlq", "/settings"]) {
      await page.goto(urlFor(options.baseUrl, targetPath), { waitUntil: "networkidle2", timeout: 45_000 });
      const bytes = await page.screenshot({ fullPage: true });
      const artifact = await saveBinaryArtifact(ctx, `ui_${safeName(targetPath)}`, new Uint8Array(bytes as any), "png");
      screenshots.push(artifact);
    }

    await saveArtifact(ctx, "ui_console_errors", { consoleErrors }, "json");
    addStage(ctx, "Auth/dashboard", consoleErrors.length === 0 ? "PASS" : "PARTIAL", screenshots.join(", "), consoleErrors.length === 0 ? "Authenticated UI pages loaded." : `${consoleErrors.length} console errors captured.`);
  } catch (error) {
    await saveArtifact(ctx, "ui_smoke_error", { error: safeMessage(error) }, "json");
    addStage(ctx, "Auth/dashboard", "FAIL", "results/ui_smoke_error.json", safeMessage(error));
    addBug(ctx, "P2", "Auth/dashboard", "Authenticated dashboard, DLQ, settings, and follow-up surfaces load without console errors.", safeMessage(error), "results/ui_smoke_error.json", "Check test credentials, auth service config, and browser runtime.");
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function requestArtifact(
  ctx: RunContext,
  label: string,
  baseUrl: string,
  routePath: string,
  init: RequestInit = {}
) {
  try {
    const response = await fetch(urlFor(baseUrl, routePath), {
      ...init,
      headers: requestHeaders(ctx, init.headers),
    });
    const text = await response.text();
    const json = tryJson(text);
    await saveArtifact(ctx, label, {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      body: json ?? text,
    }, "json");
    return { status: response.status, ok: response.ok, text, json };
  } catch (error) {
    const json = { error: "fetch_failed", message: safeMessage(error) };
    await saveArtifact(ctx, label, {
      status: 0,
      ok: false,
      contentType: null,
      body: json,
    }, "json");
    return { status: 0, ok: false, text: "", json };
  }
}

async function requestPdfArtifact(
  ctx: RunContext,
  label: string,
  baseUrl: string,
  routePath: string
) {
  try {
    const response = await fetch(urlFor(baseUrl, routePath), {
      headers: requestHeaders(ctx),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    await saveBinaryArtifact(ctx, label, bytes, "pdf");
    if (!response.ok) {
      await saveArtifact(ctx, `${label}_error`, {
        status: response.status,
        contentType: response.headers.get("content-type"),
        body: Buffer.from(bytes).toString("utf8"),
      }, "json");
    }
    return { status: response.status, ok: response.ok, bytes };
  } catch (error) {
    await saveArtifact(ctx, `${label}_error`, {
      status: 0,
      error: "fetch_failed",
      message: safeMessage(error),
    }, "json");
    return { status: 0, ok: false, bytes: new Uint8Array() };
  }
}

async function saveArtifact(
  ctx: RunContext,
  label: string,
  value: unknown,
  extension: "json" | "txt"
) {
  const name = `${safeName(label)}.${extension}`;
  const filePath = path.join(ctx.resultsDir, name);
  const content = extension === "json"
    ? `${JSON.stringify(redactSecrets(value), null, 2)}\n`
    : String(value);
  await writeFile(filePath, content, "utf8");
  const ref = path.relative(ctx.runDir, filePath);
  ctx.artifacts.push(ref);
  return ref;
}

async function saveBinaryArtifact(
  ctx: RunContext,
  label: string,
  bytes: Uint8Array,
  extension: string
) {
  const name = `${safeName(label)}.${extension}`;
  const filePath = path.join(ctx.resultsDir, name);
  await writeFile(filePath, bytes);
  const ref = path.relative(ctx.runDir, filePath);
  ctx.artifacts.push(ref);
  return ref;
}

async function writeReport(options: CliOptions, ctx: RunContext, startedAt: Date) {
  const overall = overallResult(ctx);
  const blockers = ctx.bugs.length > 0
    ? ctx.bugs.map((bug) => `${bug.stage}: ${bug.actual}`).slice(0, 5).join("; ")
    : ctx.stages.some((stage) => stage.result === "SKIP")
      ? "Some optional E2E coverage was skipped by configuration."
      : "None";
  const lines = [
    "## Executive Summary",
    `- Overall result: ${overall}`,
    `- Environment: ${options.baseUrl}`,
    `- Test account: ${process.env.E2E_AUTH_EMAIL ? "E2E_AUTH_EMAIL configured" : "not configured"}`,
    `- Run ID: ${ctx.runId ?? "unavailable"}`,
    `- Top job tested: ${ctx.topJobLabel ?? "unavailable"}`,
    `- Main blockers: ${blockers}`,
    "",
    "## Stage Results",
    "| Stage | Result | Evidence | Notes |",
    "| --- | --- | --- | --- |",
    ...orderedStages(ctx).map((stage) =>
      `| ${stage.stage} | ${stage.result} | ${escapePipe(stage.evidence)} | ${escapePipe(stage.notes)} |`
    ),
    "",
    "## Metrics",
    ...Object.entries(ctx.metrics).map(([key, value]) => `- ${key}: ${value ?? ""}`),
    "",
    "## Evidence",
    "- Screenshots: " + ctx.artifacts.filter((item) => item.endsWith(".png")).join(", "),
    "- Logs: results/dashboard_live.json",
    "- API responses: " + ctx.artifacts.filter((item) => item.endsWith(".json")).join(", "),
    "- Convex records/counts: results/dashboard_live.json, results/top_job_detail.json",
    "",
    "## Bugs / Risks",
    ...formatBugs(ctx),
    "",
    "## Safety Review",
    `- Was any real application submitted? ${ctx.realApplicationSubmitted ? "Yes" : "No"}`,
    `- Were sensitive fields guessed? ${ctx.sensitiveFieldsGuessed ? "Yes" : "No"}`,
    "- Were secrets exposed in logs or screenshots? No",
    `- Were DLQ decisions auditable? ${ctx.dlqAuditable === null ? "Unknown" : ctx.dlqAuditable ? "Yes" : "No"}`,
    "",
    `Generated: ${startedAt.toISOString()}`,
  ];
  const reportPath = path.join(ctx.runDir, "REPORT.md");
  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
  return reportPath;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? DEFAULT_BASE_URL,
    envFile: parseEnvFileArg(args),
    contractsOnly: false,
    skipIngestion: false,
    skipTailor: false,
    withFixtures: false,
    withAuthUi: false,
    withAtsStaging: false,
    dashboardIngestionFallback: false,
    limitSources: Number(process.env.E2E_LIMIT_SOURCES ?? 3),
    tailorLimit: Number(process.env.E2E_TAILOR_LIMIT ?? 3),
    pollTimeoutMs: Number(process.env.E2E_POLL_TIMEOUT_MS ?? DEFAULT_POLL_TIMEOUT_MS),
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--contracts-only") options.contractsOnly = true;
    else if (arg === "--skip-ingestion") options.skipIngestion = true;
    else if (arg === "--skip-tailor") options.skipTailor = true;
    else if (arg === "--with-fixtures") options.withFixtures = true;
    else if (arg === "--with-auth-ui") options.withAuthUi = true;
    else if (arg === "--with-ats-staging") options.withAtsStaging = true;
    else if (arg === "--dashboard-ingestion-fallback") options.dashboardIngestionFallback = true;
    else if (arg.startsWith("--base-url=")) options.baseUrl = arg.slice("--base-url=".length);
    else if (arg.startsWith("--env-file=")) options.envFile = arg.slice("--env-file=".length);
    else if (arg.startsWith("--label=")) options.label = safeName(arg.slice("--label=".length));
    else if (arg.startsWith("--limit-sources=")) options.limitSources = positiveInteger(arg.slice("--limit-sources=".length), "limit-sources");
    else if (arg.startsWith("--tailor-limit=")) options.tailorLimit = positiveInteger(arg.slice("--tailor-limit=".length), "tailor-limit");
    else if (arg.startsWith("--poll-timeout-ms=")) options.pollTimeoutMs = positiveInteger(arg.slice("--poll-timeout-ms=".length), "poll-timeout-ms");
    else throw new Error(`Unknown option: ${arg}`);
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, "");
  if (!Number.isInteger(options.limitSources) || options.limitSources < 1 || options.limitSources > 10) {
    throw new Error("--limit-sources must be an integer between 1 and 10");
  }
  if (!Number.isInteger(options.tailorLimit) || options.tailorLimit < 1 || options.tailorLimit > 10) {
    throw new Error("--tailor-limit must be an integer between 1 and 10");
  }
  if (!Number.isInteger(options.pollTimeoutMs) || options.pollTimeoutMs < 30_000) {
    throw new Error("--poll-timeout-ms must be at least 30000");
  }
  return options;
}

function printHelp() {
  console.log(`Usage: npm run e2e:prod-smoke -- [options]

Options:
  --base-url=<url>       Target deployment. Defaults to E2E_BASE_URL or ${DEFAULT_BASE_URL}
  --env-file=<path>      Load E2E env before running. Defaults to ${DEFAULT_ENV_FILE}
  --contracts-only       Run only non-mutating API contract checks
  --skip-ingestion       Skip bounded Ashby ingestion/ranking
  --skip-tailor          Skip tailoring and PDF checks
  --dashboard-ingestion-fallback
                         Use /api/dashboard/run-ingestion instead of onboarding launch
  --with-auth-ui         Sign in with E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD and capture UI screenshots
  --with-fixtures        Exercise DLQ/follow-up fixture mutations; requires RECRUIT_E2E_FIXTURES=1 in the target
  --with-ats-staging     Run Ashby form automation in dry-run mode using E2E_ASHBY_STAGING_URL
  --limit-sources=<n>    Bounded Ashby source count, default 3
  --tailor-limit=<n>     Onboarding tailor limit, default 3
  --poll-timeout-ms=<n>  Dashboard polling timeout for launched runs, default ${DEFAULT_POLL_TIMEOUT_MS}
`);
}

function parseEnvFileArg(args: string[]) {
  const item = args.find((arg) => arg.startsWith("--env-file="));
  return item ? item.slice("--env-file=".length) : DEFAULT_ENV_FILE;
}

async function loadEnvFile(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  let text = "";
  try {
    text = await readFile(absolutePath, "utf8");
  } catch {
    return { loaded: false, path: absolutePath, count: 0 };
  }

  let count = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = parseEnvValue(rawValue);
    count++;
  }
  return { loaded: true, path: absolutePath, count };
}

function parseEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  return trimmed.replace(/\s+#.*$/, "");
}

function preflightFullRun(options: CliOptions, ctx: RunContext) {
  const missing = ["NEXT_PUBLIC_CONVEX_URL"].filter((key) => !process.env[key]);
  if (options.withAuthUi) {
    for (const key of ["E2E_AUTH_EMAIL", "E2E_AUTH_PASSWORD"]) {
      if (!process.env[key]) missing.push(key);
    }
  }
  if (options.withAtsStaging && !process.env.E2E_ASHBY_STAGING_URL) {
    missing.push("E2E_ASHBY_STAGING_URL");
  }

  const isProductionTarget = options.baseUrl === DEFAULT_BASE_URL ||
    /(^|\.)recruit-main\.vercel\.app$/i.test(new URL(options.baseUrl).hostname);
  const blockers: string[] = [];
  if (missing.length > 0) {
    blockers.push(`missing env: ${[...new Set(missing)].join(", ")}`);
  }
  if (isProductionTarget && options.withFixtures) {
    blockers.push("fixtures are blocked for the production target");
  }
  if (isProductionTarget && process.env.RECRUIT_E2E_FIXTURES === "1") {
    blockers.push("local RECRUIT_E2E_FIXTURES=1 is unsafe for production target");
  }
  if (process.env.RECRUIT_ASHBY_SUBMIT_GATE === "1") {
    blockers.push("RECRUIT_ASHBY_SUBMIT_GATE must be unset for this dry-run smoke");
  }

  if (blockers.length === 0) return true;

  addStage(ctx, "Auth/dashboard", "FAIL", "preflight", blockers.join("; "));
  addBug(
    ctx,
    "P0",
    "Preflight",
    "Required E2E config is present and no submit/fixture production safety gates are enabled.",
    blockers.join("; "),
    "preflight",
    "Pull the Vercel env file, provide E2E-only vars, and run fixture coverage only on preview/staging."
  );
  return false;
}

function addStage(ctx: RunContext, stage: string, result: StageStatus, evidence: string, notes: string) {
  const existing = ctx.stages.find((item) => item.stage === stage);
  const next = { stage, result, evidence, notes };
  if (existing) Object.assign(existing, next);
  else ctx.stages.push(next);
}

function addBug(
  ctx: RunContext,
  severity: string,
  stage: string,
  expected: string,
  actual: string,
  evidence: string,
  suggestedFix: string
) {
  ctx.bugs.push({ severity, stage, expected, actual, evidence, suggestedFix });
}

function orderedStages(ctx: RunContext) {
  const order = [
    "Auth/dashboard",
    "Onboarding/profile",
    "Ingestion",
    "Filtering/ranking",
    "Research",
    "Tailoring/PDF",
    "ATS staging",
    "DLQ/cache",
    "Follow-ups",
    "API contracts",
  ];
  return order.map((stage) =>
    ctx.stages.find((item) => item.stage === stage) ?? {
      stage,
      result: "SKIP" as const,
      evidence: "",
      notes: "Not reached",
    }
  );
}

function overallResult(ctx: RunContext) {
  if (ctx.stages.some((stage) => stage.result === "FAIL")) return "FAIL";
  if (ctx.stages.some((stage) => stage.result === "PARTIAL" || stage.result === "SKIP")) return "PARTIAL";
  return "PASS";
}

function formatBugs(ctx: RunContext) {
  if (ctx.bugs.length === 0) return ["- None recorded."];
  return ctx.bugs.flatMap((bug) => [
    `- Severity: ${bug.severity}`,
    `  Stage: ${bug.stage}`,
    "  Repro steps: Run this smoke script with the same options and inspect the linked artifact.",
    `  Expected: ${bug.expected}`,
    `  Actual: ${bug.actual}`,
    `  Evidence: ${bug.evidence}`,
    "  Suspected cause: See route/action behavior for this stage.",
    `  Suggested fix: ${bug.suggestedFix}`,
  ]);
}

function urlFor(baseUrl: string, routePath: string) {
  return `${baseUrl}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

function scopedPath(ctx: RunContext, routePath: string) {
  if (!ctx.demoUserId) return routePath;
  const url = new URL(routePath, "http://recruit.local");
  if (!url.searchParams.has("demoUserId")) {
    url.searchParams.set("demoUserId", ctx.demoUserId);
  }
  return `${url.pathname}${url.search}`;
}

function valueAt(value: unknown, key: string) {
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function tryJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function requestHeaders(ctx: RunContext, headers?: RequestInit["headers"]) {
  const next = new Headers(headers);
  for (const [key, value] of Object.entries(vercelProtectionHeaders())) {
    if (!next.has(key)) next.set(key, value);
  }
  if (ctx.authCookieHeader && !next.has("cookie")) {
    next.set("cookie", ctx.authCookieHeader);
  }
  return next;
}

function vercelProtectionHeaders(): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ??
    process.env.VERCEL_PROTECTION_BYPASS_SECRET;
  if (!secret) return {};
  return {
    "x-vercel-protection-bypass": secret,
  };
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      /password|secret|token|cookie|authorization|api[_-]?key/i.test(key)
        ? "[REDACTED]"
        : redactSecrets(entry),
    ])
  );
}

function researchArtifact(artifacts: unknown) {
  if (!Array.isArray(artifacts)) return null;
  return artifacts.find((artifact: any) => artifact?.kind === "research_snapshot")?.payload ?? null;
}

function assignMetric(ctx: RunContext, key: string, value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) ctx.metrics[key] = value;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function startsWithPdfHeader(bytes: Uint8Array) {
  return Buffer.from(bytes.slice(0, 4)).toString("ascii") === "%PDF";
}

function containsText(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function roleKeywordPresent(pdfText: string, application: any) {
  const candidates = [
    ...(Array.isArray(application?.tailoredResume?.skills) ? application.tailoredResume.skills : []),
    application?.job?.role,
    application?.job?.company,
  ].filter((item): item is string => typeof item === "string" && item.trim().length >= 3);
  return candidates.some((candidate) => containsText(pdfText, candidate));
}

function detectsSensitiveGuess(evidence: any) {
  const sensitiveKeys = new Set([
    "work_authorized_us",
    "visa_sponsorship_required",
    "salary_expectations",
    "earliest_start_date",
    "notice_period",
    "demographic",
    "veteran",
    "disability",
  ]);
  const filled = Array.isArray(evidence?.filledSafeFields) ? evidence.filledSafeFields : [];
  return filled.some((field: any) => sensitiveKeys.has(String(field?.key)));
}

function buildE2ETestProfile() {
  const email = process.env.E2E_AUTH_EMAIL ?? "recruit-e2e@example.com";
  return {
    name: "Recruit E2E Test Candidate",
    email,
    location: "San Francisco, CA / Remote",
    headline: "Software Engineer",
    summary:
      "Software engineer focused on TypeScript, React, Next.js, Node.js, API design, cloud infrastructure, and applied AI tooling.",
    links: {
      github: "https://github.com/recruit-e2e-test",
      linkedin: "https://linkedin.com/in/recruit-e2e-test",
      website: "https://example.com/recruit-e2e-test",
    },
    experience: [
      {
        company: "Nimbus Labs",
        title: "Software Engineer",
        location: "San Francisco, CA",
        startDate: "2023",
        endDate: "Present",
        description:
          "Built React and Node.js applications, cloud infrastructure, applied AI automation, and internal data pipelines.",
      },
      {
        company: "Atlas Systems",
        title: "Frontend Engineer",
        location: "Remote",
        startDate: "2021",
        endDate: "2023",
        description:
          "Built TypeScript interfaces, API integrations, performance improvements, and design system components.",
      },
    ],
    education: [
      {
        school: "State University",
        degree: "BS",
        field: "Computer Science",
        endDate: "2021",
      },
    ],
    skills: [
      "TypeScript",
      "React",
      "Next.js",
      "Node.js",
      "PostgreSQL",
      "AWS",
      "Docker",
      "API design",
      "AI tooling",
    ],
    prefs: {
      roles: ["Software Engineer", "Product Engineer"],
      locations: ["Remote", "San Francisco"],
    },
    suggestions: [],
    provenance: {},
    log: [
      {
        at: TEST_PROFILE_UPDATED_AT,
        source: "e2e",
        label: "Recruit production E2E test profile",
      },
    ],
    updatedAt: TEST_PROFILE_UPDATED_AT,
  };
}

function positiveInteger(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function safeName(value: string) {
  return value
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "artifact";
}

function stamp(date: Date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function escapePipe(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exit(1);
});
