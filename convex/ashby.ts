/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  anyApi,
  internalMutationGeneric,
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;
const internalQuery = internalQueryGeneric;
const internalMutation = internalMutationGeneric;

const DEMO_USER_ID = "demo";

async function scopedDemoUserId(ctx: any, requestedDemoUserId?: string) {
  if (requestedDemoUserId) return requestedDemoUserId;
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ? `auth:${identity.subject}` : DEMO_USER_ID;
}

function normalizeConvexFieldName(key: string) {
  return key
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function normalizeConvexObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeConvexObjectKeys(item));
  if (!value || typeof value !== "object") return value;
  const normalized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    normalized[normalizeConvexFieldName(key)] = normalizeConvexObjectKeys(nested);
  }
  return normalized;
}

export const upsertDemoProfileSnapshot = mutation({
  args: {
    demoUserId: v.optional(v.string()),
    profile: v.any(),
  },
  returns: v.object({ demoUserId: v.string(), updatedAt: v.string() }),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const updatedAt = new Date().toISOString();
    const profile = normalizeConvexObjectKeys(args.profile);
    const existing = await ctx.db
      .query("demoProfiles")
      .withIndex("by_demo_user", (q) => q.eq("demoUserId", demoUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { profile, updatedAt });
    } else {
      await ctx.db.insert("demoProfiles", {
        demoUserId,
        profile,
        updatedAt,
      });
    }

    return { demoUserId, updatedAt };
  },
});

export const startOnboardingPipeline = mutation({
  args: {
    demoUserId: v.optional(v.string()),
    profile: v.any(),
    limitSources: v.optional(v.number()),
    tailorLimit: v.optional(v.number()),
  },
  returns: v.object({
    demoUserId: v.string(),
    runId: v.id("ingestionRuns"),
    status: v.literal("started"),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const now = new Date().toISOString();
    const limitSources = args.limitSources ?? 3;
    const tailorLimit = args.tailorLimit ?? 3;
    const profile = normalizeConvexObjectKeys(args.profile);
    const existing = await ctx.db
      .query("demoProfiles")
      .withIndex("by_demo_user", (q) => q.eq("demoUserId", demoUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { profile, updatedAt: now });
    } else {
      await ctx.db.insert("demoProfiles", {
        demoUserId,
        profile,
        updatedAt: now,
      });
    }

    const runId = await ctx.db.insert("ingestionRuns", {
      demoUserId,
      provider: "ashby",
      status: "fetching",
      startedAt: now,
      sourceCount: limitSources,
      fetchedCount: 0,
      rawJobCount: 0,
      filteredCount: 0,
      survivorCount: 0,
      llmScoredCount: 0,
      recommendedCount: 0,
      errorCount: 0,
      errors: [],
    });

    await ctx.db.insert("pipelineLogs", {
      demoUserId,
      runId,
      stage: "profile",
      level: "success",
      message: "Saved onboarding profile snapshot.",
      payload: { targetRoles: (profile as any)?.targetRoles ?? (profile as any)?.prefs?.roles ?? [] },
      createdAt: now,
    });
    await ctx.db.insert("pipelineLogs", {
      demoUserId,
      runId,
      stage: "queue",
      level: "info",
      message: `Started async onboarding pipeline. Tailoring top ${tailorLimit} jobs in the background.`,
      payload: { limitSources, tailorLimit },
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, anyApi.ashbyActions.runOnboardingPipeline, {
      demoUserId,
      runId,
      limitSources,
      tailorLimit,
    });

    return {
      demoUserId,
      runId,
      status: "started" as const,
      message: "Dashboard is ready. Jobs and tailored resumes will appear as the pipeline runs.",
    };
  },
});

export const enabledAshbySources = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const sources = await ctx.db
      .query("ashbySources")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    return sources.sort((a, b) => a.company.localeCompare(b.company));
  },
});

export const latestIngestionRunSummary = query({
  args: { demoUserId: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const selection = await preferredDashboardRun(ctx, demoUserId);
    if (!selection) return null;
    const run = decorateRunForDashboard(selection.run, selection.provider);

    const recommendations = await ctx.db
      .query("jobRecommendations")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const tailoredApplications = await ctx.db
      .query("tailoredApplications")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const tailoredCount = tailoredApplications.filter((application) => application.status === "completed").length;
    const tailoringAttemptedCount = tailoredApplications.filter((application) =>
      ["tailoring", "completed", "failed"].includes(application.status)
    ).length;
    const availableRecommendationCount = Math.max(recommendations.length, run.recommendedCount);
    const tailoringTargetCount = availableRecommendationCount > 0 ? Math.min(3, availableRecommendationCount) : 3;
    const tailoringInProgress = run.status !== "failed" &&
      (run.status !== "completed" || (run.recommendedCount > 0 && tailoringAttemptedCount < tailoringTargetCount));

    return {
      ...run,
      suppressedLatestRun: selection.suppressedLatestRun,
      recommendations: recommendations.sort((a, b) => a.rank - b.rank),
      tailoredCount,
      tailoringAttemptedCount,
      tailoringTargetCount,
      tailoringInProgress,
      hasCompletedTailoring: tailoredCount > 0,
    };
  },
});

export const ingestionRunSummary = query({
  args: {
    runId: v.id("ingestionRuns"),
    demoUserId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const selected = await ctx.db.get(args.runId);
    if (!selected || selected.demoUserId !== demoUserId) return null;
    const provider = await inferRunProvider(ctx, selected);
    const run = decorateRunForDashboard(selected, provider);

    const recommendations = await ctx.db
      .query("jobRecommendations")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const tailoredApplications = await ctx.db
      .query("tailoredApplications")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const tailoredCount = tailoredApplications.filter((application) => application.status === "completed").length;
    const tailoringAttemptedCount = tailoredApplications.filter((application) =>
      ["tailoring", "completed", "failed"].includes(application.status)
    ).length;
    const availableRecommendationCount = Math.max(recommendations.length, run.recommendedCount);
    const tailoringTargetCount = availableRecommendationCount > 0 ? Math.min(3, availableRecommendationCount) : 3;
    const tailoringInProgress = run.status !== "failed" &&
      (run.status !== "completed" || (run.recommendedCount > 0 && tailoringAttemptedCount < tailoringTargetCount));

    return {
      ...run,
      recommendations: recommendations.sort((a, b) => a.rank - b.rank),
      tailoredCount,
      tailoringAttemptedCount,
      tailoringTargetCount,
      tailoringInProgress,
      hasCompletedTailoring: tailoredCount > 0,
    };
  },
});

