/* eslint-disable @typescript-eslint/no-explicit-any */

"use node";

import MiniSearch, { type SearchResult } from "minisearch";
import { actionGeneric, anyApi, internalActionGeneric } from "convex/server";
import { v } from "convex/values";
import { DEMO_PROFILE, isProfileUsable } from "../lib/demo-profile";
import {
  buildProfileSearchQuery,
  evaluateHardFilters,
  normalizeScore,
  parseCompensation,
  type RankingJob,
  type RankingProfile,
} from "../lib/job-ranking";
import {
  fetchJsonWithRetry,
  extractWorkableJobs,
  normalizeGreenhouseJob,
  normalizeLeverJob,
  normalizeWorkdayJob,
  normalizeWorkableJob,
  parallelMap as parallelMapAts,
  type AtsProvider,
  type AtsSource,
  type NormalizedAtsJob,
} from "./atsIngestion";
import { textToPdf, toBase64 } from "../lib/tailor/simple-pdf";
import { researchJob } from "../lib/tailor/research";
import { computeTailoringScore } from "../lib/tailor/score";
import { tailorResume } from "../lib/tailor/tailor";
import type { Job, TailoredResume } from "../lib/tailor/types";

const action = actionGeneric;
const internalAction = internalActionGeneric;

const DEMO_USER_ID = "demo";
const CAREER_OPS_PORTALS_URL =
  "https://raw.githubusercontent.com/santifer/career-ops/main/templates/portals.example.yml";
const ASHBY_API_BASE = "https://api.ashbyhq.com/posting-api/job-board";
const GREENHOUSE_API_BASE = "https://boards-api.greenhouse.io/v1/boards";
const LEVER_API_BASES = {
  global: "https://api.lever.co/v0/postings",
  eu: "https://api.eu.lever.co/v0/postings",
};
const WORKABLE_WIDGET_API_BASE = "https://apply.workable.com/api/v1/widget/accounts";
const MAX_LLM_CANDIDATES = 40;
const MAX_RECOMMENDATIONS = 15;
const RECOMMENDATION_CUTOFF = 70;
const LEVER_PAGE_SIZE = 100;

type AshbySource = {
  _id?: string;
  company: string;
  slug: string;
  careersUrl?: string;
  enabled?: boolean;
  notes?: string;
};

type AshbyApiJob = {
  title?: string;
  location?: string;
  secondaryLocations?: Array<{ location?: string }>;
  department?: string;
  team?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  employmentType?: string;
  jobUrl?: string;
  applyUrl?: string;
  compensation?: {
    compensationTierSummary?: string;
    scrapeableCompensationSalarySummary?: string;
  };
};

type Candidate = {
  job: RankingJob & { _id: string; rawDoc: any };
  ruleScore: number;
  bm25Score: number;
  bm25Normalized: number;
  preScore: number;
};

type LlmScore = {
  jobId: string;
  score: number;
  rationale?: string;
  strengths: string[];
  risks: string[];
};

export const seedAshbySourcesFromCareerOps = action({
  args: {},
  returns: v.object({ upserted: v.number(), sourceCount: v.number() }),
  handler: async (ctx) => {
    const sources = await loadCareerOpsSources();
    const result = await ctx.runMutation(anyApi.ashby.upsertAshbySources, {
      sources,
    });
    await appendPipelineLog(ctx, {
      stage: "sources",
      level: "success",
      message: `Seeded ${result.upserted} Ashby sources from ${sources.length} candidates.`,
      payload: { upserted: result.upserted, sourceCount: sources.length },
    });
    return {
      upserted: result.upserted,
      sourceCount: sources.length,
    };
  },
});

export const seedAtsSourcesFromCareerOps = action({
  args: {
    provider: v.optional(
      v.union(
        v.literal("greenhouse"),
        v.literal("lever"),
        v.literal("workday"),
        v.literal("workable")
      )
    ),
  },
  returns: v.object({ upserted: v.number(), sourceCount: v.number() }),
  handler: async (ctx, args) => {
    const sources = await loadCareerOpsAtsSources(args.provider);
    const result = await ctx.runMutation(anyApi.ashby.upsertAtsSources, {
      sources,
    });
    await appendPipelineLog(ctx, {
      stage: "sources",
      level: "success",
      message: `Seeded ${result.upserted} ATS sources from ${sources.length} Career Ops candidates.`,
      payload: {
        provider: args.provider,
        upserted: result.upserted,
        sourceCount: sources.length,
      },
    });
    return {
      upserted: result.upserted,
      sourceCount: sources.length,
    };
  },
});

export const seedCuratedAtsSources = action({
  args: {
    provider: v.optional(
      v.union(
        v.literal("greenhouse"),
        v.literal("lever"),
        v.literal("workday"),
        v.literal("workable")
      )
    ),
  },
  returns: v.object({ upserted: v.number(), sourceCount: v.number() }),
  handler: async (ctx, args) => {
    const sources = CURATED_ATS_SOURCES.filter((source) =>
      args.provider ? source.provider === args.provider : true
    );
    const result = await ctx.runMutation(anyApi.ashby.upsertAtsSources, {
      sources,
    });
    await appendPipelineLog(ctx, {
      stage: "sources",
      level: "success",
      message: `Seeded ${result.upserted} curated ATS sources from ${sources.length} candidates.`,
      payload: {
        provider: args.provider,
        upserted: result.upserted,
        sourceCount: sources.length,
      },
    });
    return {
      upserted: result.upserted,
      sourceCount: sources.length,
    };
  },
});

