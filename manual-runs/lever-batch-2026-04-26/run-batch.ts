import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { ConvexHttpClient } from "convex/browser";
import {
  getBrowserbaseLiveViewUrls,
  getLastBrowserbaseSessionInfo,
  getPuppeteerBrowser,
  isBrowserbaseCaptchaSolvingEnabled,
  isBrowserbaseConfigured,
} from "../../lib/pdf";
import { runLeverFormFillOnPage } from "../../lib/lever-fill/browser";
import { validateDirectLeverApplicationUrl } from "../../lib/lever-fill/core";
import { convexRefs } from "../../lib/convex-refs";

type BatchInput = {
  provider: "lever";
  urls: string[];
  split?: {
    train?: { startIndex: number; endIndex: number };
    test?: { startIndex: number; endIndex: number };
  };
};

type ConvexRuntimeProfileContext = {
  demoUserId: string;
  profile: unknown;
  profileSource: "convex" | "missing";
  profileIdentity?: unknown;
};

const root = process.cwd();
loadEnvConfig(root);

const runDir = `${root}/manual-runs/lever-batch-2026-04-26`;
const inputPath = `${runDir}/urls.json`;
const outputDir = `${runDir}/results`;
const input = JSON.parse(readFileSync(inputPath, "utf8")) as BatchInput;

const startIndex = Number(process.argv[2] ?? "1");
const endIndex = Number(process.argv[3] ?? String(input.urls.length));
const label = process.argv[4] ?? `${startIndex}-${endIndex}`;
const openAiBestEffort = process.argv.includes("--openai");
const submit = process.argv.includes("--submit");
const allowLiveSubmit = process.argv.includes("--allow-live-submit") || process.env.LEVER_ALLOW_LIVE_SUBMIT === "1";
const allowSyntheticLiveProfile =
  process.argv.includes("--allow-synthetic-live-profile") || process.env.LEVER_ALLOW_SYNTHETIC_LIVE_PROFILE === "1";
const browserbaseLiveView = process.argv.includes("--browserbase-live-view");
const profileFlagIndex = process.argv.indexOf("--profile");
const profilePath = profileFlagIndex >= 0 ? process.argv[profileFlagIndex + 1] : null;
const convexProfileFlagIndex = process.argv.indexOf("--convex-profile");
const convexProfileValue = convexProfileFlagIndex >= 0 ? process.argv[convexProfileFlagIndex + 1] : null;
const convexDemoUserId = convexProfileValue && !convexProfileValue.startsWith("--") ? convexProfileValue : undefined;

if (submit && !allowLiveSubmit) {
  throw new Error("lever_live_submit_requires_--allow-live-submit_or_LEVER_ALLOW_LIVE_SUBMIT=1");
}
if (submit && !isBrowserbaseCaptchaSolvingEnabled()) {
  throw new Error("lever_live_submit_requires_browserbase_captcha_solving");
}
if (submit && !profilePath && convexProfileFlagIndex < 0 && !allowSyntheticLiveProfile) {
  throw new Error("lever_live_submit_requires_explicit_--profile_or_--convex-profile");
}
if (submit && startIndex !== endIndex && !process.argv.includes("--allow-multiple-live-submits")) {
  throw new Error("multiple_live_submits_require_--allow-multiple-live-submits");
}
if (profilePath && convexProfileFlagIndex >= 0) {
  throw new Error("use either --profile or --convex-profile, not both");
}

const defaultProfilePath = `${runDir}/test-profile.json`;
const fileProfile = JSON.parse(readFileSync(resolveProfilePath(profilePath ?? defaultProfilePath), "utf8"));

mkdirSync(outputDir, { recursive: true });

function compact(result: Awaited<ReturnType<typeof runLeverFormFillOnPage>>, index: number) {
  return {
    index,
    targetUrl: result.targetUrl,
    finalUrl: result.finalUrl,
    companySlug: result.companySlug,
    postingId: result.postingId,
    outcome: result.outcome,
    submitAttempted: result.submitAttempted,
    submitCompleted: result.submitCompleted,
    hcaptchaPresent: result.finalSnapshot.hcaptcha_present,
    captchaPrimary: result.finalSnapshot.captcha.primary,
    captchaSupported: result.finalSnapshot.captcha.supportedByBrowserbase,
    captchaUnsupportedReason: result.finalSnapshot.captcha.unsupportedReason,
    discoveredQuestions: result.finalSnapshot.questions.length,
    requiredQuestions: result.finalSnapshot.questions.filter((question) => question.required).length,
    fillOperationCount: result.fillOperations.length,
    filledCount: result.fillOperations.filter((operation) => operation.status === "filled").length,
    blockerCount: result.blockers.length,
    blockers: result.blockers.map((blocker) => ({
      kind: blocker.kind,
      key: blocker.key,
      label: blocker.label,
      detail: blocker.detail,
    })),
    needsUserAnswers: result.needsUserAnswers,
    missingRequired: result.plan.missing_required.map((blocker) => ({
      key: blocker.key,
      label: blocker.label,
      detail: blocker.detail,
    })),
    pendingReview: result.plan.pending_review.map((item) => ({
      promptHash: item.prompt_hash,
      canonicalKeyCandidate: item.canonical_key_candidate,
      questionText: item.question_text,
      reason: item.reason,
    })),
    llmBestAttemptAnswers: result.plan.resolved_answers
      .filter((answer) => answer.source === "llm_best_attempt")
      .map((answer) => ({
        key: answer.canonical_key,
        label: answer.field_label,
        reviewStatus: answer.review_status,
        sourceDetail: answer.source_detail,
      })),
    filledKeys: result.fillOperations
      .filter((operation) => operation.status === "filled")
      .map((operation) => operation.key),
    runGrade: result.runGrade,
    errors: result.errors,
    notes: result.notes,
  };
}

