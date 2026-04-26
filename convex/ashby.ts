/* eslint-disable @typescript-eslint/no-explicit-any */

import {
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

export const upsertDemoProfileSnapshot = mutation({
  args: {
    demoUserId: v.optional(v.string()),
    profile: v.any(),
  },
  returns: v.object({ demoUserId: v.string(), updatedAt: v.string() }),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const updatedAt = new Date().toISOString();
    const existing = await ctx.db
      .query("demoProfiles")
      .withIndex("by_demo_user", (q) => q.eq("demoUserId", demoUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { profile: args.profile, updatedAt });
    } else {
      await ctx.db.insert("demoProfiles", {
        demoUserId,
        profile: args.profile,
        updatedAt,
      });
    }

    return { demoUserId, updatedAt };
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
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const run = await latestRun(ctx, demoUserId);
    if (!run) return null;

    const recommendations = await ctx.db
      .query("jobRecommendations")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const tailoredApplications = await ctx.db
      .query("tailoredApplications")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const tailoredCount = tailoredApplications.filter((application) => application.status === "completed").length;

    return {
      ...run,
      recommendations: recommendations.sort((a, b) => a.rank - b.rank),
      tailoredCount,
      hasCompletedTailoring: tailoredCount > 0,
    };
  },
});

export const currentRecommendations = query({
  args: { demoUserId: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const run = await latestRun(ctx, demoUserId);
    if (!run) return [];
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
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
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
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
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
      if (!["greenhouse", "lever", "workday"].includes(provider) || !slug || !company) {
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
      v.literal("workday")
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
    sourceCount: v.number(),
  },
  returns: v.id("ingestionRuns"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("ingestionRuns", {
      demoUserId: args.demoUserId ?? DEMO_USER_ID,
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
  args: { runId: v.id("ingestionRuns"), demoUserId: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const run = await ctx.db.get(args.runId);
    const profile = await ctx.db
      .query("demoProfiles")
      .withIndex("by_demo_user", (q) => q.eq("demoUserId", demoUserId))
      .unique();
    const jobs = await ctx.db
      .query("ingestedJobs")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
    return { run, profile: profile?.profile ?? {}, jobs };
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
      await ctx.db.insert("jobFilterDecisions", {
        runId: args.runId,
        jobId: decision.jobId,
        status: decision.status,
        reasons: decision.reasons,
        ruleScore: decision.ruleScore,
        createdAt: now,
      });
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
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
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
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
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

async function latestRun(ctx: any, demoUserId: string) {
  return await ctx.db
    .query("ingestionRuns")
    .withIndex("by_demo_user_started", (q: any) =>
      q.eq("demoUserId", demoUserId)
    )
    .order("desc")
    .first();
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

function tailoringLogMessage(status: string, company?: string, title?: string) {
  const jobLabel = [company, title].filter(Boolean).join(" - ") || "selected job";
  if (status === "completed") return `Tailored resume ready for ${jobLabel}`;
  if (status === "failed") return `Tailoring failed for ${jobLabel}`;
  return `Started tailoring ${jobLabel}`;
}