export const runAshbyIngestion = action({
  args: {
    demoUserId: v.optional(v.string()),
    runId: v.optional(v.id("ingestionRuns")),
    limitSources: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    let sources = (await ctx.runQuery(anyApi.ashby.listEnabledSourcesForAction, {
      limit: args.limitSources,
    })) as AshbySource[];

    if (sources.length === 0) {
      const seeded = await loadCareerOpsSources();
      await ctx.runMutation(anyApi.ashby.upsertAshbySources, { sources: seeded });
      sources = (await ctx.runQuery(anyApi.ashby.listEnabledSourcesForAction, {
        limit: args.limitSources,
      })) as AshbySource[];
    }

    const runId = args.runId ?? await ctx.runMutation(anyApi.ashby.createIngestionRun, {
      demoUserId,
      sourceCount: sources.length,
    });
    await appendPipelineLog(ctx, {
      demoUserId,
      runId,
      stage: "ingestion",
      level: "info",
      message: `Started Ashby ingestion for ${sources.length} sources.`,
      payload: {
        sources: sources.map((source) => ({
          company: source.company,
          slug: source.slug,
        })),
      },
    });

    try {
      const errors: Array<{ source: string; message: string }> = [];
      const seenUrls = new Set<string>();
      const normalizedJobs: any[] = [];
      let fetchedCount = 0;

      await parallelMap(sources, 5, async (source) => {
        try {
          await appendPipelineLog(ctx, {
            demoUserId,
            runId,
            stage: "fetch",
            level: "info",
            message: `Fetching ${source.company} (${source.slug}).`,
            payload: { company: source.company, slug: source.slug },
          });
          const json = await fetchAshbyBoard(source.slug);
          const jobs = Array.isArray(json.jobs) ? (json.jobs as AshbyApiJob[]) : [];
          fetchedCount++;
          await appendPipelineLog(ctx, {
            demoUserId,
            runId,
            stage: "fetch",
            level: "success",
            message: `Fetched ${jobs.length} jobs from ${source.company}.`,
            payload: { company: source.company, slug: source.slug, jobCount: jobs.length },
          });

          for (const job of jobs) {
            if (job.isListed === false) continue;
            const normalized = normalizeAshbyJob(source, job, String(runId));
            if (!normalized) continue;
            if (seenUrls.has(normalized.jobUrl)) continue;
            seenUrls.add(normalized.jobUrl);
            normalizedJobs.push(normalized);
          }
        } catch (err) {
          errors.push({
            source: source.company,
            message: err instanceof Error ? err.message : String(err),
          });
          await appendPipelineLog(ctx, {
            demoUserId,
            runId,
            stage: "fetch",
            level: "error",
            message: `Failed to fetch ${source.company}.`,
            payload: {
              company: source.company,
              slug: source.slug,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      });

      const stored = await ctx.runMutation(anyApi.ashby.storeFetchedJobs, {
        runId,
        demoUserId,
        sourceCount: sources.length,
        fetchedCount,
        jobs: toConvexValue(normalizedJobs),
        errors,
      });
      await appendPipelineLog(ctx, {
        demoUserId,
        runId,
        stage: "storage",
        level: stored.errorCount > 0 ? "warning" : "success",
        message: `Stored ${stored.rawJobCount} scraped jobs with ${stored.errorCount} source errors.`,
        payload: {
          rawJobCount: stored.rawJobCount,
          errorCount: stored.errorCount,
          fetchedCount,
          sourceCount: sources.length,
        },
      });

      return {
        runId,
        sourceCount: sources.length,
        fetchedCount,
        rawJobCount: stored.rawJobCount,
        errorCount: stored.errorCount,
      };
    } catch (err) {
      await ctx.runMutation(anyApi.ashby.markRunFailed, {
        runId,
        source: "ingestion",
        message: err instanceof Error ? err.message : String(err),
      });
      await appendPipelineLog(ctx, {
        demoUserId,
        runId,
        stage: "ingestion",
        level: "error",
        message: "Ashby ingestion failed.",
        payload: { error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  },
});

export const runOnboardingPipeline = internalAction({
  args: {
    demoUserId: v.optional(v.string()),
    runId: v.id("ingestionRuns"),
    limitSources: v.optional(v.number()),
    tailorLimit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const tailorLimit = args.tailorLimit ?? 3;

    try {
      await ctx.runAction(anyApi.ashbyActions.seedAshbySourcesFromCareerOps, {});
      const ingestion = await ctx.runAction(anyApi.ashbyActions.runAshbyIngestion, {
        demoUserId,
        runId: args.runId,
        limitSources: args.limitSources ?? 3,
      });
      const ranking = await ctx.runAction(anyApi.ashbyActions.rankIngestionRun, {
        demoUserId,
        runId: args.runId,
      });
      const recommendations = await ctx.runQuery(anyApi.ashby.listRecommendationsForRun, {
        runId: args.runId,
      }) as Array<{ jobId?: string; rank?: number }>;
      const profile = await ctx.runQuery(anyApi.ashby.getDemoProfileForAction, {
        demoUserId,
      });
      const topJobs = recommendations
        .filter((recommendation) => recommendation.jobId)
        .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
        .slice(0, tailorLimit);

      if (topJobs.length === 0) {
        await appendPipelineLog(ctx, {
          demoUserId,
          runId: args.runId,
          stage: "tailoring",
          level: "warning",
          message: "No ranked jobs were available for automatic tailoring.",
          payload: { tailorLimit },
        });
        return { ingestion, ranking, tailoredCount: 0 };
      }

      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "tailoring",
        level: "info",
        message: `Starting async tailoring for top ${topJobs.length} jobs.`,
        payload: { tailorLimit, jobIds: topJobs.map((job) => job.jobId) },
      });

      let tailoredCount = 0;
      for (const recommendation of topJobs) {
        if (!recommendation.jobId) continue;
        const result = await tailorJobForOnboarding(ctx, {
          demoUserId,
          jobId: recommendation.jobId,
          profile,
        });
        if (result.ok) tailoredCount++;
      }

      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "tailoring",
        level: tailoredCount === topJobs.length ? "success" : "warning",
        message: `Finished async tailoring for ${tailoredCount}/${topJobs.length} top jobs.`,
        payload: { tailoredCount, targetCount: topJobs.length },
      });

      return { ingestion, ranking, tailoredCount };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(anyApi.ashby.markRunFailed, {
        runId: args.runId,
        source: "onboarding_pipeline",
        message,
      });
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "pipeline",
        level: "error",
        message: "Async onboarding pipeline failed.",
        payload: { error: message },
      });
      throw err;
    }
  },
});

export const runGreenhouseIngestion = action({
  args: {
    demoUserId: v.optional(v.string()),
    limitSources: v.optional(v.number()),
    sources: v.optional(v.array(v.any())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return runProviderIngestion(ctx, {
      provider: "greenhouse",
      demoUserId: args.demoUserId,
      limitSources: args.limitSources,
      sources: args.sources,
    });
  },
});

export const runLeverIngestion = action({
  args: {
    demoUserId: v.optional(v.string()),
    limitSources: v.optional(v.number()),
    sources: v.optional(v.array(v.any())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return runProviderIngestion(ctx, {
      provider: "lever",
      demoUserId: args.demoUserId,
      limitSources: args.limitSources,
      sources: args.sources,
    });
  },
});

export const runWorkdayIngestion = action({
  args: {
    demoUserId: v.optional(v.string()),
    limitSources: v.optional(v.number()),
    sources: v.optional(v.array(v.any())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return runProviderIngestion(ctx, {
      provider: "workday",
      demoUserId: args.demoUserId,
      limitSources: args.limitSources,
      sources: args.sources,
    });
  },
});

export const runWorkableIngestion = action({
  args: {
    demoUserId: v.optional(v.string()),
    limitSources: v.optional(v.number()),
    sources: v.optional(v.array(v.any())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return runProviderIngestion(ctx, {
      provider: "workable",
      demoUserId: args.demoUserId,
      limitSources: args.limitSources,
      sources: args.sources,
    });
  },
});

export const runAtsIngestion = action({
  args: {
    provider: v.union(
      v.literal("greenhouse"),
      v.literal("lever"),
      v.literal("workday"),
      v.literal("workable")
    ),
    demoUserId: v.optional(v.string()),
    limitSources: v.optional(v.number()),
    sources: v.optional(v.array(v.any())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return runProviderIngestion(ctx, {
      provider: args.provider,
      demoUserId: args.demoUserId,
      limitSources: args.limitSources,
      sources: args.sources,
    });
  },
});

export const rankIngestionRun = action({
  args: {
    runId: v.id("ingestionRuns"),
    demoUserId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    await ctx.runMutation(anyApi.ashby.markRunRanking, { runId: args.runId });
    await appendPipelineLog(ctx, {
      demoUserId,
      runId: args.runId,
      stage: "ranking",
      level: "info",
      message: "Started ranking ingested jobs.",
    });

    try {
      const payload = await ctx.runQuery(anyApi.ashby.getRunForRanking, {
        runId: args.runId,
        demoUserId,
      });
      const profile = (payload.profile ?? {}) as RankingProfile;
      const jobs = (payload.jobs ?? []) as any[];
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "ranking",
        level: "info",
        message: `Loaded ${jobs.length} ingested jobs for ranking.`,
        payload: { jobCount: jobs.length, profileKeys: Object.keys(profile).length },
      });

      const decisions: any[] = [];
      const survivors: Array<RankingJob & { _id: string; rawDoc: any }> = [];

      for (const doc of jobs) {
        const job = docToRankingJob(doc);
        const decision = evaluateHardFilters(job, profile);
        decisions.push({
          jobId: doc._id,
          status: decision.status,
          reasons: decision.reasons,
          ruleScore: decision.ruleScore,
        });
        if (decision.status === "kept") {
          survivors.push({ ...job, _id: doc._id, rawDoc: doc });
        }
      }
      const rejectedCount = decisions.filter((decision) => decision.status === "rejected").length;
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "filter",
        level: "info",
        message: `Applied hard filters: ${survivors.length} kept, ${rejectedCount} rejected.`,
        payload: { kept: survivors.length, rejected: rejectedCount },
      });

      const candidates = rankWithMiniSearch(survivors, profile, decisions);
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "ranking",
        level: "info",
        message: `BM25 ranked ${candidates.length} candidates.`,
        payload: { candidateCount: candidates.length },
      });
      const topForLlm = candidates.slice(0, MAX_LLM_CANDIDATES);
      const llm = await scoreCandidatesWithLlm(profile, topForLlm);
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "scoring",
        level: llm.mode === "heuristic_fallback" ? "warning" : "success",
        message: `Scored ${llm.scores.length} candidates using ${llm.mode}.`,
        payload: { mode: llm.mode, model: llm.model, scoredCount: llm.scores.length },
      });
      const llmById = new Map(llm.scores.map((score) => [score.jobId, score]));

      const scores = candidates.map((candidate) => {
        const llmScore = llmById.get(candidate.job._id);
        const fallbackScore = Math.round(candidate.preScore);
        const effectiveLlmScore = llmScore?.score ?? fallbackScore;
        return {
          jobId: candidate.job._id,
          bm25Score: candidate.bm25Score,
          bm25Normalized: candidate.bm25Normalized,
          ruleScore: candidate.ruleScore,
          llmScore: effectiveLlmScore,
          totalScore: Math.round(
            effectiveLlmScore * 0.8 +
              candidate.bm25Normalized * 0.15 +
              candidate.ruleScore * 0.05
          ),
          scoringMode: llmScore ? llm.mode : "bm25_only",
          rationale: llmScore?.rationale,
          strengths: llmScore?.strengths ?? [],
          risks: llmScore?.risks ?? [],
        };
      });

      const scoreByJobId = new Map(scores.map((score) => [score.jobId, score]));
      const recommendations = topForLlm
        .map((candidate) => {
          const score = scoreByJobId.get(candidate.job._id);
          if (!score || score.llmScore < RECOMMENDATION_CUTOFF) return null;
          return {
            jobId: candidate.job._id,
            score: score.totalScore,
            llmScore: score.llmScore,
            company: candidate.job.company,
            title: candidate.job.title,
            location: candidate.job.location,
            jobUrl: candidate.job.jobUrl,
            compensationSummary: candidate.job.compensationSummary,
            rationale: score.rationale,
            strengths: score.strengths,
            risks: score.risks,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, MAX_RECOMMENDATIONS)
        .map((recommendation: any, index: number) => ({
          ...recommendation,
          rank: index + 1,
        }));

      const result = await ctx.runMutation(anyApi.ashby.writeRankingResults, {
        runId: args.runId,
        demoUserId,
        decisions,
        scores,
        recommendations,
        model: llm.model,
        scoringMode: llm.mode,
      });
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "recommendations",
        level: "success",
        message: `Wrote ${result.recommendedCount} recommendations.`,
        payload: result,
      });

      return {
        runId: args.runId,
        ...result,
        scoringMode: llm.mode,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(anyApi.ashby.markRunFailed, {
        runId: args.runId,
        source: "ranker",
        message,
      });
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "ranking",
        level: "error",
        message: "Ranking failed.",
        payload: { error: message },
      });
      throw err;
    }
  },
});