export const listRecommendationsForRun = internalQuery({
  args: { runId: v.id("ingestionRuns") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const recommendations = await ctx.db
      .query("jobRecommendations")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
    return recommendations.sort((a, b) => a.rank - b.rank);
  },
});

export const getDemoProfileForAction = internalQuery({
  args: { demoUserId: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const profile = await ctx.db
      .query("demoProfiles")
      .withIndex("by_demo_user", (q) => q.eq("demoUserId", demoUserId))
      .unique();
    return profile?.profile ?? {};
  },
});

export const currentRecommendations = query({
  args: { demoUserId: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const selection = await preferredDashboardRun(ctx, demoUserId);
    if (!selection) return [];
    const run = selection.run;
    const recommendations = await ctx.db
      .query("jobRecommendations")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const sorted = recommendations.sort((a, b) => a.rank - b.rank);
    return await Promise.all(
      sorted.map(async (recommendation) => ({
        ...recommendation,
        job: await ctx.db.get(recommendation.jobId),
      }))
    );
  },
});

export const recommendationsForRun = query({
  args: {
    runId: v.id("ingestionRuns"),
    demoUserId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const run = await ctx.db.get(args.runId);
    if (!run || run.demoUserId !== demoUserId) return [];
    const recommendations = await ctx.db
      .query("jobRecommendations")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const sorted = recommendations.sort((a, b) => a.rank - b.rank);
    return await Promise.all(
      sorted.map(async (recommendation) => ({
        ...recommendation,
        job: await ctx.db.get(recommendation.jobId),
      }))
    );
  },
});

export const jobDetail = query({
  args: { jobId: v.id("ingestedJobs"), demoUserId: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    const [decision, score, recommendation, tailoredApplication, artifacts] =
      await Promise.all([
        ctx.db
          .query("jobFilterDecisions")
          .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
          .first(),
        ctx.db
          .query("jobScores")
          .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
          .first(),
        ctx.db
          .query("jobRecommendations")
          .withIndex("by_run", (q) => q.eq("runId", job.runId))
          .filter((q) => q.eq(q.field("jobId"), args.jobId))
          .first(),
        ctx.db
          .query("tailoredApplications")
          .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
          .filter((q) => q.eq(q.field("demoUserId"), demoUserId))
          .first(),
        ctx.db
          .query("jobPipelineArtifacts")
          .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
          .collect(),
      ]);

    return {
      job,
      decision,
      score,
      recommendation,
      tailoredApplication,
      artifacts: artifacts.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  },
});

export const latestPipelineLogs = query({
  args: {
    demoUserId: v.optional(v.string()),
    runId: v.optional(v.id("ingestionRuns")),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const docs = args.runId
      ? await ctx.db
          .query("pipelineLogs")
          .withIndex("by_run", (q) => q.eq("runId", args.runId))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("pipelineLogs")
          .withIndex("by_demo_user", (q) => q.eq("demoUserId", demoUserId))
          .order("desc")
          .take(limit);

    return docs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
});

export const appendPipelineLog = internalMutation({
  args: {
    demoUserId: v.optional(v.string()),
    runId: v.optional(v.id("ingestionRuns")),
    stage: v.string(),
    level: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error")
    ),
    message: v.string(),
    payload: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("pipelineLogs", omitUndefined({
      demoUserId: args.demoUserId ?? DEMO_USER_ID,
      runId: args.runId,
      stage: args.stage,
      level: args.level,
      message: args.message,
      payload: args.payload,
      createdAt: new Date().toISOString(),
    }));
    return null;
  },
});

export const getAshbyFormFillContext = internalQuery({
  args: {
    demoUserId: v.optional(v.string()),
    organizationSlug: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const organizationSlug = args.organizationSlug?.trim().toLowerCase() ?? null;
    const profile = await ctx.db
      .query("demoProfiles")
      .withIndex("by_demo_user", (q) => q.eq("demoUserId", demoUserId))
      .unique();

    const scopes = [
      { scopeKind: "global" as const, scopeValue: "__global__" },
      ...(organizationSlug
        ? [{ scopeKind: "organization" as const, scopeValue: organizationSlug }]
        : []),
    ];

    const aliases = [];
    const approvedAnswers = [];
    for (const scope of scopes) {
      const scopeAliases = await ctx.db
        .query("ashbyPromptAliases")
        .withIndex("by_scope", (q) => q.eq("provider", "ashby"))
        .filter((q) => q.eq(q.field("scopeKind"), scope.scopeKind))
        .filter((q) => q.eq(q.field("scopeValue"), scope.scopeValue))
        .filter((q) => q.eq(q.field("approved"), true))
        .collect();
      aliases.push(
        ...scopeAliases.map((alias) => ({
          provider: "ashby",
          scopeKind: alias.scopeKind,
          scopeValue: alias.scopeValue,
          promptHash: alias.promptHash,
          normalizedPrompt: alias.normalizedPrompt,
          controlKind: alias.controlKind,
          optionSignature: alias.optionSignature ?? null,
          canonicalKey: alias.canonicalKey,
          confidence: alias.confidence,
          source: alias.source,
          approved: alias.approved,
        }))
      );

      const answers = await ctx.db
        .query("ashbyApprovedAnswers")
        .withIndex("by_demo_user_scope", (q) => q.eq("demoUserId", demoUserId))
        .filter((q) => q.eq(q.field("provider"), "ashby"))
        .filter((q) => q.eq(q.field("scopeKind"), scope.scopeKind))
        .filter((q) => q.eq(q.field("scopeValue"), scope.scopeValue))
        .filter((q) => q.eq(q.field("approved"), true))
        .collect();
      approvedAnswers.push(
        ...answers.map((answer) => ({
          provider: "ashby",
          scopeKind: answer.scopeKind,
          scopeValue: answer.scopeValue,
          canonicalKey: answer.canonicalKey,
          promptHash: answer.promptHash ?? null,
          answerValue: answer.answerValue,
          answerKind: answer.answerKind,
          source: answer.source,
          approved: answer.approved,
        }))
      );
    }

    return {
      demoUserId,
      profile: profile?.profile ?? null,
      aliases,
      approvedAnswers,
    };
  },
});

export const getAshbyRuntimeProfileContext = query({
  args: {
    demoUserId: v.optional(v.string()),
    organizationSlug: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const context = await loadAshbyFormFillContext(ctx, args);
    return {
      ...context,
      profileIdentity: profileIdentityForAshbyRun(context.profile),
      profileSource: context.profile ? "convex" : "missing",
    };
  },
});

export const upsertAshbyApprovedAnswer = mutation({
  args: {
    demoUserId: v.optional(v.string()),
    organizationSlug: v.optional(v.string()),
    scopeKind: v.optional(v.union(v.literal("global"), v.literal("organization"))),
    canonicalKey: v.string(),
    promptHash: v.optional(v.string()),
    answerValue: v.string(),
    answerKind: v.union(v.literal("text"), v.literal("choice"), v.literal("file")),
    source: v.optional(v.string()),
  },
  returns: v.object({ id: v.id("ashbyApprovedAnswers"), updatedAt: v.string() }),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const now = new Date().toISOString();
    const scopeKind = args.scopeKind ?? (args.organizationSlug ? "organization" : "global");
    const scopeValue = scopeKind === "organization"
      ? String(args.organizationSlug ?? "").trim().toLowerCase()
      : "__global__";
    if (scopeKind === "organization" && !scopeValue) {
      throw new Error("organization_slug_required");
    }

    const existing = await findApprovedAnswer(ctx, {
      demoUserId,
      scopeKind,
      scopeValue,
      canonicalKey: args.canonicalKey,
      promptHash: args.promptHash,
    });
    const doc = omitUndefined({
      demoUserId,
      provider: "ashby" as const,
      scopeKind,
      scopeValue,
      canonicalKey: args.canonicalKey,
      promptHash: args.promptHash,
      answerValue: args.answerValue,
      answerKind: args.answerKind,
      source: args.source ?? "user_supplied",
      approved: true,
      createdAt: now,
      updatedAt: now,
    });
    if (existing) {
      await ctx.db.patch(existing._id, omitUndefined({
        answerValue: args.answerValue,
        answerKind: args.answerKind,
        source: args.source ?? existing.source,
        approved: true,
        updatedAt: now,
      }));
      return { id: existing._id, updatedAt: now };
    }
    const id = await ctx.db.insert("ashbyApprovedAnswers", doc);
    return { id, updatedAt: now };
  },
});

