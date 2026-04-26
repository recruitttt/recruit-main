/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  internalMutationGeneric,
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import {
  canonicalizeJobUrl,
  computeApplicationIdempotencyKey,
  extractProviderJobId,
} from "../lib/form-engine/idempotency";
import { detectProviderFromUrl } from "../lib/form-engine/ashby-adapter";
import type { ApplicationJobStatus, FormProvider } from "../lib/form-engine/types";

const query = queryGeneric;
const mutation = mutationGeneric;
const internalQuery = internalQueryGeneric;
const internalMutation = internalMutationGeneric;

const DEMO_USER_ID = "demo";

const applicationJobStatus = v.union(
  v.literal("queued"),
  v.literal("claimed"),
  v.literal("browser_started"),
  v.literal("form_discovered"),
  v.literal("answers_resolved"),
  v.literal("fill_in_progress"),
  v.literal("filled_verified"),
  v.literal("waiting_for_user_input"),
  v.literal("submit_attempted"),
  v.literal("submitted_confirmed"),
  v.literal("submitted_probable"),
  v.literal("failed_repairable"),
  v.literal("failed_user_input_required"),
  v.literal("failed_unsupported_widget"),
  v.literal("failed_auth_required"),
  v.literal("failed_captcha_or_bot_challenge"),
  v.literal("failed_browser_crash"),
  v.literal("failed_network"),
  v.literal("duplicate_or_already_applied"),
  v.literal("archived")
);

async function scopedDemoUserId(ctx: any, requestedDemoUserId?: string) {
  if (requestedDemoUserId) return requestedDemoUserId;
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ? `auth:${identity.subject}` : DEMO_USER_ID;
}

export const createApplicationJob = mutation({
  args: {
    demoUserId: v.optional(v.string()),
    profileId: v.optional(v.string()),
    jobId: v.optional(v.id("ingestedJobs")),
    targetUrl: v.string(),
    providerHint: v.optional(v.string()),
    company: v.optional(v.string()),
    title: v.optional(v.string()),
    submitPolicy: v.optional(v.union(v.literal("dry_run"), v.literal("submit"))),
    engine: v.optional(v.union(v.literal("deterministic"), v.literal("ai-fill"))),
    llmMode: v.optional(v.union(v.literal("off"), v.literal("review_only"), v.literal("best_effort"))),
    repairLimit: v.optional(v.number()),
  },
  returns: v.object({
    jobId: v.id("applicationJobs"),
    idempotencyKey: v.string(),
    status: v.literal("queued"),
  }),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const provider = coerceProvider(args.providerHint) ?? detectProviderFromUrl(args.targetUrl);
    const canonicalTargetUrl = canonicalizeJobUrl(args.targetUrl);
    const idempotencyKey = computeApplicationIdempotencyKey({
      demoUserId,
      profileId: args.profileId,
      provider,
      providerJobId: extractProviderJobId(provider, canonicalTargetUrl),
      targetUrl: canonicalTargetUrl,
      company: args.company,
      title: args.title,
    });
    const now = new Date().toISOString();
    const jobId = await ctx.db.insert("applicationJobs", omitUndefined({
      demoUserId,
      profileId: args.profileId,
      jobId: args.jobId,
      targetUrl: args.targetUrl,
      canonicalTargetUrl,
      providerHint: args.providerHint,
      provider,
      company: args.company,
      title: args.title,
      submitPolicy: args.submitPolicy ?? "dry_run",
      engine: args.engine,
      llmMode: args.llmMode ?? "best_effort",
      repairLimit: args.repairLimit ?? 1,
      status: "queued" as const,
      attemptCount: 0,
      repairAttemptCount: 0,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    }));
    await ctx.db.insert("applicationJobCheckpoints", {
      jobId,
      status: "queued",
      checkpoint: "job_created",
      payload: { targetUrl: args.targetUrl, provider, submitPolicy: args.submitPolicy ?? "dry_run" },
      createdAt: now,
    });
    return { jobId, idempotencyKey, status: "queued" as const };
  },
});

export const getApplicationJob = query({
  args: { jobId: v.id("applicationJobs") },
  returns: v.any(),
  handler: async (ctx, args) => await ctx.db.get(args.jobId),
});