async function main() {
  const convexClient = convexProfileFlagIndex >= 0 ? buildConvexClient() : null;
  const isolateBrowserPerTarget = isBrowserbaseConfigured();
  const sharedBrowser = isolateBrowserPerTarget ? null : await getPuppeteerBrowser();
  const summary = [];

  try {
    for (let index = startIndex; index <= Math.min(endIndex, input.urls.length); index += 1) {
      const url = input.urls[index - 1];
      if (!url) continue;
      let browser: Awaited<ReturnType<typeof getPuppeteerBrowser>> | null = null;
      let page: Awaited<ReturnType<Awaited<ReturnType<typeof getPuppeteerBrowser>>["newPage"]>> | null = null;
      try {
        browser = sharedBrowser ?? await getPuppeteerBrowser();
        page = await browser.newPage();
        const browserbaseSessionInfo = getLastBrowserbaseSessionInfo();
        const browserbaseLiveUrls = browserbaseLiveView ? await getBrowserbaseLiveViewUrls() : null;
        if (browserbaseSessionInfo || browserbaseLiveUrls) {
          console.error(JSON.stringify({
            index,
            browserbaseSessionId: browserbaseSessionInfo?.id ?? null,
            browserbaseLiveViewUrl: browserbaseLiveUrls?.debuggerFullscreenUrl ?? null,
          }));
        }
        const context = convexClient
          ? await loadConvexContext(convexClient, url)
          : {
              demoUserId: "local",
              profile: fileProfile,
              profileSource: "file",
              profileIdentity: null,
            };
        if (!context.profile) {
          throw new Error(`convex_profile_missing:${context.demoUserId}`);
        }
        const result = await runLeverFormFillOnPage(page as never, {
          targetUrl: url,
          profile: context.profile,
          aliases: [],
          approvedAnswers: [],
          openAiBestEffort,
          openAiApiKey: openAiBestEffort ? process.env.OPENAI_API_KEY : null,
          openAiModel: process.env.OPENAI_LEVER_FILL_MODEL ?? process.env.OPENAI_ASHBY_FILL_MODEL ?? "gpt-4o-mini",
          draftAnswerMode: openAiBestEffort ? "fill" : "review_only",
          browserbaseCaptchaSolving: isBrowserbaseCaptchaSolvingEnabled(),
          submit,
        });
        const compactResult = {
          ...compact(result, index),
          profileSource: context.profileSource,
          profileIdentity: context.profileIdentity,
          browserbaseSessionId: browserbaseSessionInfo?.id ?? null,
          browserbaseLiveViewUrl: browserbaseLiveUrls?.debuggerFullscreenUrl ?? null,
        };
        summary.push(compactResult);
        writeFileSync(join(outputDir, `result-${String(index).padStart(2, "0")}.json`), JSON.stringify(result, null, 2));
        writeFileSync(join(outputDir, `${label}-summary.json`), JSON.stringify(summary, null, 2));
        console.log(JSON.stringify({
          index,
          finalUrl: compactResult.finalUrl,
          outcome: compactResult.outcome,
          submitAttempted: compactResult.submitAttempted,
          hcaptchaPresent: compactResult.hcaptchaPresent,
          captchaPrimary: compactResult.captchaPrimary,
          captchaSupported: compactResult.captchaSupported,
          discoveredQuestions: compactResult.discoveredQuestions,
          filledCount: compactResult.filledCount,
          blockerCount: compactResult.blockerCount,
          needsUserAnswerCount: compactResult.needsUserAnswers.length,
          submitReady: compactResult.runGrade.submit_ready,
        }));
      } catch (error) {
        const failed = {
          index,
          targetUrl: url,
          error: error instanceof Error ? error.message : String(error),
        };
        summary.push(failed);
        writeFileSync(join(outputDir, `result-${String(index).padStart(2, "0")}-error.json`), JSON.stringify(failed, null, 2));
        writeFileSync(join(outputDir, `${label}-summary.json`), JSON.stringify(summary, null, 2));
        console.error(JSON.stringify(failed));
      } finally {
        await closeWithTimeout(page);
        if (isolateBrowserPerTarget) {
          await closeWithTimeout(browser);
        }
      }
    }
  } finally {
    await closeWithTimeout(sharedBrowser);
  }
}

function resolveProfilePath(value: string): string {
  if (value.startsWith("/")) return value;
  const candidate = `${root}/${value}`;
  if (existsSync(candidate)) return candidate;
  return value;
}

async function closeWithTimeout(target: { close(): Promise<unknown> } | null | undefined) {
  if (!target) return;
  await Promise.race([
    target.close().catch(() => null),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
}

function buildConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required for --convex-profile");
  }
  return new ConvexHttpClient(convexUrl.replace(/\/+$/, ""));
}

async function loadConvexContext(
  client: ConvexHttpClient,
  targetUrl: string
): Promise<ConvexRuntimeProfileContext> {
  const { companySlug } = validateDirectLeverApplicationUrl(targetUrl);
  const result = await client.query(convexRefs.ashby.getAshbyRuntimeProfileContext, {
    ...(convexDemoUserId ? { demoUserId: convexDemoUserId } : {}),
    organizationSlug: companySlug,
  }) as ConvexRuntimeProfileContext;
  return {
    demoUserId: result.demoUserId,
    profile: result.profile,
    profileSource: result.profileSource,
    profileIdentity: result.profileIdentity,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