async function tailorJobForOnboarding(
  ctx: any,
  {
    demoUserId,
    jobId,
    profile: inputProfile,
  }: {
    demoUserId: string;
    jobId: string;
    profile: any;
  }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const startedAt = Date.now();
  const profile = profileForTailoring(inputProfile);
  const apiKey = process.env.OPENAI_API_KEY;

  const detail = await ctx.runQuery(anyApi.ashby.jobDetail, {
    demoUserId,
    jobId,
  });
  const sourceJob = detail?.job;
  if (!sourceJob) {
    return { ok: false, reason: "job_not_found" };
  }

  const job: Job = {
    id: jobId,
    company: sourceJob.company,
    role: sourceJob.title,
    jobUrl: sourceJob.jobUrl,
    location: sourceJob.location,
    descriptionPlain: sourceJob.descriptionPlain,
  };

  await ctx.runMutation(anyApi.ashby.upsertTailoredApplication, {
    demoUserId,
    jobId,
    status: "tailoring",
    job,
    pdfReady: false,
  });

  if (!apiKey) {
    await failTailoring(ctx, demoUserId, jobId, job, "no_api_key");
    return { ok: false, reason: "no_api_key" };
  }

  try {
    const researched = await withAbortTimeout(45_000, (signal) => researchJob(job, apiKey, signal));
    if (!researched.ok) {
      await failTailoring(ctx, demoUserId, jobId, job, researched.reason);
      return { ok: false, reason: researched.reason };
    }

    const tailored = await withAbortTimeout(60_000, (signal) => tailorResume(profile, researched.research, apiKey, signal));
    if (!tailored.ok) {
      await failTailoring(ctx, demoUserId, jobId, job, tailored.reason);
      return { ok: false, reason: tailored.reason };
    }

    const pdfBytes = textToPdf(resumeFallbackText(tailored.resume));
    const pdfBase64 = toBase64(pdfBytes);
    const scoring = computeTailoringScore(tailored.resume, researched.research);

    await ctx.runMutation(anyApi.ashby.upsertTailoredApplication, {
      demoUserId,
      jobId,
      status: "completed",
      job,
      research: researched.research,
      tailoredResume: tailored.resume,
      tailoringScore: scoring.score,
      keywordCoverage: scoring.coverage,
      durationMs: Date.now() - startedAt,
      pdfReady: true,
      pdfFilename: pdfName(job.company),
      pdfByteLength: pdfBytes.byteLength,
      pdfBase64,
    });

    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await failTailoring(ctx, demoUserId, jobId, job, reason);
    return { ok: false, reason };
  }
}