export const approveAshbyPendingReview = mutation({
  args: {
    itemId: v.id("ashbyPendingReviews"),
    demoUserId: v.optional(v.string()),
    answerValue: v.string(),
    canonicalKey: v.optional(v.string()),
    answerKind: v.optional(v.union(v.literal("text"), v.literal("choice"), v.literal("file"))),
  },
  returns: v.object({ approvedAnswerId: v.id("ashbyApprovedAnswers"), updatedAt: v.string() }),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.demoUserId !== demoUserId) {
      throw new Error("pending_review_not_found");
    }
    const now = new Date().toISOString();
    const canonicalKey = args.canonicalKey ?? item.canonicalKeyCandidate;
    if (!canonicalKey) {
      throw new Error("canonical_key_required");
    }
    const scopeKind = item.organizationSlug ? "organization" as const : "global" as const;
    const scopeValue = item.organizationSlug ?? "__global__";
    const existing = await findApprovedAnswer(ctx, {
      demoUserId,
      scopeKind,
      scopeValue,
      canonicalKey,
      promptHash: item.promptHash,
    });
    const answerKind = args.answerKind ?? answerKindFromControlKind(item.controlKind);
    let approvedAnswerId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        answerValue: args.answerValue,
        answerKind,
        source: "pending_review_approval",
        approved: true,
        updatedAt: now,
      });
      approvedAnswerId = existing._id;
    } else {
      approvedAnswerId = await ctx.db.insert("ashbyApprovedAnswers", omitUndefined({
        demoUserId,
        provider: "ashby" as const,
        scopeKind,
        scopeValue,
        canonicalKey,
        promptHash: item.promptHash,
        answerValue: args.answerValue,
        answerKind,
        source: "pending_review_approval",
        approved: true,
        createdAt: now,
        updatedAt: now,
      }));
    }
    await ctx.db.patch(args.itemId, {
      status: "approved",
      answerCandidate: args.answerValue,
      canonicalKeyCandidate: canonicalKey,
      updatedAt: now,
    });
    return { approvedAnswerId, updatedAt: now };
  },
});

export const createAshbyFormFillRun = internalMutation({
  args: {
    demoUserId: v.optional(v.string()),
    jobId: v.optional(v.id("ingestedJobs")),
    targetUrl: v.string(),
    organizationSlug: v.optional(v.string()),
    profileIdentity: v.any(),
  },
  returns: v.id("ashbyFormFillRuns"),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const now = new Date().toISOString();
    return await ctx.db.insert("ashbyFormFillRuns", omitUndefined({
      demoUserId,
      jobId: args.jobId,
      targetUrl: args.targetUrl,
      organizationSlug: args.organizationSlug,
      status: "running",
      submitAttempted: false,
      submitCompleted: false,
      profileIdentity: args.profileIdentity,
      startedAt: now,
      updatedAt: now,
    }));
  },
});

export const finalizeAshbyFormFillRun = internalMutation({
  args: {
    runId: v.id("ashbyFormFillRuns"),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;

    const now = new Date().toISOString();
    const result = args.result;
    const failed = Boolean(args.error);
    await ctx.db.patch(args.runId, omitUndefined({
      status: failed ? "failed" : "completed",
      finalUrl: result?.finalUrl,
      organizationSlug: result?.organizationSlug ?? run.organizationSlug,
      outcome: result?.outcome,
      submitAttempted: Boolean(result?.submitAttempted),
      submitCompleted: Boolean(result?.submitCompleted),
      runGrade: result?.runGrade,
      evidence: result ? compactAshbyFillEvidence(result) : undefined,
      error: args.error,
      completedAt: now,
      updatedAt: now,
    }));

    if (Array.isArray(result?.plan?.pending_review)) {
      for (const item of result.plan.pending_review) {
        await ctx.db.insert("ashbyPendingReviews", omitUndefined({
          demoUserId: run.demoUserId,
          runId: args.runId,
          organizationSlug: result.organizationSlug,
          promptHash: String(item.prompt_hash ?? ""),
          questionText: String(item.question_text ?? ""),
          normalizedPrompt: String(item.normalized_prompt ?? ""),
          controlKind: String(item.control_kind ?? ""),
          widgetFamily: String(item.widget_family ?? ""),
          canonicalKeyCandidate:
            typeof item.canonical_key_candidate === "string"
              ? item.canonical_key_candidate
              : undefined,
          answerCandidate:
            typeof item.answer_candidate === "string"
              ? item.answer_candidate
              : undefined,
          reason: String(item.reason ?? "pending review"),
          payload: item,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        }));
      }
    }

    if (result?.targetUrl && result?.organizationSlug && result?.outcome) {
      const existing = await ctx.db
        .query("ashbyTargetHistory")
        .withIndex("by_target", (q) => q.eq("demoUserId", run.demoUserId))
        .filter((q) => q.eq(q.field("provider"), "ashby"))
        .filter((q) => q.eq(q.field("targetUrl"), result.targetUrl))
        .unique();
      const history = omitUndefined({
        demoUserId: run.demoUserId,
        provider: "ashby" as const,
        organizationSlug: result.organizationSlug,
        targetUrl: result.targetUrl,
        lastStatus: targetHistoryStatusForOutcome(result.outcome),
        spamFlagged: result.outcome === "rejected_spam",
        lastRunId: args.runId,
        lastRunAt: now,
        artifactSummary: {
          finalUrl: result.finalUrl,
          screenshots: result.screenshots,
          runGrade: result.runGrade,
        },
      });
      if (existing) {
        await ctx.db.patch(existing._id, history);
      } else {
        await ctx.db.insert("ashbyTargetHistory", history);
      }
    }

    await ctx.db.insert("pipelineLogs", omitUndefined({
      demoUserId: run.demoUserId,
      stage: "ashby-fill",
      level: failed
        ? "error"
        : result?.outcome === "confirmed"
          ? "success"
          : "warning",
      message: failed
        ? "Ashby form fill failed."
        : `Ashby form fill completed with outcome ${result?.outcome ?? "unknown"}.`,
      payload: {
        runId: args.runId,
        targetUrl: run.targetUrl,
        outcome: result?.outcome,
        submitAttempted: result?.submitAttempted,
        submitCompleted: result?.submitCompleted,
        error: args.error,
      },
      createdAt: now,
    }));

    return null;
  },
});