export const ensureForTailoredApplication = mutation({
  args: {
    userId: v.string(),
    tailoredApplicationId: v.id("tailoredApplications"),
  },
  returns: v.id("applicationJobs"),
  handler: async (ctx, { userId, tailoredApplicationId }) => {
    const tailored: any = await ctx.db.get(tailoredApplicationId);
    if (!tailored) throw new Error("tailored application not found");
    const ingestedJobId = tailored.jobId;
    const ingested: any = ingestedJobId ? await ctx.db.get(ingestedJobId) : null;
    if (!ingested) throw new Error("ingested job not found for tailored application");

    const targetUrl: string =
      ingested.applyUrl ?? ingested.jobUrl ?? tailored.job?.applyUrl ?? tailored.job?.jobUrl;
    if (!targetUrl) throw new Error("no target url for application");

    const company: string | undefined = ingested.company ?? tailored.company ?? tailored.job?.company;
    const title: string | undefined = ingested.title ?? tailored.title ?? tailored.job?.title;

    const provider = coerceProvider(undefined) ?? detectProviderFromUrl(targetUrl);
    const canonicalTargetUrl = canonicalizeJobUrl(targetUrl);
    const idempotencyKey = computeApplicationIdempotencyKey({
      demoUserId: userId,
      profileId: undefined,
      provider,
      providerJobId: extractProviderJobId(provider, canonicalTargetUrl),
      targetUrl: canonicalTargetUrl,
      company,
      title,
    });

    const existing = await ctx.db
      .query("applicationJobs")
      .withIndex("by_idempotency", (q: any) => q.eq("idempotencyKey", idempotencyKey))
      .first();
    if (existing) return existing._id;

    const now = new Date().toISOString();
    const jobId = await ctx.db.insert("applicationJobs", omitUndefined({
      demoUserId: userId,
      jobId: ingestedJobId,
      targetUrl,
      canonicalTargetUrl,
      provider,
      company,
      title,
      submitPolicy: "dry_run" as const,
      llmMode: "best_effort" as const,
      repairLimit: 1,
      status: "queued" as const,
      attemptCount: 0,
      repairAttemptCount: 0,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    }));
    await ctx.db.insert("applicationJobCheckpoints", {
      jobId,
      status: "queued",
      checkpoint: "job_created",
      payload: { targetUrl, provider, source: "ensureForTailoredApplication" },
      createdAt: now,
    });
    return jobId;
  },
});

export const listRecentForCurrentUser = query({
  args: {
    limit: v.optional(v.number()),
    demoUserId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const limit = Math.min(args.limit ?? 25, 100);
    const rows = await ctx.db
      .query("applicationJobs")
      .withIndex("by_demo_user_status", (q: any) => q.eq("demoUserId", demoUserId))
      .order("desc")
      .take(limit);
    return rows.map((row: any) => ({
      _id: row._id,
      jobId: row.jobId,
      company: row.company,
      title: row.title,
      status: row.status,
      provider: row.provider,
      targetUrl: row.targetUrl,
      submitPolicy: row.submitPolicy,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    }));
  },
});

export const listJobEvidence = query({
  args: { jobId: v.id("applicationJobs") },
  returns: v.any(),
  handler: async (ctx, args) =>
    ctx.db
      .query("applicationJobEvidence")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("asc")
      .collect(),
});

export const getApplicationJobForAction = internalQuery({
  args: { jobId: v.id("applicationJobs") },
  returns: v.any(),
  handler: async (ctx, args) => await ctx.db.get(args.jobId),
});

