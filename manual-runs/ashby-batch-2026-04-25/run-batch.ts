import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { ConvexHttpClient } from "convex/browser";
import { getPuppeteerBrowser } from "../../lib/pdf";
import { runAshbyFormFillOnPage } from "../../lib/ashby-fill/browser";
import { validateDirectAshbyApplicationUrl } from "../../lib/ashby-fill/core";
import { convexRefs } from "../../lib/convex-refs";
import { DEMO_PROFILE } from "../../lib/demo-profile";

type BatchInput = {
  urls: string[];
  split?: {
    train?: { startIndex: number; endIndex: number };
    test?: { startIndex: number; endIndex: number };
  };
};

type ConvexAshbyRuntimeProfileContext = {
  demoUserId: string;
  profile: unknown;
  profileSource: "convex" | "missing";
  profileIdentity?: unknown;
  aliases?: unknown[];
  approvedAnswers?: unknown[];
};

const root = "/Users/owenfisher/Desktop/recruit-main";
loadEnvConfig(root);
const inputPath = `${root}/manual-runs/ashby-batch-2026-04-25/urls.json`;
const outputDir = `${root}/manual-runs/ashby-batch-2026-04-25/results`;
const input = JSON.parse(readFileSync(inputPath, "utf8")) as BatchInput;

const startIndex = Number(process.argv[2] ?? "1");
const endIndex = Number(process.argv[3] ?? String(input.urls.length));
const label = process.argv[4] ?? `${startIndex}-${endIndex}`;
const openAiBestEffort = process.argv.includes("--openai");
const submit = process.argv.includes("--submit");
const allowHeldout = process.argv.includes("--allow-heldout");
const profileFlagIndex = process.argv.indexOf("--profile");
const profilePath = profileFlagIndex >= 0 ? process.argv[profileFlagIndex + 1] : null;
const convexProfileFlagIndex = process.argv.indexOf("--convex-profile");
const convexProfileValue = convexProfileFlagIndex >= 0 ? process.argv[convexProfileFlagIndex + 1] : null;
const convexDemoUserId = convexProfileValue && !convexProfileValue.startsWith("--") ? convexProfileValue : undefined;
if (profilePath && convexProfileFlagIndex >= 0) {
  throw new Error("use either --profile or --convex-profile, not both");
}
const fileProfile = profilePath
  ? JSON.parse(readFileSync(profilePath.startsWith("/") ? profilePath : `${root}/${profilePath}`, "utf8"))
  : null;

const heldout = input.split?.test;
if (heldout && !allowHeldout && rangesOverlap(startIndex, endIndex, heldout.startIndex, heldout.endIndex)) {
  throw new Error(`refusing_to_touch_heldout_range_${heldout.startIndex}_${heldout.endIndex}`);
}

mkdirSync(outputDir, { recursive: true });

function compact(result: Awaited<ReturnType<typeof runAshbyFormFillOnPage>>, index: number) {
  return {
    index,
    targetUrl: result.targetUrl,
    finalUrl: result.finalUrl,
    organizationSlug: result.organizationSlug,
    outcome: result.outcome,
    submitAttempted: result.submitAttempted,
    submitCompleted: result.submitCompleted,
    discoveredQuestions: result.finalSnapshot.questions.length,
    requiredQuestions: result.finalSnapshot.questions.filter((question) => question.required).length,
    fillOperationCount: result.fillOperations.length,
    filledCount: result.fillOperations.filter((operation) => operation.status === "filled").length,
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

async function closeWithTimeout(target: { close(): Promise<unknown> } | null | undefined) {
  if (!target) return;
  await Promise.race([
    target.close().catch(() => null),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
}

async function main() {
  const convexClient = convexProfileFlagIndex >= 0 ? buildConvexClient() : null;
  const browser = await getPuppeteerBrowser();
  const summary = [];

  try {
    for (let index = startIndex; index <= Math.min(endIndex, input.urls.length); index += 1) {
      const url = input.urls[index - 1];
      if (!url) continue;
      const page = await browser.newPage();
      try {
        const context = convexClient
          ? await loadConvexContext(convexClient, url)
          : {
              demoUserId: "local",
              profile: fileProfile ?? DEMO_PROFILE,
              profileSource: fileProfile ? "file" : "demo",
              profileIdentity: null,
              aliases: [],
              approvedAnswers: [],
            };
        if (!context.profile) {
          throw new Error(`convex_profile_missing:${context.demoUserId}`);
        }
        const result = await runAshbyFormFillOnPage(page as any, {
          targetUrl: url,
          profile: context.profile,
          aliases: context.aliases as any[] | undefined,
          approvedAnswers: context.approvedAnswers as any[] | undefined,
          openAiBestEffort,
          openAiApiKey: openAiBestEffort ? process.env.OPENAI_API_KEY : null,
          openAiModel: process.env.OPENAI_ASHBY_FILL_MODEL ?? "gpt-4o-mini",
          draftAnswerMode: openAiBestEffort ? "fill" : "review_only",
          submit,
        });
        const compactResult = {
          ...compact(result, index),
          profileSource: context.profileSource,
          profileIdentity: context.profileIdentity,
          approvedAnswerCount: context.approvedAnswers?.length ?? 0,
          aliasCount: context.aliases?.length ?? 0,
        };
        summary.push(compactResult);
        writeFileSync(join(outputDir, `result-${String(index).padStart(2, "0")}.json`), JSON.stringify(result, null, 2));
        writeFileSync(join(outputDir, `${label}-summary.json`), JSON.stringify(summary, null, 2));
        console.log(JSON.stringify({
          index,
          finalUrl: compactResult.finalUrl,
          outcome: compactResult.outcome,
          submitAttempted: compactResult.submitAttempted,
          discoveredQuestions: compactResult.discoveredQuestions,
          filledCount: compactResult.filledCount,
          blockerCount: compactResult.blockers.length,
          needsUserAnswerCount: compactResult.needsUserAnswers.length,
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
      }
    }
  } finally {
    await closeWithTimeout(browser);
  }
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA <= endB && startB <= endA;
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
): Promise<ConvexAshbyRuntimeProfileContext> {
  const { organizationSlug } = validateDirectAshbyApplicationUrl(targetUrl);
  return await client.query(convexRefs.ashby.getAshbyRuntimeProfileContext, {
    ...(convexDemoUserId ? { demoUserId: convexDemoUserId } : {}),
    organizationSlug,
  }) as ConvexAshbyRuntimeProfileContext;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