export const upsertAshbySources = internalMutation({
  args: { sources: v.array(v.any()) },
  returns: v.object({ upserted: v.number() }),
  handler: async (ctx, args) => {
    let upserted = 0;
    const now = new Date().toISOString();

    for (const source of args.sources) {
      const slug = String(source.slug ?? "").trim();
      const company = String(source.company ?? "").trim();
      if (!slug || !company) continue;

      const existing = await ctx.db
        .query("ashbySources")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();

      const doc = {
        company,
        slug,
        careersUrl: `https://jobs.ashbyhq.com/${slug}`,
        enabled: source.enabled !== false,
        notes:
          typeof source.notes === "string" && source.notes.trim()
            ? source.notes.trim()
            : undefined,
        seededFrom: String(source.seededFrom ?? "career-ops"),
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, omitUndefined(doc));
      } else {
        await ctx.db.insert("ashbySources", omitUndefined(doc));
      }
      upserted++;
    }

    return { upserted };
  },
});

export const listEnabledSourcesForAction = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const sources = await ctx.db
      .query("ashbySources")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    const sorted = sources.sort((a, b) => a.company.localeCompare(b.company));
    return typeof args.limit === "number" ? sorted.slice(0, args.limit) : sorted;
  },
});

export const upsertAtsSources = internalMutation({
  args: { sources: v.array(v.any()) },
  returns: v.object({ upserted: v.number() }),
  handler: async (ctx, args) => {
    let upserted = 0;
    const now = new Date().toISOString();

    for (const source of args.sources) {
      const provider = String(source.provider ?? "").trim();
      const slug = String(source.slug ?? "").trim();
      const company = String(source.company ?? "").trim();
      if (!["greenhouse", "lever", "workday", "workable"].includes(provider) || !slug || !company) {
        continue;
      }

      const existing = await ctx.db
        .query("atsSources")
        .withIndex("by_provider_slug", (q) =>
          q.eq("provider", provider)
        )
        .filter((q) => q.eq(q.field("slug"), slug))
        .unique();

      const doc = {
        provider,
        company,
        slug,
        careersUrl:
          typeof source.careersUrl === "string" && source.careersUrl.trim()
            ? source.careersUrl.trim()
            : undefined,
        enabled: source.enabled !== false,
        config: source.config,
        seededFrom:
          typeof source.seededFrom === "string" && source.seededFrom.trim()
            ? source.seededFrom.trim()
            : undefined,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, omitUndefined(doc));
      } else {
        await ctx.db.insert("atsSources", omitUndefined(doc));
      }
      upserted++;
    }

    return { upserted };
  },
});

export const listEnabledAtsSourcesForAction = internalQuery({
  args: {
    provider: v.union(
      v.literal("greenhouse"),
      v.literal("lever"),
      v.literal("workday"),
      v.literal("workable")
    ),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const sources = await ctx.db
      .query("atsSources")
      .withIndex("by_provider_enabled", (q) =>
        q.eq("provider", args.provider)
      )
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect();
    const sorted = sources.sort((a, b) => a.company.localeCompare(b.company));
    return typeof args.limit === "number" ? sorted.slice(0, args.limit) : sorted;
  },
});

export const createIngestionRun = internalMutation({
  args: {
    demoUserId: v.optional(v.string()),
    provider: v.optional(
      v.union(
        v.literal("ashby"),
        v.literal("greenhouse"),
        v.literal("lever"),
        v.literal("workday"),
        v.literal("workable")
      )
    ),
    sourceCount: v.number(),
  },
  returns: v.id("ingestionRuns"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("ingestionRuns", {
      demoUserId: args.demoUserId ?? DEMO_USER_ID,
      provider: args.provider,
      status: "fetching",
      startedAt: new Date().toISOString(),
      sourceCount: args.sourceCount,
      fetchedCount: 0,
      rawJobCount: 0,
      filteredCount: 0,
      survivorCount: 0,
      llmScoredCount: 0,
      recommendedCount: 0,
      errorCount: 0,
      errors: [],
    });
  },
});

