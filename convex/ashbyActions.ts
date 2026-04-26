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
import { rankWithHybridV2, type V2Telemetry } from "../lib/job-ranking-v2";
import { toRichRankingProfile, type RepoSummaryDigest } from "../lib/intake/shared/toRankingProfile";
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
import { hasResearchCredentials, researchJob } from "../lib/tailor/research";
import { computeTailoringScore } from "../lib/tailor/score";
import { hasTailorCredentials, tailorResume } from "../lib/tailor/tailor";
import type { Job, TailoredResume } from "../lib/tailor/types";
import { getPuppeteerBrowser } from "../lib/pdf";
import { runAshbyFormFillOnPage } from "../lib/ashby-fill/browser";
import { validateDirectAshbyApplicationUrl } from "../lib/ashby-fill/core";

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
const MAX_RECOMMENDATIONS = 15;
const RECOMMENDATION_CUTOFF = 70;
const LEVER_PAGE_SIZE = 100;
const ATS_PROVIDERS: AtsProvider[] = ["greenhouse", "lever", "workday", "workable"];

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
  softSignals: Record<string, number>;
};

function isSoftFiltersEnabled(): boolean {
  const raw = process.env.RANKER_SOFT_FILTERS;
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

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
      provider: "ashby",
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

export const runAshbyFormFill = action({
  args: {
    targetUrl: v.string(),
    demoUserId: v.optional(v.string()),
    jobId: v.optional(v.id("ingestedJobs")),
    ingestionRunId: v.optional(v.id("ingestionRuns")),
    submit: v.optional(v.boolean()),
    submitPolicy: v.optional(v.union(v.literal("dry_run"), v.literal("submit"))),
    openAiBestEffort: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const { normalizedUrl, organizationSlug } = validateDirectAshbyApplicationUrl(args.targetUrl);
    const requestedSubmitPolicy =
      args.submitPolicy ?? (args.submit === true ? "submit" : "dry_run");
    const submitPolicy = resolveAshbySubmitPolicy(normalizedUrl, requestedSubmitPolicy);
    const context = await ctx.runQuery(anyApi.ashby.getAshbyFormFillContext, {
      demoUserId,
      organizationSlug,
    });
    const profile = isProfileUsable(context?.profile) ? context.profile : DEMO_PROFILE;
    const profileIdentity = profileIdentityForAshbyRun(profile);
    const runId = await ctx.runMutation(anyApi.ashby.createAshbyFormFillRun, {
      demoUserId,
      jobId: args.jobId,
      ingestionRunId: args.ingestionRunId,
      targetUrl: normalizedUrl,
      organizationSlug,
      profileIdentity,
    });

    await appendPipelineLog(ctx, {
      demoUserId,
      stage: "ashby-fill",
      level: "info",
      message: "Started Ashby form fill.",
      payload: {
        runId,
        targetUrl: normalizedUrl,
        organizationSlug,
        requestedSubmitPolicy,
        submitPolicy,
        submit: submitPolicy === "submit",
        openAiBestEffort: args.openAiBestEffort === true,
        profileIdentity,
      },
    });
    if (requestedSubmitPolicy === "submit" && submitPolicy !== "submit") {
      await appendPipelineLog(ctx, {
        demoUserId,
        stage: "ashby-fill",
        level: "warning",
        message: "Ashby submit request downgraded to dry-run because no test submit gate matched.",
        payload: {
          runId,
          targetUrl: normalizedUrl,
          requestedSubmitPolicy,
          submitPolicy,
        },
      });
    }

    let page: any = null;
    try {
      const browser = await getPuppeteerBrowser();
      page = await browser.newPage();
      const result = await runAshbyFormFillOnPage(page, {
        targetUrl: normalizedUrl,
        profile,
        aliases: Array.isArray(context?.aliases) ? context.aliases : [],
        approvedAnswers: Array.isArray(context?.approvedAnswers)
          ? context.approvedAnswers
          : [],
        openAiBestEffort: args.openAiBestEffort === true,
        openAiApiKey: args.openAiBestEffort === true ? process.env.OPENAI_API_KEY : null,
        openAiModel: process.env.OPENAI_ASHBY_FILL_MODEL ?? "gpt-4o-mini",
        draftAnswerMode: args.openAiBestEffort === true ? "fill" : "review_only",
        submit: submitPolicy === "submit",
      });
      const stagingEvidence = summarizeAshbyStagingEvidence(result, submitPolicy);

      await ctx.runMutation(anyApi.ashby.finalizeAshbyFormFillRun, {
        runId,
        result: toConvexValue(result),
      });
      return {
        runId,
        outcome: result.outcome,
        submitAttempted: result.submitAttempted,
        submitCompleted: result.submitCompleted,
        blockerCount: result.blockers.length,
        runGrade: result.runGrade,
        submitPolicy,
        evidence: stagingEvidence,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(anyApi.ashby.finalizeAshbyFormFillRun, {
        runId,
        error: message,
      });
      await appendPipelineLog(ctx, {
        demoUserId,
        stage: "ashby-fill",
        level: "error",
        message: "Ashby form fill failed.",
        payload: { runId, targetUrl: normalizedUrl, error: message },
      });
      throw err;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  },
});

export const runOnboardingPipeline = internalAction({
  args: {
    demoUserId: v.optional(v.string()),
    runId: v.id("ingestionRuns"),
    mode: v.optional(v.union(v.literal("ashby"), v.literal("mixed"))),
    limitSources: v.optional(v.number()),
    targetJobs: v.optional(v.number()),
    maxJobs: v.optional(v.number()),
    tailorLimit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const mode = args.mode ?? "ashby";
    const tailorLimit = args.tailorLimit ?? 3;

    try {
      let ingestion: any;
      if (mode === "mixed") {
        await ctx.runAction(anyApi.ashbyActions.seedAshbySourcesFromCareerOps, {});
        await ctx.runAction(anyApi.ashbyActions.seedCuratedAtsSources, {});
        ingestion = await ctx.runAction(anyApi.ashbyActions.runMixedProviderIngestion, {
          demoUserId,
          runId: args.runId,
          targetJobs: args.targetJobs ?? 150,
          maxJobs: args.maxJobs ?? 175,
        });
      } else {
        await ctx.runAction(anyApi.ashbyActions.seedAshbySourcesFromCareerOps, {});
        ingestion = await ctx.runAction(anyApi.ashbyActions.runAshbyIngestion, {
          demoUserId,
          runId: args.runId,
          limitSources: args.limitSources ?? 3,
        });
      }
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
      const tailoredJobIds: string[] = [];
      for (const recommendation of topJobs) {
        if (!recommendation.jobId) continue;
        const result = await tailorJobForOnboarding(ctx, {
          demoUserId,
          jobId: recommendation.jobId,
          profile,
        });
        if (result.ok) {
          tailoredCount++;
          tailoredJobIds.push(recommendation.jobId);
        }
      }

      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "tailoring",
        level: tailoredCount === topJobs.length ? "success" : "warning",
        message: `Finished async tailoring for ${tailoredCount}/${topJobs.length} top jobs.`,
        payload: { tailoredCount, targetCount: topJobs.length },
      });

      const appliedSummary = await runAutoApplyForTailoredJobs(ctx, {
        demoUserId,
        runId: args.runId,
        tailoredJobIds,
      });

      return {
        ingestion,
        ranking,
        tailoredCount,
        appliedCount: appliedSummary.appliedCount,
        appliedAttempted: appliedSummary.attempted,
      };
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

export const runMixedProviderIngestion = action({
  args: {
    demoUserId: v.optional(v.string()),
    runId: v.optional(v.id("ingestionRuns")),
    targetJobs: v.optional(v.number()),
    maxJobs: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const demoUserId = args.demoUserId ?? DEMO_USER_ID;
    const targetJobs = args.targetJobs ?? 150;
    const maxJobs = args.maxJobs ?? 175;

    let ashbySources = (await ctx.runQuery(anyApi.ashby.listEnabledSourcesForAction, {})) as AshbySource[];
    if (ashbySources.length === 0) {
      const seeded = await loadCareerOpsSources();
      await ctx.runMutation(anyApi.ashby.upsertAshbySources, { sources: seeded });
      ashbySources = (await ctx.runQuery(anyApi.ashby.listEnabledSourcesForAction, {})) as AshbySource[];
    }

    const atsSourcesByProvider = await Promise.all(
      ATS_PROVIDERS.map(async (provider) => ({
        provider,
        sources: (await ctx.runQuery(anyApi.ashby.listEnabledAtsSourcesForAction, {
          provider,
        })) as AtsSource[],
      }))
    );

    const mixedSources: Array<
      | { kind: "ashby"; source: AshbySource }
      | { kind: "ats"; provider: AtsProvider; source: AtsSource }
    > = [
      ...ashbySources.map((source) => ({ kind: "ashby" as const, source })),
      ...atsSourcesByProvider.flatMap(({ provider, sources }) =>
        sources.map((source) => ({ kind: "ats" as const, provider, source }))
      ),
    ].sort((a, b) => a.source.company.localeCompare(b.source.company));

    const runId = args.runId ?? await ctx.runMutation(anyApi.ashby.createIngestionRun, {
      demoUserId,
      provider: "mixed",
      sourceCount: mixedSources.length,
    });
    await appendPipelineLog(ctx, {
      demoUserId,
      runId,
      stage: "ingestion",
      level: "info",
      message: `Started mixed-provider ingestion for up to ${targetJobs} jobs.`,
      payload: {
        provider: "mixed",
        targetJobs,
        maxJobs,
        sourceCount: mixedSources.length,
      },
    });

    try {
      const errors: Array<{ source: string; message: string }> = [];
      const seenDedupeKeys = new Set<string>();
      const normalizedJobs: NormalizedAtsJob[] = [];
      let fetchedCount = 0;

      for (const sourceRef of mixedSources) {
        if (normalizedJobs.length >= targetJobs) break;

        try {
          const provider = sourceRef.kind === "ashby" ? "ashby" : sourceRef.provider;
          await appendPipelineLog(ctx, {
            demoUserId,
            runId,
            stage: "fetch",
            level: "info",
            message: `Fetching ${sourceRef.source.company} from ${provider}.`,
            payload: { provider, company: sourceRef.source.company, slug: sourceRef.source.slug },
          });

          const jobs = sourceRef.kind === "ashby"
            ? await fetchAshbySourceJobs(sourceRef.source, String(runId))
            : await fetchProviderJobs(sourceRef.source, String(runId));
          fetchedCount++;

          await appendPipelineLog(ctx, {
            demoUserId,
            runId,
            stage: "fetch",
            level: "success",
            message: `Fetched ${jobs.length} jobs from ${sourceRef.source.company}.`,
            payload: {
              provider,
              company: sourceRef.source.company,
              slug: sourceRef.source.slug,
              jobCount: jobs.length,
            },
          });

          for (const job of jobs) {
            if (normalizedJobs.length >= maxJobs) break;
            if (seenDedupeKeys.has(job.dedupeKey)) continue;
            seenDedupeKeys.add(job.dedupeKey);
            normalizedJobs.push(job);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ source: sourceRef.source.company, message });
          await appendPipelineLog(ctx, {
            demoUserId,
            runId,
            stage: "fetch",
            level: "error",
            message: `Failed to fetch ${sourceRef.source.company}.`,
            payload: {
              provider: sourceRef.kind === "ashby" ? "ashby" : sourceRef.provider,
              company: sourceRef.source.company,
              slug: sourceRef.source.slug,
              error: message,
            },
          });
        }
      }

      const stored = await ctx.runMutation(anyApi.ashby.storeFetchedJobs, {
        runId,
        demoUserId,
        sourceCount: mixedSources.length,
        fetchedCount,
        jobs: toConvexValue(normalizedJobs.slice(0, maxJobs)),
        errors,
      });
      await appendPipelineLog(ctx, {
        demoUserId,
        runId,
        stage: "storage",
        level: stored.errorCount > 0 ? "warning" : "success",
        message: `Stored ${stored.rawJobCount} mixed-provider jobs with ${stored.errorCount} source errors.`,
        payload: {
          provider: "mixed",
          targetJobs,
          maxJobs,
          rawJobCount: stored.rawJobCount,
          errorCount: stored.errorCount,
          fetchedCount,
          sourceCount: mixedSources.length,
        },
      });

      return {
        runId,
        provider: "mixed",
        sourceCount: mixedSources.length,
        fetchedCount,
        rawJobCount: stored.rawJobCount,
        errorCount: stored.errorCount,
      };
    } catch (err) {
      await ctx.runMutation(anyApi.ashby.markRunFailed, {
        runId,
        source: "mixed",
        message: err instanceof Error ? err.message : String(err),
      });
      await appendPipelineLog(ctx, {
        demoUserId,
        runId,
        stage: "ingestion",
        level: "error",
        message: "Mixed-provider ingestion failed.",
        payload: { error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  },
});

export const rankIngestionRun = action({
  args: {
    runId: v.id("ingestionRuns"),
    demoUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
    profile: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.userId) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity || identity.subject !== args.userId) {
        throw new Error("Forbidden: userId must match authenticated identity");
      }
    }
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
        userId: args.userId,
      });
      const repoSummaries = (payload.repoSummaries ?? []) as RepoSummaryDigest[];
      const profile = toRichRankingProfile((args.profile ?? payload.profile) as any, repoSummaries);
      const jobs = (payload.jobs ?? []) as any[];
      const softFilters = isSoftFiltersEnabled();
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "ranking",
        level: "info",
        message: `Loaded ${jobs.length} ingested jobs for ranking.`,
        payload: {
          jobCount: jobs.length,
          profileSource: payload.profileSource ?? "missing",
          repoHighlightCount: profile.repoHighlights?.length ?? 0,
          softFilters,
        },
      });

      const decisions: any[] = [];
      const survivors: Array<RankingJob & { _id: string; rawDoc: any }> = [];
      const softSignalsByJob = new Map<string, Record<string, number>>();

      for (const doc of jobs) {
        const job = docToRankingJob(doc);
        const decision = evaluateHardFilters(job, profile, { softMode: softFilters });
        softSignalsByJob.set(doc._id, decision.softSignals);
        const hasSoftSignals = Object.keys(decision.softSignals).length > 0;
        decisions.push({
          jobId: doc._id,
          status: decision.status,
          reasons: decision.reasons,
          softSignals: hasSoftSignals ? decision.softSignals : undefined,
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

      const candidates = rankWithMiniSearch(survivors, profile, decisions, softSignalsByJob);
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "ranking",
        level: "info",
        message: `BM25 ranked ${candidates.length} candidates.`,
        payload: { candidateCount: candidates.length },
      });
      let v2Telemetry: V2Telemetry | undefined;
      const v2 = await rankWithHybridV2({
        profile,
        candidates: candidates.map((candidate) => ({
          jobId: candidate.job._id,
          job: candidate.job,
          bm25Score: candidate.bm25Score,
          bm25Normalized: candidate.bm25Normalized,
          ruleScore: candidate.ruleScore,
          softSignals: candidate.softSignals,
        })),
        recommendationCutoff: RECOMMENDATION_CUTOFF,
        maxRecommendations: MAX_RECOMMENDATIONS,
        telemetry: (telemetry) => {
          v2Telemetry = telemetry;
        },
      });
      await appendPipelineLog(ctx, {
        demoUserId,
        runId: args.runId,
        stage: "scoring",
        level: "success",
        message: `Scored ${v2.scores.length} candidates using ${v2.mode}.`,
        payload: {
          mode: v2.mode,
          model: v2.model,
          embeddingModel: v2.embeddingModel,
          rerankModel: v2.rerankModel,
          rationaleModel: v2.rationaleModel,
          scoredCount: v2.scores.length,
        },
      });
      if (v2Telemetry && !v2Telemetry.embeddingsAvailable) {
        await appendPipelineLog(ctx, {
          demoUserId,
          runId: args.runId,
          stage: "ranking",
          level: "warning",
          message: "Embeddings unavailable; v2 fell back to BM25-only retrieval.",
          payload: { error: v2Telemetry.embeddingError },
        });
      }
      if (v2Telemetry && !v2Telemetry.rerankUsed) {
        await appendPipelineLog(ctx, {
          demoUserId,
          runId: args.runId,
          stage: "scoring",
          level: "warning",
          message: "Cohere rerank unavailable; v2 used fused retrieval score.",
          payload: { error: v2Telemetry.rerankError },
        });
      }

      const scores = v2.scores;
      const recommendations = v2.recommendations;

      const result = await ctx.runMutation(anyApi.ashby.writeRankingResults, {
        runId: args.runId,
        demoUserId,
        decisions,
        scores,
        recommendations,
        model: v2.model,
        scoringMode: v2.mode,
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
        scoringMode: v2.mode,
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

function isAshbyApplyUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("ashbyhq.com");
  } catch {
    return false;
  }
}

async function runAutoApplyForTailoredJobs(
  ctx: any,
  {
    demoUserId,
    runId,
    tailoredJobIds,
  }: { demoUserId: string; runId: string; tailoredJobIds: string[] },
): Promise<{ attempted: number; appliedCount: number }> {
  if (tailoredJobIds.length === 0) {
    return { attempted: 0, appliedCount: 0 };
  }

  const autoApplyEnabled = process.env.PIPELINE_AUTO_APPLY !== "false";
  if (!autoApplyEnabled) {
    await appendPipelineLog(ctx, {
      demoUserId,
      runId,
      stage: "apply",
      level: "info",
      message: "Auto-apply is disabled (PIPELINE_AUTO_APPLY=false).",
    });
    return { attempted: 0, appliedCount: 0 };
  }

  let attempted = 0;
  let appliedCount = 0;

  for (const jobId of tailoredJobIds) {
    const detail = await ctx.runQuery(anyApi.ashby.jobDetail, { demoUserId, jobId });
    const job = detail?.job;
    const targetUrl = job?.applyUrl ?? job?.jobUrl;
    if (!isAshbyApplyUrl(targetUrl)) {
      await appendPipelineLog(ctx, {
        demoUserId,
        runId,
        stage: "apply",
        level: "info",
        message: "Skipping auto-apply: non-Ashby job (only Ashby form-fill is wired).",
        payload: { jobId, company: job?.company, targetUrl },
      });
      continue;
    }

    attempted++;
    try {
      const result = await ctx.runAction(anyApi.ashbyActions.runAshbyFormFill, {
        demoUserId,
        jobId,
        ingestionRunId: runId,
        targetUrl,
        submitPolicy: "dry_run",
        openAiBestEffort: true,
      });
      if (result?.outcome === "confirmed" || result?.submitCompleted) {
        appliedCount++;
      }
    } catch (err) {
      await appendPipelineLog(ctx, {
        demoUserId,
        runId,
        stage: "apply",
        level: "warning",
        message: `Auto-apply failed for ${job?.company ?? "job"}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        payload: { jobId, error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  await appendPipelineLog(ctx, {
    demoUserId,
    runId,
    stage: "apply",
    level: appliedCount === attempted && attempted > 0 ? "success" : "info",
    message:
      attempted === 0
        ? "No Ashby-eligible jobs to auto-apply."
        : `Auto-apply (dry-run) finished: ${appliedCount}/${attempted} confirmed.`,
    payload: { attempted, appliedCount, tailoredCount: tailoredJobIds.length },
  });

  return { attempted, appliedCount };
}

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
  const researchApiKey = process.env.OPENAI_API_KEY;

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

  if (!hasResearchCredentials(researchApiKey)) {
    await failTailoring(ctx, demoUserId, jobId, job, "no_research_api_key");
    return { ok: false, reason: "no_research_api_key" };
  }
  if (!hasTailorCredentials(researchApiKey)) {
    await failTailoring(ctx, demoUserId, jobId, job, "no_tailor_api_key");
    return { ok: false, reason: "no_tailor_api_key" };
  }

  try {
    const researched = await withAbortTimeout(45_000, (signal) => researchJob(job, researchApiKey, signal));
    if (!researched.ok) {
      await failTailoring(ctx, demoUserId, jobId, job, researched.reason);
      return { ok: false, reason: researched.reason };
    }

    const tailored = await withAbortTimeout(60_000, (signal) => tailorResume(profile, researched.research, researchApiKey, signal));
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
    resume.headline,
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
    provider: args.provider,
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

async function fetchAshbySourceJobs(source: AshbySource, runId: string): Promise<NormalizedAtsJob[]> {
  const json = await fetchAshbyBoard(source.slug);
  const jobs = Array.isArray(json.jobs) ? (json.jobs as AshbyApiJob[]) : [];
  return jobs
    .filter((job) => job.isListed !== false)
    .map((job) => normalizeAshbyJob(source, job, runId))
    .filter((job): job is NormalizedAtsJob => job !== null);
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

function normalizeAshbyJob(
  source: AshbySource,
  job: AshbyApiJob,
  runId: string
): NormalizedAtsJob | null {
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
  const descriptionPlain = job.descriptionPlain ?? stripHtml(job.descriptionHtml);

  return {
    company: source.company,
    sourceSlug: source.slug,
    title,
    normalizedTitle: title.toLowerCase(),
    jobUrl,
    dedupeKey: `${source.slug}:${jobUrl}`,
    raw: { ...job, runId },
    ...(source._id ? { sourceId: source._id } : {}),
    ...(location ? { location } : {}),
    ...(typeof job.isRemote === "boolean" ? { isRemote: job.isRemote } : {}),
    ...(job.workplaceType ? { workplaceType: job.workplaceType } : {}),
    ...(job.employmentType ? { employmentType: job.employmentType } : {}),
    ...(job.department ? { department: job.department } : {}),
    ...(job.team ? { team: job.team } : {}),
    ...(descriptionPlain ? { descriptionPlain } : {}),
    ...(compensationSummary ? { compensationSummary } : {}),
    ...(typeof parsedCompensation.min === "number" ? { salaryMin: parsedCompensation.min } : {}),
    ...(typeof parsedCompensation.max === "number" ? { salaryMax: parsedCompensation.max } : {}),
    ...(parsedCompensation.currency ? { currency: parsedCompensation.currency } : {}),
    ...(job.applyUrl ? { applyUrl: job.applyUrl } : {}),
    ...(job.publishedAt ? { publishedAt: job.publishedAt } : {}),
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
  decisions: any[],
  softSignalsByJob: Map<string, Record<string, number>> = new Map()
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
    fields: ["title", "company", "team", "department", "location", "description"],
    storeFields: ["title"],
    searchOptions: {
      boost: { title: 5, company: 4, team: 3, department: 2, description: 1, location: 0.5 },
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
        softSignals: softSignalsByJob.get(job._id) ?? {},
      };
    })
    .sort((a, b) => b.preScore - a.preScore);
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

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = cleanYamlScalar(value);
  return trimmed || undefined;
}

function profileIdentityForAshbyRun(profile: unknown) {
  const record = profile && typeof profile === "object" ? profile as Record<string, any> : {};
  const links = record.links && typeof record.links === "object" ? record.links : {};
  return {
    name: typeof record.name === "string" ? record.name : null,
    email: typeof record.email === "string" ? record.email : null,
    location: typeof record.location === "string" ? record.location : null,
    github: typeof links.github === "string" ? links.github : null,
    linkedin: typeof links.linkedin === "string" ? links.linkedin : null,
    hasResumePath: typeof record.resumePath === "string" || typeof record.files?.resumePath === "string",
  };
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

function summarizeAshbyStagingEvidence(
  result: any,
  submitPolicy: "dry_run" | "submit"
) {
  const questions = Array.isArray(result.finalSnapshot?.questions)
    ? result.finalSnapshot.questions
    : [];
  const operations = Array.isArray(result.fillOperations) ? result.fillOperations : [];
  const mappingDecisions = Array.isArray(result.plan?.mapping_decisions)
    ? result.plan.mapping_decisions
    : [];
  const pendingReview = Array.isArray(result.plan?.pending_review)
    ? result.plan.pending_review
    : [];
  const skippedFields = operations.filter((operation: any) =>
    ["skipped", "missing", "blocked", "failed"].includes(String(operation?.status ?? ""))
  );
  const filledFields = operations.filter((operation: any) => operation?.status === "filled");
  const uploadOperations = operations.filter((operation: any) => operation?.key === "resume_file");

  return {
    provider: "ashby",
    submitPolicy,
    submitAttempted: Boolean(result.submitAttempted),
    submitCompleted: Boolean(result.submitCompleted),
    outcome: result.outcome,
    finalStagedStatus: submitPolicy === "dry_run" ? "blocked_before_submit" : result.outcome,
    discoveredQuestions: questions.map((question: any) => ({
      promptHash: question.prompt_hash ?? null,
      questionText: question.question_text ?? null,
      required: Boolean(question.required),
      controlKind: question.control_kind ?? null,
    })),
    mappedFields: mappingDecisions
      .filter((decision: any) => decision?.canonical_key)
      .map((decision: any) => ({
        promptHash: decision.prompt_hash ?? null,
        questionText: decision.question_text ?? null,
        canonicalKey: decision.canonical_key,
        confidence: decision.confidence ?? null,
        source: decision.source ?? null,
        autoAccepted: Boolean(decision.auto_accepted),
      })),
    filledSafeFields: filledFields.map((operation: any) => ({
      key: operation.key,
      verified: Boolean(operation.verified),
      detail: operation.detail ?? null,
    })),
    skippedFields: skippedFields.map((operation: any) => ({
      key: operation.key,
      status: operation.status,
      blocking: Boolean(operation.blocking),
      detail: operation.detail ?? null,
    })),
    sensitiveSkippedFields: skippedFields
      .filter((operation: any) => isSensitiveAshbyKey(operation?.key))
      .map((operation: any) => ({
        key: operation.key,
        status: operation.status,
        detail: operation.detail ?? null,
      })),
    uploadState: {
      attempted: uploadOperations.length > 0,
      verified: uploadOperations.some((operation: any) => operation?.verified === true),
      operations: uploadOperations.map((operation: any) => ({
        status: operation.status,
        detail: operation.detail ?? null,
        verified: Boolean(operation.verified),
      })),
    },
    pendingReviewItems: pendingReview.map((item: any) => ({
      promptHash: item.prompt_hash ?? null,
      questionText: item.question_text ?? null,
      reason: item.reason ?? null,
      answerabilityClass: item.answerability_class ?? null,
      canonicalKeyCandidate: item.canonical_key_candidate ?? null,
    })),
    blockers: Array.isArray(result.blockers) ? result.blockers : [],
    screenshots: Array.isArray(result.screenshots) ? result.screenshots : [],
    notes: Array.isArray(result.notes) ? result.notes : [],
    finalSnapshot: result.finalSnapshot
      ? {
          url: result.finalSnapshot.url ?? null,
          validationErrors: result.finalSnapshot.validation_errors ?? [],
          confirmationTexts: result.finalSnapshot.confirmation_texts ?? [],
          submitControls: result.finalSnapshot.submit_controls ?? 0,
          unexpectedVerificationGate: Boolean(result.finalSnapshot.unexpected_verification_gate),
        }
      : null,
  };
}

function isSensitiveAshbyKey(key: unknown) {
  return [
    "work_authorized_us",
    "visa_sponsorship_required",
    "commute_or_relocate",
    "earliest_start_date",
    "notice_period",
    "salary_expectations",
  ].includes(String(key));
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