async function failTailoring(ctx: any, demoUserId: string, jobId: string, job: Job, error: string) {
  await ctx.runMutation(anyApi.ashby.upsertTailoredApplication, {
    demoUserId,
    jobId,
    status: "failed",
    job,
    pdfReady: false,
    error,
  });
}

function pdfName(company: string): string {
  const safeCompany = company.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `Resume_${safeCompany || "Tailored"}.pdf`;
}

function profileForTailoring(profile: any) {
  if (!isProfileUsable(profile)) return DEMO_PROFILE;
  return {
    ...profile,
    links: profile.links ?? {},
    experience: profile.experience ?? [],
    education: profile.education ?? [],
    skills: profile.skills ?? [],
    prefs: profile.prefs ?? { roles: [], locations: [] },
    suggestions: profile.suggestions ?? [],
    provenance: profile.provenance ?? {},
    log: profile.log ?? [],
    updatedAt: profile.updatedAt ?? new Date().toISOString(),
  };
}

async function withAbortTimeout<T>(
  ms: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function resumeFallbackText(resume: TailoredResume): string {
  return [
    "Tailored Resume",
    "",
    resume.summary,
    "",
    resume.skills?.length ? `Skills: ${resume.skills.join(", ")}` : undefined,
    "",
    ...(resume.experience ?? []).flatMap((item) => [
      [item.title, item.company].filter(Boolean).join(" - "),
      ...(item.bullets ?? []).map((bullet) => `- ${bullet}`),
      "",
    ]),
    ...(resume.projects ?? []).flatMap((item) => [
      item.name,
      ...(item.bullets ?? []).map((bullet) => `- ${bullet}`),
      "",
    ]),
  ].filter((line): line is string => typeof line === "string").join("\n");
}

async function runProviderIngestion(
  ctx: any,
  args: {
    provider: AtsProvider;
    demoUserId?: string;
    limitSources?: number;
    sources?: any[];
  }
) {
  const demoUserId = args.demoUserId ?? DEMO_USER_ID;
  let sources = normalizeAtsSources(args.provider, args.sources ?? []);

  if (sources.length > 0) {
    await ctx.runMutation(anyApi.ashby.upsertAtsSources, { sources });
  } else {
    sources = (await ctx.runQuery(anyApi.ashby.listEnabledAtsSourcesForAction, {
      provider: args.provider,
      limit: args.limitSources,
    })) as AtsSource[];
  }

  if (typeof args.limitSources === "number") {
    sources = sources.slice(0, args.limitSources);
  }

  const runId = await ctx.runMutation(anyApi.ashby.createIngestionRun, {
    demoUserId,
    sourceCount: sources.length,
  });
  await appendPipelineLog(ctx, {
    demoUserId,
    runId,
    stage: "ingestion",
    level: "info",
    message: `Started ${args.provider} ingestion for ${sources.length} sources.`,
    payload: {
      provider: args.provider,
      sources: sources.map((source) => ({
        company: source.company,
        slug: source.slug,
      })),
    },
  });

  try {
    const errors: Array<{ source: string; message: string }> = [];
    const seenDedupeKeys = new Set<string>();
    const normalizedJobs: NormalizedAtsJob[] = [];
    let fetchedCount = 0;

    await parallelMapAts(sources, 5, async (source) => {
      try {
        await appendPipelineLog(ctx, {
          demoUserId,
          runId,
          stage: "fetch",
          level: "info",
          message: `Fetching ${source.company} (${source.slug}) from ${args.provider}.`,
          payload: { provider: args.provider, company: source.company, slug: source.slug },
        });

        const jobs = await fetchProviderJobs(source, String(runId));
        fetchedCount++;
        await appendPipelineLog(ctx, {
          demoUserId,
          runId,
          stage: "fetch",
          level: "success",
          message: `Fetched ${jobs.length} jobs from ${source.company}.`,
          payload: {
            provider: args.provider,
            company: source.company,
            slug: source.slug,
            jobCount: jobs.length,
          },
        });

        for (const job of jobs) {
          if (seenDedupeKeys.has(job.dedupeKey)) continue;
          seenDedupeKeys.add(job.dedupeKey);
          normalizedJobs.push(job);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ source: source.company, message });
        await appendPipelineLog(ctx, {
          demoUserId,
          runId,
          stage: "fetch",
          level: "error",
          message: `Failed to fetch ${source.company}.`,
          payload: {
            provider: args.provider,
            company: source.company,
            slug: source.slug,
            error: message,
          },
        });
      }
    });

    const stored = await ctx.runMutation(anyApi.ashby.storeFetchedJobs, {
      runId,
      demoUserId,
      sourceCount: sources.length,
      fetchedCount,
      jobs: toConvexValue(normalizedJobs),
      errors,
    });
    await appendPipelineLog(ctx, {
      demoUserId,
      runId,
      stage: "storage",
      level: stored.errorCount > 0 ? "warning" : "success",
      message: `Stored ${stored.rawJobCount} ${args.provider} jobs with ${stored.errorCount} source errors.`,
      payload: {
        provider: args.provider,
        rawJobCount: stored.rawJobCount,
        errorCount: stored.errorCount,
        fetchedCount,
        sourceCount: sources.length,
      },
    });

    return {
      runId,
      provider: args.provider,
      sourceCount: sources.length,
      fetchedCount,
      rawJobCount: stored.rawJobCount,
      errorCount: stored.errorCount,
    };
  } catch (err) {
    await ctx.runMutation(anyApi.ashby.markRunFailed, {
      runId,
      source: args.provider,
      message: err instanceof Error ? err.message : String(err),
    });
    await appendPipelineLog(ctx, {
      demoUserId,
      runId,
      stage: "ingestion",
      level: "error",
      message: `${args.provider} ingestion failed.`,
      payload: { error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

function normalizeAtsSources(provider: AtsProvider, sources: any[]): AtsSource[] {
  return sources
    .map((source) => {
      const slug = String(
        source.slug ??
          source.boardToken ??
          source.board_token ??
          source.site ??
          source.account ??
          source.accountSlug ??
          source.tenantReportSlug ??
          ""
      ).trim();
      const company = String(source.company ?? source.name ?? "").trim();
      if (!slug || !company) return null;
      return {
        ...source,
        provider,
        company,
        slug,
        enabled: source.enabled !== false,
      } as AtsSource;
    })
    .filter((source): source is AtsSource => source !== null);
}

async function fetchProviderJobs(source: AtsSource, runId: string) {
  if (source.provider === "greenhouse") {
    const url = `${GREENHOUSE_API_BASE}/${encodeURIComponent(source.slug)}/jobs?content=true`;
    const json = await fetchJsonWithRetry<{ jobs?: any[] }>(url);
    return (Array.isArray(json.jobs) ? json.jobs : [])
      .map((job) => normalizeGreenhouseJob(source, job, runId))
      .filter((job): job is NormalizedAtsJob => job !== null);
  }

  if (source.provider === "lever") {
    const region = source.config?.region === "eu" ? "eu" : "global";
    const base = LEVER_API_BASES[region];
    const jobs: NormalizedAtsJob[] = [];
    let skip = 0;

    while (true) {
      const url = `${base}/${encodeURIComponent(source.slug)}?mode=json&skip=${skip}&limit=${LEVER_PAGE_SIZE}`;
      const page = await fetchJsonWithRetry<any[]>(url);
      const postings = Array.isArray(page) ? page : [];
      jobs.push(
        ...postings
          .map((job) => normalizeLeverJob(source, job, runId))
          .filter((job): job is NormalizedAtsJob => job !== null)
      );
      if (postings.length < LEVER_PAGE_SIZE) break;
      skip += LEVER_PAGE_SIZE;
    }

    return jobs;
  }

  if (source.provider === "workable") {
    const url =
      typeof source.config?.apiUrl === "string" && source.config.apiUrl.trim()
        ? source.config.apiUrl.trim()
        : `${WORKABLE_WIDGET_API_BASE}/${encodeURIComponent(source.slug)}`;
    const json = await fetchJsonWithRetry<any>(url);
    return extractWorkableJobs(json)
      .map((job) => normalizeWorkableJob(source, job, runId))
      .filter((job): job is NormalizedAtsJob => job !== null);
  }

  const reportUrl = typeof source.config?.reportUrl === "string" ? source.config.reportUrl : "";
  if (!reportUrl) throw new Error("workday_missing_report_url");
  const usernameEnv =
    typeof source.config?.usernameEnv === "string"
      ? source.config.usernameEnv
      : "WORKDAY_USERNAME";
  const passwordEnv =
    typeof source.config?.passwordEnv === "string"
      ? source.config.passwordEnv
      : "WORKDAY_PASSWORD";
  const username = process.env[usernameEnv];
  const password = process.env[passwordEnv];
  if (!username || !password) throw new Error("workday_missing_credentials");

  const json = await fetchJsonWithRetry<any>(reportUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    },
  });
  return extractWorkdayRows(json)
    .map((row) => normalizeWorkdayJob(source, row, runId))
    .filter((job): job is NormalizedAtsJob => job !== null);
}

function extractWorkdayRows(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.Report_Entry)) return json.Report_Entry;
  if (Array.isArray(json?.reportEntry)) return json.reportEntry;
  if (Array.isArray(json?.rows)) return json.rows;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

async function loadCareerOpsSources(): Promise<Required<AshbySource>[]> {
  try {
    const res = await fetchWithTimeout(CAREER_OPS_PORTALS_URL, {}, 12_000);
    if (!res.ok) throw new Error(`career_ops_${res.status}`);
    const text = await res.text();
    const sources = extractAshbySources(text);
    if (sources.length > 0) return sources;
  } catch {
    // Fall back to a compact seed list so the product flow still works if
    // GitHub is unavailable from the Convex runtime.
  }
  return FALLBACK_ASHBY_SOURCES;
}

async function loadCareerOpsAtsSources(provider?: AtsProvider): Promise<AtsSource[]> {
  try {
    const res = await fetchWithTimeout(CAREER_OPS_PORTALS_URL, {}, 12_000);
    if (!res.ok) throw new Error(`career_ops_${res.status}`);
    const text = await res.text();
    const sources = extractCareerOpsAtsSources(text, provider);
    if (sources.length > 0) return sources;
  } catch {
    // Provider ingestion can still run with manually supplied sources.
  }
  return [];
}

function extractAshbySources(text: string): Required<AshbySource>[] {
  const sources: Required<AshbySource>[] = [];
  let current: Partial<Required<AshbySource>> | null = null;

  const flush = () => {
    if (!current?.company || !current.slug) return;
    sources.push({
      _id: "",
      company: current.company,
      slug: current.slug,
      careersUrl: `https://jobs.ashbyhq.com/${current.slug}`,
      enabled: current.enabled ?? true,
      notes: current.notes ?? "",
    });
  };

  for (const line of text.split("\n")) {
    const name = line.match(/^\s*-\s+name:\s*(.+?)\s*$/);
    if (name) {
      flush();
      current = { company: name[1].trim(), enabled: true };
      continue;
    }
    if (!current) continue;

    const url = line.match(/^\s*careers_url:\s*https:\/\/jobs\.ashbyhq\.com\/(.+?)\s*$/);
    if (url) {
      current.slug = url[1].trim();
      current.careersUrl = `https://jobs.ashbyhq.com/${current.slug}`;
      continue;
    }

    const notes = line.match(/^\s*notes:\s*"(.+?)"\s*$/);
    if (notes) {
      current.notes = notes[1].trim();
      continue;
    }

    const enabled = line.match(/^\s*enabled:\s*(true|false)\s*$/);
    if (enabled) {
      current.enabled = enabled[1] === "true";
    }
  }
  flush();

  const bySlug = new Map<string, Required<AshbySource>>();
  for (const source of sources) {
    bySlug.set(source.slug, source);
  }
  return Array.from(bySlug.values());
}

function extractCareerOpsAtsSources(text: string, provider?: AtsProvider): AtsSource[] {
  const companies = extractCareerOpsCompanies(text);
  const sources: AtsSource[] = [];

  for (const company of companies) {
    if (company.enabled === false) continue;
    const detected = detectCareerOpsAtsSource(company);
    if (!detected) continue;
    if (provider && detected.provider !== provider) continue;
    sources.push(detected);
  }

  const byKey = new Map<string, AtsSource>();
  for (const source of sources) {
    byKey.set(`${source.provider}:${source.slug}`, source);
  }
  return Array.from(byKey.values());
}

function extractCareerOpsCompanies(text: string) {
  const companies: Array<Record<string, any>> = [];
  let inTrackedCompanies = false;
  let current: Record<string, any> | null = null;

  const flush = () => {
    if (current?.name) companies.push(current);
  };

  for (const line of text.split("\n")) {
    if (/^tracked_companies:\s*$/.test(line)) {
      inTrackedCompanies = true;
      continue;
    }
    if (!inTrackedCompanies) continue;
    if (/^\S/.test(line) && !/^tracked_companies:\s*$/.test(line)) {
      flush();
      break;
    }

    const entry = line.match(/^\s*-\s+name:\s*(.+?)\s*$/);
    if (entry) {
      flush();
      current = { name: cleanYamlScalar(entry[1]) };
      continue;
    }
    if (!current) continue;

    const field = line.match(/^\s+([a-zA-Z0-9_]+):\s*(.*?)\s*$/);
    if (!field) continue;
    current[field[1]] = parseYamlScalar(field[2]);
  }
  flush();

  return companies;
}

function detectCareerOpsAtsSource(company: Record<string, any>): AtsSource | null {
  const name = stringOrUndefined(company.name);
  const careersUrl = stringOrUndefined(company.careers_url);
  const api = stringOrUndefined(company.api);
  if (!name || !careersUrl) return null;

  const greenhouseUrl = api?.includes("greenhouse.io") ? api : careersUrl;
  const greenhouseMatch = greenhouseUrl.match(
    /(?:boards-api\.greenhouse\.io\/v1\/boards|job-boards(?:\.eu)?\.greenhouse\.io)\/([^/?#]+)/
  );
  if (greenhouseMatch) {
    return {
      provider: "greenhouse",
      company: name,
      slug: greenhouseMatch[1],
      careersUrl,
      enabled: company.enabled !== false,
      seededFrom: "career-ops",
      config: { apiUrl: api },
    };
  }

  const leverMatch = careersUrl.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (leverMatch) {
    return {
      provider: "lever",
      company: name,
      slug: leverMatch[1],
      careersUrl,
      enabled: company.enabled !== false,
      seededFrom: "career-ops",
      config: { region: careersUrl.includes("api.eu.lever.co") ? "eu" : "global" },
    };
  }

  const workdayMatch = careersUrl.match(/myworkdayjobs\.com\/([^/?#]+)/);
  if (workdayMatch && stringOrUndefined(company.report_url)) {
    return {
      provider: "workday",
      company: name,
      slug: workdayMatch[1],
      careersUrl,
      enabled: company.enabled !== false,
      seededFrom: "career-ops",
      config: { reportUrl: stringOrUndefined(company.report_url) },
    };
  }

  const workableMatch = careersUrl.match(/apply\.workable\.com\/([^/?#]+)/);
  if (workableMatch) {
    return {
      provider: "workable",
      company: name,
      slug: workableMatch[1],
      careersUrl,
      enabled: company.enabled !== false,
      seededFrom: "career-ops",
    };
  }

  return null;
}

async function fetchAshbyBoard(slug: string): Promise<{ jobs?: AshbyApiJob[] }> {
  const url = `${ASHBY_API_BASE}/${encodeURIComponent(slug)}?includeCompensation=true`;
  const res = await fetchWithTimeout(url, {}, 12_000);
  if (!res.ok) throw new Error(`ashby_${res.status}`);
  return (await res.json()) as { jobs?: AshbyApiJob[] };
}

function normalizeAshbyJob(source: AshbySource, job: AshbyApiJob, runId: string) {
  const title = job.title?.trim();
  const jobUrl = job.jobUrl?.trim();
  if (!title || !jobUrl) return null;

  const compensationSummary =
    job.compensation?.compensationTierSummary ??
    job.compensation?.scrapeableCompensationSalarySummary;
  const parsedCompensation = parseCompensation(compensationSummary);
  const location = [job.location, ...(job.secondaryLocations ?? []).map((loc) => loc.location)]
    .filter(Boolean)
    .join(" · ");

  return {
    sourceId: source._id || undefined,
    company: source.company,
    sourceSlug: source.slug,
    title,
    normalizedTitle: title.toLowerCase(),
    location: location || undefined,
    isRemote: job.isRemote,
    workplaceType: job.workplaceType,
    employmentType: job.employmentType,
    department: job.department,
    team: job.team,
    descriptionPlain: job.descriptionPlain ?? stripHtml(job.descriptionHtml),
    compensationSummary,
    salaryMin: parsedCompensation.min ?? undefined,
    salaryMax: parsedCompensation.max ?? undefined,
    currency: parsedCompensation.currency,
    jobUrl,
    applyUrl: job.applyUrl,
    publishedAt: job.publishedAt,
    dedupeKey: `${source.slug}:${jobUrl}`,
    raw: { ...job, runId },
  };
}

function docToRankingJob(doc: any): RankingJob {
  return {
    id: doc._id,
    title: doc.title,
    company: doc.company,
    location: doc.location,
    isRemote: doc.isRemote,
    workplaceType: doc.workplaceType,
    employmentType: doc.employmentType,
    department: doc.department,
    team: doc.team,
    descriptionPlain: doc.descriptionPlain,
    compensationSummary: doc.compensationSummary,
    salaryMin: doc.salaryMin,
    salaryMax: doc.salaryMax,
    currency: doc.currency,
    jobUrl: doc.jobUrl,
  };
}

function rankWithMiniSearch(
  jobs: Array<RankingJob & { _id: string; rawDoc: any }>,
  profile: RankingProfile,
  decisions: any[]
): Candidate[] {
  if (jobs.length === 0) return [];
  const ruleScores = new Map(decisions.map((decision) => [decision.jobId, decision.ruleScore]));
  const docs = jobs.map((job) => ({
    id: job._id,
    title: job.title,
    company: job.company,
    location: job.location ?? "",
    team: job.team ?? "",
    department: job.department ?? "",
    description: job.descriptionPlain ?? "",
  }));
  const query = buildProfileSearchQuery(profile);
  const miniSearch = new MiniSearch({
    fields: ["title", "team", "department", "location", "description"],
    storeFields: ["title"],
    searchOptions: {
      boost: { title: 5, team: 3, department: 2, description: 1, location: 0.5 },
      fuzzy: 0.1,
      prefix: true,
      combineWith: "OR",
    },
  });
  miniSearch.addAll(docs);

  const results =
    query.length > 0
      ? miniSearch.search(query)
      : docs.map((doc) => ({ id: doc.id, score: 1 }) as SearchResult);
  const resultScores = new Map(results.map((result) => [String(result.id), result.score]));
  const maxBm25 = Math.max(1, ...Array.from(resultScores.values()));

  return jobs
    .map((job) => {
      const bm25Score = resultScores.get(job._id) ?? 0;
      const bm25Normalized = normalizeScore(bm25Score, maxBm25);
      const ruleScore = ruleScores.get(job._id) ?? 50;
      return {
        job,
        bm25Score,
        bm25Normalized,
        ruleScore,
        preScore: bm25Normalized * 0.72 + ruleScore * 0.28,
      };
    })
    .sort((a, b) => b.preScore - a.preScore);
}

async function scoreCandidatesWithLlm(
  profile: RankingProfile,
  candidates: Candidate[]
): Promise<{ mode: string; model?: string; scores: LlmScore[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_RANKING_MODEL ?? "gpt-4o-mini";
  if (!apiKey || candidates.length === 0) {
    return {
      mode: "heuristic_fallback",
      model,
      scores: candidates.map((candidate) => heuristicLlmScore(candidate)),
    };
  }

  const jobs = candidates.map((candidate) => ({
    jobId: candidate.job._id,
    title: candidate.job.title,
    company: candidate.job.company,
    location: candidate.job.location,
    team: candidate.job.team,
    department: candidate.job.department,
    compensation: candidate.job.compensationSummary,
    bm25Score: candidate.bm25Normalized,
    ruleScore: candidate.ruleScore,
    description: truncate(candidate.job.descriptionPlain ?? "", 1200),
  }));

  let res: Response;
  try {
    res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You score job fit for a candidate. Return JSON only. Be strict. If a job is weak or only vaguely related, score it below 70.",
            },
            {
              role: "user",
              content: JSON.stringify({
                candidateProfile: profile,
                scoringScale:
                  "0 to 100. 70 means worth recommending. 85 means strong fit.",
                requiredShape:
                  "{ scores: [{ jobId, score, rationale, strengths: string[], risks: string[] }] }",
                jobs,
              }),
            },
          ],
        }),
      },
      45_000
    );
  } catch {
    return {
      mode: "heuristic_fallback",
      model,
      scores: candidates.map((candidate) => heuristicLlmScore(candidate)),
    };
  }

  if (!res.ok) {
    return {
      mode: "heuristic_fallback",
      model,
      scores: candidates.map((candidate) => heuristicLlmScore(candidate)),
    };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { scores?: unknown[] };
    const scores = (parsed.scores ?? [])
      .map(parseLlmScore)
      .filter((score): score is LlmScore => score !== null);
    if (scores.length === 0) throw new Error("empty_scores");

    const byId = new Map(scores.map((score) => [score.jobId, score]));
    for (const candidate of candidates) {
      if (!byId.has(candidate.job._id)) {
        scores.push(heuristicLlmScore(candidate));
      }
    }
    return { mode: "llm", model, scores };
  } catch {
    return {
      mode: "heuristic_fallback",
      model,
      scores: candidates.map((candidate) => heuristicLlmScore(candidate)),
    };
  }
}

function parseLlmScore(value: unknown): LlmScore | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const jobId = typeof record.jobId === "string" ? record.jobId : "";
  const score =
    typeof record.score === "number"
      ? Math.max(0, Math.min(100, Math.round(record.score)))
      : null;
  if (!jobId || score === null) return null;
  return {
    jobId,
    score,
    rationale:
      typeof record.rationale === "string" ? truncate(record.rationale, 260) : undefined,
    strengths: stringArray(record.strengths).slice(0, 3),
    risks: stringArray(record.risks).slice(0, 3),
  };
}

function heuristicLlmScore(candidate: Candidate): LlmScore {
  const score = Math.round(candidate.preScore);
  return {
    jobId: candidate.job._id,
    score,
    rationale:
      "Scored with the local rules and BM25 ranker because LLM scoring was unavailable.",
    strengths: [],
    risks: score >= RECOMMENDATION_CUTOFF ? [] : ["Below the recommendation cutoff."],
  };
}

async function parallelMap<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function appendPipelineLog(
  ctx: any,
  args: {
    demoUserId?: string;
    runId?: string;
    stage: string;
    level: "info" | "success" | "warning" | "error";
    message: string;
    payload?: any;
  }
) {
  try {
    await ctx.runMutation(anyApi.ashby.appendPipelineLog, toConvexValue(args));
  } catch {
    // Logging should never break the product pipeline.
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = cleanYamlScalar(value);
  return trimmed || undefined;
}

function parseYamlScalar(value: string): string | boolean | undefined {
  const cleaned = cleanYamlScalar(value);
  if (!cleaned) return undefined;
  if (cleaned === "true") return true;
  if (cleaned === "false") return false;
  return cleaned;
}

function cleanYamlScalar(value: string): string {
  return value
    .trim()
    .replace(/^['"“‘]+|['"”’]+$/g, "")
    .trim();
}

function toConvexValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const FALLBACK_ASHBY_SOURCES: Required<AshbySource>[] = [
  {
    _id: "",
    company: "ElevenLabs",
    slug: "elevenlabs",
    careersUrl: "https://jobs.ashbyhq.com/elevenlabs",
    enabled: true,
    notes: "Voice AI TTS leader.",
  },
  {
    _id: "",
    company: "Deepgram",
    slug: "deepgram",
    careersUrl: "https://jobs.ashbyhq.com/deepgram",
    enabled: true,
    notes: "Speech to text and voice AI APIs.",
  },
  {
    _id: "",
    company: "Vapi",
    slug: "vapi",
    careersUrl: "https://jobs.ashbyhq.com/vapi",
    enabled: true,
    notes: "Voice AI infrastructure.",
  },
  {
    _id: "",
    company: "Sierra",
    slug: "sierra",
    careersUrl: "https://jobs.ashbyhq.com/sierra",
    enabled: true,
    notes: "AI customer agents.",
  },
  {
    _id: "",
    company: "Decagon",
    slug: "decagon",
    careersUrl: "https://jobs.ashbyhq.com/decagon",
    enabled: true,
    notes: "AI customer support agents.",
  },
  {
    _id: "",
    company: "Supabase",
    slug: "supabase",
    careersUrl: "https://jobs.ashbyhq.com/supabase",
    enabled: true,
    notes: "Open-source developer platform.",
  },
  {
    _id: "",
    company: "Perplexity",
    slug: "perplexity",
    careersUrl: "https://jobs.ashbyhq.com/perplexity",
    enabled: true,
    notes: "AI-native search and enterprise AI platform.",
  },
  {
    _id: "",
    company: "WorkOS",
    slug: "workos",
    careersUrl: "https://jobs.ashbyhq.com/workos",
    enabled: true,
    notes: "Developer tools and enterprise auth APIs.",
  },
];

const CURATED_ATS_SOURCES: AtsSource[] = [
  {
    provider: "greenhouse",
    company: "Airtable",
    slug: "airtable",
    careersUrl: "https://job-boards.greenhouse.io/airtable",
    enabled: true,
    seededFrom: "curated",
  },
  {
    provider: "greenhouse",
    company: "Vercel",
    slug: "vercel",
    careersUrl: "https://job-boards.greenhouse.io/vercel",
    enabled: true,
    seededFrom: "curated",
  },
  {
    provider: "lever",
    company: "Mistral AI",
    slug: "mistral",
    careersUrl: "https://jobs.lever.co/mistral",
    enabled: true,
    seededFrom: "curated",
    config: { region: "global" },
  },
  {
    provider: "lever",
    company: "Palantir",
    slug: "palantir",
    careersUrl: "https://jobs.lever.co/palantir",
    enabled: true,
    seededFrom: "curated",
    config: { region: "global" },
  },
  {
    provider: "workable",
    company: "Rentokil Initial",
    slug: "rentokil-initial",
    careersUrl: "https://apply.workable.com/rentokil-initial",
    enabled: true,
    seededFrom: "curated",
  },
];