export const storeFetchedJobs = internalMutation({
  args: {
    runId: v.id("ingestionRuns"),
    demoUserId: v.optional(v.string()),
    sourceCount: v.number(),
    fetchedCount: v.number(),
    jobs: v.array(v.any()),
    errors: v.array(v.object({ source: v.string(), message: v.string() })),
  },
  returns: v.object({ rawJobCount: v.number(), errorCount: v.number() }),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const now = new Date().toISOString();

    for (const job of args.jobs) {
      const jobId = await ctx.db.insert("ingestedJobs", omitUndefined({
        runId: args.runId,
        sourceId: job.sourceId,
        demoUserId,
        company: job.company,
        sourceSlug: job.sourceSlug,
        title: job.title,
        normalizedTitle: job.normalizedTitle,
        location: job.location,
        isRemote: job.isRemote,
        workplaceType: job.workplaceType,
        employmentType: job.employmentType,
        department: job.department,
        team: job.team,
        descriptionPlain: job.descriptionPlain,
        compensationSummary: job.compensationSummary,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        currency: job.currency,
        jobUrl: job.jobUrl,
        applyUrl: job.applyUrl,
        publishedAt: job.publishedAt,
        dedupeKey: job.dedupeKey,
        raw: job.raw,
        createdAt: now,
      }));
      if (job.descriptionPlain) {
        await ctx.db.insert("jobPipelineArtifacts", {
          demoUserId,
          runId: args.runId,
          jobId,
          kind: "ingested_description",
          title: "Scraped job description",
          content: job.descriptionPlain,
          payload: {
            sourceSlug: job.sourceSlug,
            jobUrl: job.jobUrl,
            company: job.company,
            title: job.title,
          },
          createdAt: now,
        });
      }
    }

    await ctx.db.patch(args.runId, {
      status: "fetched",
      sourceCount: args.sourceCount,
      fetchedCount: args.fetchedCount,
      rawJobCount: args.jobs.length,
      errorCount: args.errors.length,
      errors: args.errors,
    });

    return { rawJobCount: args.jobs.length, errorCount: args.errors.length };
  },
});

export const getRunForRanking = internalQuery({
  args: {
    runId: v.id("ingestionRuns"),
    demoUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const run = await ctx.db.get(args.runId);

    let rawProfile: unknown = null;
    let repoSummaries: Array<{ repoFullName: string; summary: unknown }> = [];
    let profileSource: "userProfiles" | "demoProfiles" | null = null;

    if (args.userId) {
      const userId = args.userId;
      const userProfileRow = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (userProfileRow?.profile) {
        rawProfile = userProfileRow.profile;
        profileSource = "userProfiles";
        const repoRows = await ctx.db
          .query("repoSummaries")
          .withIndex("by_user_repo", (q) => q.eq("userId", userId))
          .take(50);
        repoSummaries = repoRows.map((row) => ({
          repoFullName: row.repoFullName,
          summary: row.summary,
        }));
      }
    }

    if (!rawProfile) {
      const demoRow = await ctx.db
        .query("demoProfiles")
        .withIndex("by_demo_user", (q) => q.eq("demoUserId", demoUserId))
        .unique();
      rawProfile = demoRow?.profile ?? null;
      if (rawProfile) profileSource = "demoProfiles";
    }

    const jobs = await ctx.db
      .query("ingestedJobs")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
    return {
      run,
      profile: rawProfile ?? {},
      repoSummaries,
      profileSource,
      jobs,
    };
  },
});

