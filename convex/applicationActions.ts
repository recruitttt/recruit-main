/* eslint-disable @typescript-eslint/no-explicit-any */

"use node";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { actionGeneric, anyApi } from "convex/server";
import { v } from "convex/values";
import { DEMO_PROFILE, isProfileUsable } from "../lib/demo-profile";
import { validateDirectAshbyApplicationUrl } from "../lib/ashby-fill/core";
import { validateDirectLeverApplicationUrl } from "../lib/lever-fill/core";
import {
  getPuppeteerBrowser,
  isBrowserbaseCaptchaSolvingEnabled,
  isBrowserbaseConfigured,
} from "../lib/pdf";
import { runFormAutomation } from "../lib/form-engine/runner";
import type {
  ApplicationJobInput,
  ApplicationJobStatus,
  FormProvider,
  SubmissionResult,
} from "../lib/form-engine/types";

const action = actionGeneric;
const DEMO_USER_ID = "demo";
const LIVE_SCREENSHOT_OPTIONS = Object.freeze({
  type: "png",
  fullPage: false,
  encoding: "base64",
  captureBeyondViewport: false,
});

export const runApplicationJob = action({
  args: {
    jobId: v.id("applicationJobs"),
    lockOwner: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const lockOwner = args.lockOwner ?? `application-worker:${Date.now()}`;
    const claim = await ctx.runMutation(anyApi.applicationJobs.claimApplicationJob, {
      jobId: args.jobId,
      lockOwner,
    });
    if (!claim?.claimed) {
      return {
        jobId: args.jobId,
        claimed: false,
        reason: claim?.reason ?? "claim_failed",
      };
    }

    const job = await ctx.runQuery(anyApi.applicationJobs.getApplicationJobForAction, {
      jobId: args.jobId,
    });
    if (!job) {
      return { jobId: args.jobId, claimed: false, reason: "job_not_found_after_claim" };
    }

    const provider = coerceProvider(job.provider ?? job.providerHint) ?? "generic";
    if (job.submitPolicy === "submit") {
      const duplicate = await ctx.runQuery(anyApi.applicationJobs.findConfirmedByIdempotency, {
        idempotencyKey: job.idempotencyKey,
        excludeJobId: args.jobId,
      });
      if (duplicate) {
        const outcome: SubmissionResult = {
          status: "duplicate_or_already_applied",
          provider,
          confidence: 0.95,
          submitAttempted: false,
          submitCompleted: true,
          failureCategory: "duplicate_or_already_applied",
          evidence: {
            finalUrl: job.targetUrl,
            notes: [`duplicate_job=${duplicate._id}`],
            raw: { duplicate },
          },
        };
        await finalize(ctx, args.jobId, "duplicate_or_already_applied", outcome);
        return { jobId: args.jobId, status: "duplicate_or_already_applied", duplicateJobId: duplicate._id };
      }
    }

    let normalizedUrl = job.targetUrl;
    let organizationSlug: string | undefined;
    let companySlug: string | undefined;
    try {
      if (provider === "ashby") {
        const normalized = validateDirectAshbyApplicationUrl(job.targetUrl);
        normalizedUrl = normalized.normalizedUrl;
        organizationSlug = normalized.organizationSlug;
      } else if (provider === "lever") {
        const normalized = validateDirectLeverApplicationUrl(job.targetUrl);
        normalizedUrl = normalized.normalizedUrl;
        companySlug = normalized.companySlug;
      }
      // generic / other providers: use targetUrl as-is
    } catch (error) {
      const status = "failed_unsupported_widget";
      await finalize(ctx, args.jobId, status, undefined, safeMessage(error));
      return { jobId: args.jobId, status, error: safeMessage(error) };
    }

    const demoUserId = job.demoUserId ?? DEMO_USER_ID;
    const requestedSubmitPolicy = job.submitPolicy ?? "dry_run";
    const submitPolicy = provider === "ashby"
      ? resolveAshbySubmitPolicy(normalizedUrl, requestedSubmitPolicy)
      : requestedSubmitPolicy;
    const context = await ctx.runQuery(anyApi.ashby.getAshbyFormFillContext, {
      demoUserId,
      organizationSlug: organizationSlug ?? companySlug,
    });
    const baseProfile = isProfileUsable(context?.profile) ? context.profile : DEMO_PROFILE;
    const tailoredResume = await materializeTailoredResumeForJob(ctx, {
      demoUserId,
      jobId: job.jobId,
    });
    const profile = tailoredResume
      ? withResumePath(baseProfile, tailoredResume.path, tailoredResume.filename)
      : baseProfile;

    let brainstormedAnswers: Array<{ questionType: string; answer: string }> = [];
    try {
      const recruiter = await ctx.runQuery(anyApi.recruiters.findByJobId, { jobId: args.jobId });
      if (recruiter) {
        const conv = await ctx.runQuery(anyApi.recruiters.getConversation, { recruiterId: recruiter._id });
        brainstormedAnswers = (conv?.brainstormedAnswers ?? []).map((a: { questionType: string; answer: string }) => ({
          questionType: a.questionType,
          answer: a.answer,
        }));
      }
    } catch {
      // recruiter or conversation not found — proceed without
    }
    brainstormedAnswers = [
      ...brainstormedAnswers,
      ...((job.brainstormedAnswers ?? []) as Array<{ questionType: string; answer: string }>),
    ];

    const jobInput: ApplicationJobInput = {
      id: args.jobId,
      demoUserId,
      profileId: job.profileId ?? demoUserId,
      providerHint: provider,
      provider,
      jobId: job.jobId ?? null,
      targetUrl: normalizedUrl,
      canonicalTargetUrl: job.canonicalTargetUrl ?? normalizedUrl,
      company: job.company ?? organizationSlug ?? companySlug ?? null,
      title: job.title ?? null,
      submitPolicy,
      llmMode: job.llmMode ?? "best_effort",
      repairLimit: job.repairLimit ?? 1,
      idempotencyKey: job.idempotencyKey,
      brainstormedAnswers,
    };

    await checkpoint(ctx, args.jobId, "browser_starting", "claimed", {
      provider,
      normalizedUrl,
      requestedSubmitPolicy,
      submitPolicy: jobInput.submitPolicy,
      tailoredResume: tailoredResume
        ? {
            source: "tailoredApplications",
            filename: tailoredResume.filename,
            byteLength: tailoredResume.byteLength,
          }
        : null,
    });
    if (requestedSubmitPolicy === "submit" && submitPolicy !== "submit") {
      await checkpoint(ctx, args.jobId, "submit_gate_blocked", "claimed", {
        requestedSubmitPolicy,
        submitPolicy,
        reason: "missing_or_unmatched_test_submit_gate",
      });
    }

    let page: any = null;
    try {
      const browser = await launchBrowserForJob();
      try {
        page = await browser.newPage();
      } catch (error) {
        throw new Error(`browser_page_failed: ${safeMessage(error)}`);
      }
      await checkpoint(ctx, args.jobId, "browser_started", "browser_started", {
        localBrowser: !isBrowserbaseConfigured(),
        browserbaseEnabled: isBrowserbaseConfigured(),
        browserbaseCaptchaSolving: isBrowserbaseCaptchaSolvingEnabled(),
      });
      // Navigate and capture the initial page screenshot before form fill.
      try {
        await page.setViewport?.({ width: 1365, height: 900 });
      } catch { /* viewport may not be available */ }
      try {
        await page.goto(normalizedUrl, { waitUntil: "networkidle2", timeout: 30_000 });
      } catch {
        try {
          await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        } catch { /* form runner will retry navigation */ }
      }
      await captureAndStoreScreenshot(ctx, page, args.jobId, "page_loaded");

      await checkpoint(ctx, args.jobId, "fill_started", "fill_in_progress", {
        llmMode: jobInput.llmMode,
        repairLimit: jobInput.repairLimit,
      });

      const automation = await runFormAutomation({
        page,
        job: jobInput,
        profile,
        aliases: provider === "ashby" && Array.isArray(context?.aliases) ? context.aliases : [],
        approvedAnswers: provider === "ashby" && Array.isArray(context?.approvedAnswers) ? context.approvedAnswers : [],
        openAiApiKey: jobInput.llmMode === "best_effort" ? process.env.OPENAI_API_KEY : null,
        openAiModel:
          provider === "lever"
            ? process.env.OPENAI_LEVER_FILL_MODEL ?? process.env.OPENAI_ASHBY_FILL_MODEL ?? "gpt-4o-mini"
            : process.env.OPENAI_ASHBY_FILL_MODEL ?? "gpt-4o-mini",
      });
      const raw = automation.rawResult as any;

      await captureAndStoreScreenshot(ctx, page, args.jobId, "form_discovered");
      await checkpoint(ctx, args.jobId, "form_discovered", "form_discovered", {
        questionCount: automation.formIR.questions.length,
        controlCount: automation.formIR.controls.length,
        provider: automation.provider,
      });
      await checkpoint(ctx, args.jobId, "answers_resolved", "answers_resolved", {
        mappedCount: raw?.plan?.mapping_decisions?.filter((decision: any) => decision.canonical_key).length ?? null,
        pendingReviewCount: raw?.plan?.pending_review?.length ?? null,
      });
      await captureAndStoreScreenshot(ctx, page, args.jobId, "fields_filled");
      await checkpoint(ctx, args.jobId, "fields_verified", "filled_verified", {
        fillOperationCount: raw?.fillOperations?.length ?? null,
        blockerCount: raw?.blockers?.length ?? null,
        submitReady: raw?.runGrade?.submit_ready ?? null,
      });
      if (automation.submission.submitAttempted) {
        await checkpoint(ctx, args.jobId, "submit_attempted", "submit_attempted", {
          outcome: automation.submission.status,
          confidence: automation.submission.confidence,
        });
      }

      await ctx.runMutation(anyApi.applicationJobs.recordApplicationEvidence, {
        jobId: args.jobId,
        kind: "form_ir",
        payload: toConvexValue(automation.formIR),
      });
      await ctx.runMutation(anyApi.applicationJobs.recordApplicationEvidence, {
        jobId: args.jobId,
        kind: "submission",
        payload: toConvexValue(automation.submission),
      });
      await ctx.runMutation(anyApi.applicationJobs.recordApplicationEvidence, {
        jobId: args.jobId,
        kind: "raw_summary",
        payload: toConvexValue(compactRawResult(raw)),
      });

      const status = statusForSubmission(automation.submission, jobInput.submitPolicy, raw);
      await finalize(ctx, args.jobId, status, automation.submission);
      return {
        jobId: args.jobId,
        status,
        provider: automation.provider,
        submitAttempted: automation.submission.submitAttempted,
        submitCompleted: automation.submission.submitCompleted,
        confidence: automation.submission.confidence,
      };
    } catch (error) {
      const status = statusForError(error);
      const message = safeMessage(error);
      await finalize(ctx, args.jobId, status, undefined, message);
      return {
        jobId: args.jobId,
        status,
        provider,
        submitAttempted: false,
        submitCompleted: false,
        error: message,
      };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  },
});

async function launchBrowserForJob() {
  try {
    return await getPuppeteerBrowser();
  } catch (error) {
    throw new Error(`browser_launch_failed: ${safeMessage(error)}`);
  }
}

async function checkpoint(
  ctx: any,
  jobId: string,
  checkpointName: string,
  status: ApplicationJobStatus,
  payload?: unknown
) {
  await ctx.runMutation(anyApi.applicationJobs.checkpointApplicationJob, {
    jobId,
    checkpoint: checkpointName,
    status,
    payload: toConvexValue(payload ?? {}),
  });
}

async function captureAndStoreScreenshot(
  ctx: any,
  page: any,
  jobId: string,
  label: string
): Promise<void> {
  if (!page?.screenshot) {
    console.warn(`[screenshot] page.screenshot unavailable for ${label}`);
    return;
  }
  try {
    let raw: unknown;
    try {
      raw = await page.screenshot(LIVE_SCREENSHOT_OPTIONS);
    } catch {
      raw = await page.screenshot({ encoding: "base64" });
    }
    const base64 = typeof raw === "string"
      ? raw
      : raw instanceof Uint8Array || Buffer.isBuffer(raw)
        ? Buffer.from(raw as Buffer).toString("base64")
        : null;
    if (!base64) {
      console.warn(`[screenshot] empty result for ${label}`);
      return;
    }
    await ctx.runMutation(anyApi.applicationJobs.recordApplicationEvidence, {
      jobId,
      kind: "live_screenshot",
      payload: { label, pngBase64: base64 },
    });
  } catch (err) {
    console.error(`[screenshot] ${label}:`, err instanceof Error ? err.message : err);
  }
}

async function finalize(
  ctx: any,
  jobId: string,
  status: ApplicationJobStatus,
  outcome?: SubmissionResult,
  error?: string
) {
  await ctx.runMutation(anyApi.applicationJobs.finalizeApplicationJob, {
    jobId,
    status,
    finalOutcome: outcome ? toConvexValue(outcome) : undefined,
    evidenceSummary: outcome ? toConvexValue(outcome.evidence) : undefined,
    error,
  });
}

async function materializeTailoredResumeForJob(
  ctx: any,
  args: { demoUserId: string; jobId?: string | null }
): Promise<{ path: string; filename: string; byteLength: number } | null> {
  if (!args.jobId) return null;
  const tailored = await ctx.runQuery(anyApi.ashby.getCompletedTailoredApplicationForAction, {
    demoUserId: args.demoUserId,
    jobId: args.jobId,
  });
  const pdfBase64 = typeof tailored?.pdfBase64 === "string" ? tailored.pdfBase64 : null;
  if (!pdfBase64) return null;

  const bytes = Buffer.from(pdfBase64, "base64");
  if (bytes.byteLength === 0) return null;

  const filename = safePdfFilename(tailored.pdfFilename);
  const dir = "/tmp/recruit-tailored-resumes";
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${safeFileSegment(args.jobId)}-${filename}`);
  await writeFile(filePath, bytes);
  return { path: filePath, filename, byteLength: bytes.byteLength };
}

function withResumePath(profile: unknown, resumePath: string, filename: string): unknown {
  const base = isRecord(profile) ? profile : {};
  const files = isRecord(base.files) ? base.files : {};
  const resume = isRecord(base.resume) ? base.resume : {};
  return {
    ...base,
    resumePath,
    files: {
      ...files,
      resumePath,
    },
    resume: {
      ...resume,
      filename,
    },
  };
}

function safePdfFilename(value: unknown): string {
  const candidate = typeof value === "string" && value.trim() ? value.trim() : "Tailored_Resume.pdf";
  const safe = candidate.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe || "Tailored_Resume"}.pdf`;
}

function safeFileSegment(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "job";
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function statusForSubmission(
  result: SubmissionResult,
  submitPolicy: "dry_run" | "submit",
  rawResult?: any
): ApplicationJobStatus {
  if (submitPolicy === "dry_run") {
    const blockerCount = Array.isArray(rawResult?.blockers) ? rawResult.blockers.length : 0;
    const needsUserAnswerCount = Array.isArray(rawResult?.needsUserAnswers) ? rawResult.needsUserAnswers.length : 0;
    return blockerCount === 0 && needsUserAnswerCount === 0
      ? "filled_verified"
      : result.failureCategory ?? "failed_user_input_required";
  }
  if (result.status === "confirmed") return "submitted_confirmed";
  if (result.status === "likely_submitted") return "submitted_probable";
  if (result.status === "duplicate_or_already_applied") return "duplicate_or_already_applied";
  return result.failureCategory ?? "failed_repairable";
}

function statusForError(error: unknown): ApplicationJobStatus {
  const message = safeMessage(error).toLowerCase();
  if (message.includes("target closed") || message.includes("browser") || message.includes("protocol error")) {
    return "failed_browser_crash";
  }
  if (message.includes("fetch failed") || message.includes("network") || message.includes("timeout")) {
    return "failed_network";
  }
  return "failed_repairable";
}

function coerceProvider(value: string | undefined): FormProvider | null {
  if (value === "ashby" || value === "greenhouse" || value === "lever" || value === "workday" || value === "generic") {
    return value;
  }
  return null;
}

function resolveAshbySubmitPolicy(
  targetUrl: string,
  requested: "dry_run" | "submit"
): "dry_run" | "submit" {
  if (requested !== "submit") return "dry_run";
  if (process.env.RECRUIT_ASHBY_SUBMIT_GATE !== "1") return "dry_run";
  const allowedUrls = (process.env.RECRUIT_ASHBY_ALLOWED_SUBMIT_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const singleAllowedUrl = process.env.RECRUIT_ASHBY_TEST_POSTING_URL?.trim();
  if (singleAllowedUrl) allowedUrls.push(singleAllowedUrl);
  const normalizedAllowedUrls = allowedUrls.flatMap((value) => {
    try {
      return [validateDirectAshbyApplicationUrl(value).normalizedUrl];
    } catch {
      return [];
    }
  });
  return normalizedAllowedUrls.includes(targetUrl) ? "submit" : "dry_run";
}

function compactRawResult(raw: any) {
  if (!raw) return null;
  return {
    targetUrl: raw.targetUrl,
    finalUrl: raw.finalUrl,
    organizationSlug: raw.organizationSlug,
    companySlug: raw.companySlug,
    postingId: raw.postingId,
    provider: raw.provider,
    outcome: raw.outcome,
    submitAttempted: raw.submitAttempted,
    submitCompleted: raw.submitCompleted,
    runGrade: raw.runGrade,
    blockers: raw.blockers,
    needsUserAnswers: raw.needsUserAnswers,
    fillOperations: raw.fillOperations,
    screenshots: raw.screenshots,
    notes: raw.notes,
    errors: raw.errors,
  };
}

function safeMessage(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message;
  return String(error);
}

function toConvexValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