export const findConfirmedByIdempotency = internalQuery({
  args: {
    idempotencyKey: v.string(),
    excludeJobId: v.optional(v.id("applicationJobs")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("applicationJobs")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .collect();
    return matches.find((job) =>
      job._id !== args.excludeJobId &&
      (job.status === "submitted_confirmed" || job.status === "duplicate_or_already_applied")
    ) ?? null;
  },
});

export const claimApplicationJob = internalMutation({
  args: {
    jobId: v.id("applicationJobs"),
    lockOwner: v.string(),
    lockTtlMs: v.optional(v.number()),
  },
  returns: v.object({
    claimed: v.boolean(),
    reason: v.optional(v.string()),
    job: v.optional(v.any()),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return { claimed: false, reason: "job_not_found" };
    const nowMs = Date.now();
    if (isTerminalStatus(job.status)) {
      return { claimed: false, reason: `terminal_status:${job.status}`, job };
    }
    if (job.lockOwner && job.lockOwner !== args.lockOwner && job.lockExpiresAt && Date.parse(job.lockExpiresAt) > nowMs) {
      return { claimed: false, reason: "locked_by_other_worker", job };
    }

    const now = new Date(nowMs).toISOString();
    const lockExpiresAt = new Date(nowMs + (args.lockTtlMs ?? 10 * 60 * 1000)).toISOString();
    await ctx.db.patch(args.jobId, {
      status: "claimed",
      lockOwner: args.lockOwner,
      lockExpiresAt,
      attemptCount: (job.attemptCount ?? 0) + 1,
      lastCheckpoint: "claimed",
      updatedAt: now,
    });
    await ctx.db.insert("applicationJobCheckpoints", {
      jobId: args.jobId,
      status: "claimed",
      checkpoint: "claimed",
      payload: { lockOwner: args.lockOwner, lockExpiresAt },
      createdAt: now,
    });
    return {
      claimed: true,
      job: {
        ...job,
        status: "claimed",
        lockOwner: args.lockOwner,
        lockExpiresAt,
        attemptCount: (job.attemptCount ?? 0) + 1,
      },
    };
  },
});

export const checkpointApplicationJob = internalMutation({
  args: {
    jobId: v.id("applicationJobs"),
    checkpoint: v.string(),
    status: v.optional(applicationJobStatus),
    payload: v.optional(v.any()),
    repairAttemptDelta: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const now = new Date().toISOString();
    await ctx.db.patch(args.jobId, omitUndefined({
      status: args.status,
      repairAttemptCount: args.repairAttemptDelta
        ? (job.repairAttemptCount ?? 0) + args.repairAttemptDelta
        : undefined,
      lastCheckpoint: args.checkpoint,
      updatedAt: now,
    }));
    await ctx.db.insert("applicationJobCheckpoints", omitUndefined({
      jobId: args.jobId,
      status: args.status ?? job.status,
      checkpoint: args.checkpoint,
      payload: args.payload,
      createdAt: now,
    }));
    return null;
  },
});

export const recordApplicationEvidence = internalMutation({
  args: {
    jobId: v.id("applicationJobs"),
    kind: v.string(),
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("applicationJobEvidence", {
      jobId: args.jobId,
      kind: args.kind,
      payload: args.payload,
      createdAt: new Date().toISOString(),
    });
    return null;
  },
});

export const finalizeApplicationJob = internalMutation({
  args: {
    jobId: v.id("applicationJobs"),
    status: applicationJobStatus,
    finalOutcome: v.optional(v.any()),
    evidenceSummary: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const now = new Date().toISOString();
    const patch = omitUndefined({
      status: args.status,
      finalOutcome: args.finalOutcome,
      evidenceSummary: args.evidenceSummary,
      error: args.error,
      lastCheckpoint: `final:${args.status}`,
      completedAt: isTerminalStatus(args.status) ? now : undefined,
      updatedAt: now,
    });
    await ctx.db.patch(args.jobId, {
      ...patch,
      lockOwner: undefined,
      lockExpiresAt: undefined,
    });
    await ctx.db.insert("applicationJobCheckpoints", omitUndefined({
      jobId: args.jobId,
      status: args.status,
      checkpoint: `final:${args.status}`,
      payload: { finalOutcome: args.finalOutcome, error: args.error },
      createdAt: now,
    }));
    return null;
  },
});

function coerceProvider(value: string | undefined): FormProvider | null {
  if (value === "ashby" || value === "greenhouse" || value === "lever" || value === "workday" || value === "generic") {
    return value;
  }
  return null;
}

function isTerminalStatus(status: ApplicationJobStatus): boolean {
  return [
    "submitted_confirmed",
    "submitted_probable",
    "filled_verified",
    "failed_repairable",
    "failed_user_input_required",
    "failed_unsupported_widget",
    "failed_auth_required",
    "failed_captcha_or_bot_challenge",
    "failed_browser_crash",
    "failed_network",
    "duplicate_or_already_applied",
    "archived",
  ].includes(status);
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