export const getCompletedTailoredApplicationForAction = internalQuery({
  args: {
    demoUserId: v.optional(v.string()),
    jobId: v.id("ingestedJobs"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    return await ctx.db
      .query("tailoredApplications")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .filter((q) =>
        q.and(
          q.eq(q.field("demoUserId"), demoUserId),
          q.eq(q.field("status"), "completed"),
          q.eq(q.field("pdfReady"), true)
        )
      )
      .first();
  },
});

export const markRunRanking = internalMutation({
  args: { runId: v.id("ingestionRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, { status: "ranking" });
    return null;
  },
});

export const writeRankingResults = internalMutation({
  args: {
    runId: v.id("ingestionRuns"),
    demoUserId: v.optional(v.string()),
    decisions: v.array(v.any()),
    scores: v.array(v.any()),
    recommendations: v.array(v.any()),
    model: v.optional(v.string()),
    scoringMode: v.string(),
  },
  returns: v.object({
    filteredCount: v.number(),
    survivorCount: v.number(),
    llmScoredCount: v.number(),
    recommendedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    await deleteByRun(ctx, "jobFilterDecisions", args.runId);
    await deleteByRun(ctx, "jobScores", args.runId);
    await deleteByRun(ctx, "jobRecommendations", args.runId);

    const now = new Date().toISOString();
    for (const decision of args.decisions) {
      await ctx.db.insert(
        "jobFilterDecisions",
        omitUndefined({
          runId: args.runId,
          jobId: decision.jobId,
          status: decision.status,
          reasons: decision.reasons,
          softSignals: decision.softSignals,
          ruleScore: decision.ruleScore,
          createdAt: now,
        })
      );
    }

    for (const score of args.scores) {
      await ctx.db.insert("jobScores", omitUndefined({
        runId: args.runId,
        jobId: score.jobId,
        bm25Score: score.bm25Score,
        bm25Normalized: score.bm25Normalized,
        ruleScore: score.ruleScore,
        llmScore: score.llmScore,
        totalScore: score.totalScore,
        scoringMode: score.scoringMode,
        rationale: score.rationale,
        strengths: score.strengths,
        risks: score.risks,
        createdAt: now,
      }));
      await ctx.db.insert("jobPipelineArtifacts", omitUndefined({
        demoUserId,
        runId: args.runId,
        jobId: score.jobId,
        kind: "ranking_score",
        title: "Ranking score",
        content: score.rationale,
        payload: {
          bm25Score: score.bm25Score,
          bm25Normalized: score.bm25Normalized,
          ruleScore: score.ruleScore,
          llmScore: score.llmScore,
          totalScore: score.totalScore,
          scoringMode: score.scoringMode,
          strengths: score.strengths,
          risks: score.risks,
        },
        createdAt: now,
      }));
    }

    for (const recommendation of args.recommendations) {
      await ctx.db.insert("jobRecommendations", omitUndefined({
        demoUserId,
        runId: args.runId,
        jobId: recommendation.jobId,
        rank: recommendation.rank,
        score: recommendation.score,
        llmScore: recommendation.llmScore,
        company: recommendation.company,
        title: recommendation.title,
        location: recommendation.location,
        jobUrl: recommendation.jobUrl,
        compensationSummary: recommendation.compensationSummary,
        rationale: recommendation.rationale,
        strengths: recommendation.strengths,
        risks: recommendation.risks,
        createdAt: now,
      }));
    }

    const filteredCount = args.decisions.filter(
      (decision) => decision.status === "rejected"
    ).length;
    const survivorCount = args.decisions.length - filteredCount;
    const llmScoredCount = args.scores.filter(
      (score) => score.scoringMode === "llm"
    ).length;

    await ctx.db.patch(args.runId, omitUndefined({
      status: "completed",
      completedAt: now,
      filteredCount,
      survivorCount,
      llmScoredCount,
      recommendedCount: args.recommendations.length,
      model: args.model,
      scoringMode: args.scoringMode,
    }));

    return {
      filteredCount,
      survivorCount,
      llmScoredCount,
      recommendedCount: args.recommendations.length,
    };
  },
});

export const upsertTailoredApplication = mutation({
  args: {
    demoUserId: v.optional(v.string()),
    jobId: v.id("ingestedJobs"),
    status: v.union(
      v.literal("tailoring"),
      v.literal("completed"),
      v.literal("failed")
    ),
    job: v.any(),
    research: v.optional(v.any()),
    tailoredResume: v.optional(v.any()),
    jsonResume: v.optional(v.any()),
    templateId: v.optional(v.string()),
    consolidatorVersion: v.optional(v.string()),
    pipelineVersion: v.optional(v.string()),
    tailoringScore: v.optional(v.number()),
    keywordCoverage: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    pdfReady: v.optional(v.boolean()),
    pdfFilename: v.optional(v.string()),
    pdfByteLength: v.optional(v.number()),
    pdfBase64: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const sourceJob = await ctx.db.get(args.jobId);
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("tailoredApplications")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("demoUserId"), demoUserId))
      .first();

    const doc = omitUndefined({
      demoUserId,
      jobId: args.jobId,
      runId: sourceJob?.runId,
      status: args.status,
      job: args.job,
      research: args.research,
      tailoredResume: args.tailoredResume,
      jsonResume: args.jsonResume,
      templateId: args.templateId,
      consolidatorVersion: args.consolidatorVersion,
      pipelineVersion: args.pipelineVersion,
      tailoringScore: args.tailoringScore,
      keywordCoverage: args.keywordCoverage,
      durationMs: args.durationMs,
      pdfReady: args.pdfReady ?? false,
      pdfFilename: args.pdfFilename,
      pdfByteLength: args.pdfByteLength,
      pdfBase64: args.pdfBase64,
      error: args.error,
      updatedAt: now,
    });

    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("tailoredApplications", {
        ...doc,
        createdAt: now,
      });
    }

    await deleteArtifactsByJobKind(ctx, args.jobId, [
      "research_snapshot",
      "tailored_resume",
      "cover_letter",
      "pdf_ready",
      "pdf_file",
    ]);

    if (args.research) {
      await ctx.db.insert("jobPipelineArtifacts", omitUndefined({
        demoUserId,
        runId: sourceJob?.runId,
        jobId: args.jobId,
        kind: "research_snapshot",
        title: "Research snapshot",
        content: args.research.jdSummary,
        payload: args.research,
        createdAt: now,
      }));
    }
    if (args.tailoredResume) {
      await ctx.db.insert("jobPipelineArtifacts", omitUndefined({
        demoUserId,
        runId: sourceJob?.runId,
        jobId: args.jobId,
        kind: "tailored_resume",
        title: "Tailored resume",
        content: args.tailoredResume.summary,
        payload: args.tailoredResume,
        createdAt: now,
      }));
      if (args.tailoredResume.coverLetterBlurb) {
        await ctx.db.insert("jobPipelineArtifacts", omitUndefined({
          demoUserId,
          runId: sourceJob?.runId,
          jobId: args.jobId,
          kind: "cover_letter",
          title: "Cover letter",
          content: args.tailoredResume.coverLetterBlurb,
          payload: { text: args.tailoredResume.coverLetterBlurb, source: "tailor" },
          createdAt: now,
        }));
      }
    }
    if (args.pdfReady) {
      await ctx.db.insert("jobPipelineArtifacts", omitUndefined({
        demoUserId,
        runId: sourceJob?.runId,
        jobId: args.jobId,
        kind: "pdf_ready",
        title: "PDF ready",
        content: args.pdfFilename,
        payload: {
          filename: args.pdfFilename,
          byteLength: args.pdfByteLength,
        },
        createdAt: now,
      }));
      if (args.pdfBase64) {
        await ctx.db.insert("jobPipelineArtifacts", omitUndefined({
          demoUserId,
          runId: sourceJob?.runId,
          jobId: args.jobId,
          kind: "pdf_file",
          title: args.pdfFilename ?? "Tailored resume PDF",
          content: args.pdfFilename,
          payload: {
            filename: args.pdfFilename,
            byteLength: args.pdfByteLength,
            base64: args.pdfBase64,
          },
          createdAt: now,
        }));
      }
    }

    await ctx.db.insert("pipelineLogs", omitUndefined({
      demoUserId,
      runId: sourceJob?.runId,
      stage: "tailoring",
      level: args.status === "failed" ? "error" : args.status === "completed" ? "success" : "info",
      message: tailoringLogMessage(args.status, sourceJob?.company, sourceJob?.title),
      payload: {
        jobId: args.jobId,
        pdfReady: args.pdfReady ?? false,
        tailoringScore: args.tailoringScore,
        keywordCoverage: args.keywordCoverage,
        error: args.error,
      },
      createdAt: now,
    }));

    return null;
  },
});

export const createCustomJob = mutation({
  args: {
    demoUserId: v.optional(v.string()),
    company: v.string(),
    role: v.string(),
    location: v.optional(v.string()),
    jobUrl: v.optional(v.string()),
    descriptionPlain: v.string(),
  },
  returns: v.object({ runId: v.id("ingestionRuns"), jobId: v.id("ingestedJobs") }),
  handler: async (ctx, args) => {
    const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
    const now = new Date().toISOString();
    const company = args.company.trim();
    const role = args.role.trim();
    const descriptionPlain = args.descriptionPlain.trim();
    const location = args.location?.trim() || undefined;
    const jobUrl = args.jobUrl?.trim() || `custom-jd:${now}:${company}:${role}`;

    const runId = await ctx.db.insert("ingestionRuns", {
      demoUserId,
      status: "completed",
      startedAt: now,
      completedAt: now,
      sourceCount: 1,
      fetchedCount: 1,
      rawJobCount: 1,
      filteredCount: 0,
      survivorCount: 1,
      llmScoredCount: 0,
      recommendedCount: 1,
      errorCount: 0,
      errors: [],
      scoringMode: "custom_jd",
    });

    const jobId = await ctx.db.insert("ingestedJobs", omitUndefined({
      runId,
      demoUserId,
      company,
      sourceSlug: "custom-jd",
      title: role,
      normalizedTitle: role.toLowerCase(),
      location,
      descriptionPlain,
      jobUrl,
      dedupeKey: `custom-jd:${company.toLowerCase()}:${role.toLowerCase()}:${descriptionPlain.slice(0, 80)}`,
      raw: { provider: "Custom JD", company, role, location, jobUrl, descriptionPlain },
      createdAt: now,
    }));

    await ctx.db.insert("jobFilterDecisions", {
      runId,
      jobId,
      status: "kept",
      reasons: ["User supplied custom job description"],
      ruleScore: 100,
      createdAt: now,
    });
    await ctx.db.insert("jobScores", {
      runId,
      jobId,
      bm25Score: 1,
      bm25Normalized: 100,
      ruleScore: 100,
      totalScore: 100,
      scoringMode: "custom_jd",
      rationale: "Custom JD supplied by the user and routed directly into tailoring.",
      strengths: ["User supplied target role", "Complete pasted job description"],
      risks: [],
      createdAt: now,
    });
    await ctx.db.insert("jobRecommendations", omitUndefined({
      demoUserId,
      runId,
      jobId,
      rank: 1,
      score: 100,
      company,
      title: role,
      location,
      jobUrl,
      rationale: "Custom JD supplied by the user.",
      strengths: ["Custom JD"],
      risks: [],
      createdAt: now,
    }));
    await ctx.db.insert("jobPipelineArtifacts", {
      demoUserId,
      runId,
      jobId,
      kind: "ingested_description",
      title: "Custom JD",
      content: descriptionPlain,
      payload: { provider: "Custom JD", company, role, location, jobUrl },
      createdAt: now,
    });
    await ctx.db.insert("jobPipelineArtifacts", {
      demoUserId,
      runId,
      jobId,
      kind: "ranking_score",
      title: "Custom JD routing",
      content: "User supplied custom job description routed into recommendation slot 1.",
      payload: { totalScore: 100, scoringMode: "custom_jd" },
      createdAt: now,
    });
    await ctx.db.insert("pipelineLogs", {
      demoUserId,
      runId,
      stage: "custom_jd",
      level: "success",
      message: `Stored custom JD for ${company} - ${role}`,
      payload: { company, role, location, jobUrl, descriptionLength: descriptionPlain.length },
      createdAt: now,
    });
    await ctx.db.insert("pipelineLogs", {
      demoUserId,
      runId,
      stage: "recommendations",
      level: "success",
      message: "Custom JD recommendation ready for tailoring",
      payload: { jobId, rank: 1, score: 100 },
      createdAt: now,
    });

    return { runId, jobId };
  },
});

export const markRunFailed = internalMutation({
  args: {
    runId: v.id("ingestionRuns"),
    source: v.optional(v.string()),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      errorCount: 1,
      errors: [{ source: args.source ?? "run", message: args.message }],
    });
    return null;
  },
});

type RunProvider = "ashby" | "greenhouse" | "lever" | "workday" | "workable";

const DASHBOARD_STALE_RUN_MS = 20 * 60 * 1000;

async function preferredDashboardRun(ctx: any, demoUserId: string) {
  const runs = await ctx.db
    .query("ingestionRuns")
    .withIndex("by_demo_user_started", (q: any) =>
      q.eq("demoUserId", demoUserId)
    )
    .order("desc")
    .take(25);

  if (runs.length === 0) return null;

  const classified = [];
  for (const run of runs) {
    classified.push({
      run,
      provider: await inferRunProvider(ctx, run),
    });
  }

  const latest = classified[0];
  const latestCompletedAshby = classified.find((item) =>
    item.provider === "ashby" && item.run.status === "completed"
  );
  const latestAshby = classified.find((item) => item.provider === "ashby");
  const selected = latestCompletedAshby ?? latestAshby ?? latest;

  return {
    run: selected.run,
    provider: selected.provider,
    suppressedLatestRun: selected.run._id === latest.run._id
      ? undefined
      : summarizeSuppressedRun(latest.run, latest.provider),
  };
}

async function inferRunProvider(ctx: any, run: any): Promise<RunProvider | undefined> {
  if (isRunProvider(run.provider)) return run.provider;

  const logs = await ctx.db
    .query("pipelineLogs")
    .withIndex("by_run", (q: any) => q.eq("runId", run._id))
    .collect();

  for (const log of logs) {
    const provider = log?.payload?.provider;
    if (isRunProvider(provider)) return provider;
    const message = String(log?.message ?? "").toLowerCase();
    if (message.includes("started ashby ingestion")) return "ashby";
    for (const candidate of ["greenhouse", "lever", "workday", "workable"] as const) {
      if (message.includes(`started ${candidate} ingestion`)) return candidate;
    }
  }

  const job = await ctx.db
    .query("ingestedJobs")
    .withIndex("by_run", (q: any) => q.eq("runId", run._id))
    .first();
  const rawProvider = job?.raw?.provider;
  if (isRunProvider(rawProvider)) return rawProvider;
  if (job) return "ashby";
  return undefined;
}

function isRunProvider(value: unknown): value is RunProvider {
  return typeof value === "string" &&
    ["ashby", "greenhouse", "lever", "workday", "workable"].includes(value);
}

function decorateRunForDashboard(run: any, provider: RunProvider | undefined) {
  if (!isStaleRun(run)) return { ...run, provider };
  return {
    ...run,
    provider,
    originalStatus: run.status,
    status: "failed",
    stale: true,
    staleReason: `Run remained ${run.status} for more than ${Math.round(DASHBOARD_STALE_RUN_MS / 60000)} minutes.`,
    errorCount: Math.max(run.errorCount ?? 0, 1),
  };
}

function summarizeSuppressedRun(run: any, provider: RunProvider | undefined) {
  return {
    _id: run._id,
    provider,
    status: run.status,
    startedAt: run.startedAt,
    stale: isStaleRun(run),
  };
}

function isStaleRun(run: any) {
  if (!["fetching", "fetched", "ranking"].includes(run.status)) return false;
  const startedMs = Date.parse(run.startedAt);
  return Number.isFinite(startedMs) && Date.now() - startedMs > DASHBOARD_STALE_RUN_MS;
}

async function deleteByRun(ctx: any, table: string, runId: string) {
  const docs = await ctx.db
    .query(table)
    .withIndex("by_run", (q: any) => q.eq("runId", runId))
    .collect();
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
}

async function deleteArtifactsByJobKind(ctx: any, jobId: string, kinds: string[]) {
  const docs = await ctx.db
    .query("jobPipelineArtifacts")
    .withIndex("by_job", (q: any) => q.eq("jobId", jobId))
    .collect();
  for (const doc of docs) {
    if (kinds.includes(doc.kind)) {
      await ctx.db.delete(doc._id);
    }
  }
}

function omitUndefined<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null)
  ) as T;
}

function compactAshbyFillEvidence(result: any) {
  return omitUndefined({
    submissionEvidence: result.submissionEvidence,
    fillOperations: Array.isArray(result.fillOperations)
      ? result.fillOperations
      : [],
    blockers: Array.isArray(result.blockers) ? result.blockers : [],
    needsUserAnswers: Array.isArray(result.needsUserAnswers)
      ? result.needsUserAnswers
      : [],
    mappingDecisions: Array.isArray(result.plan?.mapping_decisions)
      ? result.plan.mapping_decisions
      : [],
    resolvedAnswers: Array.isArray(result.plan?.resolved_answers)
      ? result.plan.resolved_answers
      : [],
    pendingReview: Array.isArray(result.plan?.pending_review)
      ? result.plan.pending_review
      : [],
    screenshots: result.screenshots,
    notes: result.notes,
    errors: result.errors,
    finalSnapshot: result.finalSnapshot
      ? {
          url: result.finalSnapshot.url,
          validation_errors: result.finalSnapshot.validation_errors,
          confirmation_texts: result.finalSnapshot.confirmation_texts,
          submit_controls: result.finalSnapshot.submit_controls,
          unexpected_verification_gate:
            result.finalSnapshot.unexpected_verification_gate,
          question_count: Array.isArray(result.finalSnapshot.questions)
            ? result.finalSnapshot.questions.length
            : 0,
        }
      : undefined,
  });
}

async function findApprovedAnswer(
  ctx: any,
  args: {
    demoUserId: string;
    scopeKind: "global" | "organization";
    scopeValue: string;
    canonicalKey: string;
    promptHash?: string;
  }
) {
  const docs = await ctx.db
    .query("ashbyApprovedAnswers")
    .withIndex("by_demo_user_key", (q: any) =>
      q.eq("demoUserId", args.demoUserId)
        .eq("provider", "ashby")
        .eq("canonicalKey", args.canonicalKey)
    )
    .collect();
  return docs.find((doc: any) =>
    doc.scopeKind === args.scopeKind &&
    doc.scopeValue === args.scopeValue &&
    ((doc.promptHash ?? null) === (args.promptHash ?? null))
  ) ?? null;
}

async function loadAshbyFormFillContext(
  ctx: any,
  args: { demoUserId?: string; organizationSlug?: string }
) {
  const demoUserId = await scopedDemoUserId(ctx, args.demoUserId);
  const organizationSlug = args.organizationSlug?.trim().toLowerCase() ?? null;
  const profile = await ctx.db
    .query("demoProfiles")
    .withIndex("by_demo_user", (q: any) => q.eq("demoUserId", demoUserId))
    .unique();

  const scopes = [
    { scopeKind: "global" as const, scopeValue: "__global__" },
    ...(organizationSlug
      ? [{ scopeKind: "organization" as const, scopeValue: organizationSlug }]
      : []),
  ];

  const aliases = [];
  const approvedAnswers = [];
  for (const scope of scopes) {
    const scopeAliases = await ctx.db
      .query("ashbyPromptAliases")
      .withIndex("by_scope", (q: any) => q.eq("provider", "ashby"))
      .filter((q: any) => q.eq(q.field("scopeKind"), scope.scopeKind))
      .filter((q: any) => q.eq(q.field("scopeValue"), scope.scopeValue))
      .filter((q: any) => q.eq(q.field("approved"), true))
      .collect();
    aliases.push(
      ...scopeAliases.map((alias: any) => ({
        provider: "ashby",
        scopeKind: alias.scopeKind,
        scopeValue: alias.scopeValue,
        promptHash: alias.promptHash,
        normalizedPrompt: alias.normalizedPrompt,
        controlKind: alias.controlKind,
        optionSignature: alias.optionSignature ?? null,
        canonicalKey: alias.canonicalKey,
        confidence: alias.confidence,
        source: alias.source,
        approved: alias.approved,
      }))
    );

    const answers = await ctx.db
      .query("ashbyApprovedAnswers")
      .withIndex("by_demo_user_scope", (q: any) => q.eq("demoUserId", demoUserId))
      .filter((q: any) => q.eq(q.field("provider"), "ashby"))
      .filter((q: any) => q.eq(q.field("scopeKind"), scope.scopeKind))
      .filter((q: any) => q.eq(q.field("scopeValue"), scope.scopeValue))
      .filter((q: any) => q.eq(q.field("approved"), true))
      .collect();
    approvedAnswers.push(
      ...answers.map((answer: any) => ({
        provider: "ashby",
        scopeKind: answer.scopeKind,
        scopeValue: answer.scopeValue,
        canonicalKey: answer.canonicalKey,
        promptHash: answer.promptHash ?? null,
        answerValue: answer.answerValue,
        answerKind: answer.answerKind,
        source: answer.source,
        approved: answer.approved,
      }))
    );
  }

  return {
    demoUserId,
    profile: profile?.profile ?? null,
    aliases,
    approvedAnswers,
  };
}

function profileIdentityForAshbyRun(profile: unknown) {
  const record = profile && typeof profile === "object" ? profile as Record<string, any> : {};
  const links = record.links && typeof record.links === "object" ? record.links as Record<string, any> : {};
  const files = record.files && typeof record.files === "object" ? record.files as Record<string, any> : {};
  return {
    name: typeof record.name === "string" ? record.name : null,
    email: typeof record.email === "string" ? record.email : null,
    location: typeof record.location === "string" ? record.location : null,
    github: typeof links.github === "string" ? links.github : null,
    linkedin: typeof links.linkedin === "string" ? links.linkedin : null,
    hasResumePath: typeof record.resumePath === "string" || typeof files.resumePath === "string",
  };
}

function answerKindFromControlKind(controlKind: string): "text" | "choice" | "file" {
  if (controlKind === "file") return "file";
  if (["radio", "checkbox", "select", "combobox"].includes(controlKind)) return "choice";
  return "text";
}

function targetHistoryStatusForOutcome(outcome: string) {
  if (outcome === "confirmed") return "submitted";
  if (outcome === "rejected_spam") return "spam_flagged";
  if (outcome === "rejected_validation") return "rejected";
  if (outcome === "blocked_before_submit" || outcome === "unsupported_gate") {
    return "blocked";
  }
  return "ambiguous";
}

function tailoringLogMessage(status: string, company?: string, title?: string) {
  const jobLabel = [company, title].filter(Boolean).join(" - ") || "selected job";
  if (status === "completed") return `Tailored resume ready for ${jobLabel}`;
  if (status === "failed") return `Tailoring failed for ${jobLabel}`;
  return `Started tailoring ${jobLabel}`;
}
