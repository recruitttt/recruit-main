import dashboardSummary from "@/data/om-demo/dashboard-summary.json";
import jobDetails from "@/data/om-demo/job-details.json";
import manifest from "@/data/om-demo/manifest.json";
import organizations from "@/data/om-demo/organizations.json";
import pipelineLogs from "@/data/om-demo/pipeline-logs.json";
import recommendations from "@/data/om-demo/recommendations.json";
import verification from "@/data/om-demo/verification.json";
import MiniSearch, { type SearchResult } from "minisearch";
import type {
  JobDetail,
  LivePipelineLog,
  LiveRecommendation,
  LiveRunSummary,
  OrganizationLogo,
} from "@/components/dashboard/dashboard-types";
import { DEMO_PROFILE } from "@/lib/demo-profile";
import { contentHash } from "@/lib/embeddings/cache";
import { toRichRankingProfile } from "@/lib/intake/shared/toRankingProfile";
import {
  buildProfileSearchQuery,
  evaluateHardFilters,
  normalizeScore,
  type RankingJob,
  type RankingProfile,
} from "@/lib/job-ranking";
import { rankWithHybridV2, type V2Telemetry } from "@/lib/job-ranking-v2";
import type { UserProfile } from "@/lib/profile";
import { resumeFallbackText } from "@/lib/tailor/resume-fallback-text";
import { textToPdf, toBase64 } from "@/lib/tailor/simple-pdf";
import type { Job, TailoredApplication, TailoredResume } from "@/lib/tailor/types";

export const OM_DEMO_USER_ID = "om-demo";
const OM_DEMO_RECOMMENDATION_COUNT = 100;
const OM_DEMO_CACHE_TTL_MS = 5 * 60 * 1000;
const OM_DEMO_COMPANY_PAGE_BASE_URL = "https://recruit-company-pages.vercel.app";
const OM_DEMO_COMPANY_PAGE_SLUGS: Record<string, string> = {
  "google-deepmind": "google-deepmind",
  apple: "apple",
  nvidia: "nvidia",
  openai: "openai",
  meta: "meta",
  "microsoft-ai": "microsoft-ai",
  "amazon-agi": "amazon-agi",
  anthropic: "anthropic",
  tesla: "tesla",
};

type OmDemoOrganization = OrganizationLogo & {
  title: string;
  location: string;
  jobUrl: string;
  sourceSlug: string;
  compensationSummary: string;
  score: number;
  rationale: string;
  strengths: string[];
  risks: string[];
  mission: string;
  products: string[];
  techStack: string[];
};

type RankedOmDemoPayload = ReturnType<typeof staticOmDemoLivePayload>;

type RankedLiveRecommendation = LiveRecommendation & {
  scoringMode?: string;
};

type OmDemoRankingCandidate = {
  recommendation: LiveRecommendation;
  job: RankingJob;
  decision: ReturnType<typeof evaluateHardFilters>;
};

type OmDemoCacheEntry = {
  expiresAt: number;
  payload: RankedOmDemoPayload;
};

const rankedPayloadCache = new Map<string, Promise<RankedOmDemoPayload> | OmDemoCacheEntry>();
let latestRankedByJobId = new Map<string, RankedLiveRecommendation>();
let latestRankedPayload: OmDemoCacheEntry | null = null;

export function shouldUseOmDemoData() {
  const mode = (process.env.DASHBOARD_DATA_SOURCE ?? "").trim().toLowerCase();
  if (["convex", "live"].includes(mode)) return false;
  if (["fixture", "fixtures", "demo", "om-demo"].includes(mode)) return true;
  return !process.env.NEXT_PUBLIC_CONVEX_URL;
}

export function omDemoLivePayload() {
  return staticOmDemoLivePayload();
}

export async function rankedOmDemoLivePayload(profileInput?: UserProfile | RankingProfile | null) {
  if (!profileInput && latestRankedPayload && latestRankedPayload.expiresAt > Date.now()) {
    return latestRankedPayload.payload;
  }

  const profile = toOmDemoRankingProfile(profileInput);
  const cacheKey = contentHash(JSON.stringify({ profile, capability: rankerCapabilityKey() }));
  const cached = rankedPayloadCache.get(cacheKey);
  if (cached) {
    if (cached instanceof Promise) return cached;
    if (cached.expiresAt > Date.now()) return cached.payload;
    rankedPayloadCache.delete(cacheKey);
  }

  const pending = buildRankedOmDemoLivePayload(profile);
  rankedPayloadCache.set(cacheKey, pending);
  try {
    const payload = await pending;
    const entry = {
      expiresAt: Date.now() + OM_DEMO_CACHE_TTL_MS,
      payload,
    };
    rankedPayloadCache.set(cacheKey, entry);
    latestRankedPayload = entry;
    latestRankedByJobId = new Map(
      payload.recommendations
        .filter((recommendation): recommendation is RankedLiveRecommendation & { jobId: string } =>
          typeof recommendation.jobId === "string"
        )
        .map((recommendation) => [recommendation.jobId, recommendation])
    );
    return payload;
  } catch (err) {
    rankedPayloadCache.delete(cacheKey);
    throw err;
  }
}

function rankerCapabilityKey() {
  return {
    openai: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY),
    cohere: Boolean(process.env.COHERE_API_KEY || process.env.AI_GATEWAY_API_KEY),
  };
}

function staticOmDemoLivePayload() {
  const enrichedRecommendations = omDemoRecommendations();
  return {
    run: {
      ...(dashboardSummary as LiveRunSummary),
      rawJobCount: 1240,
      filteredCount: 418,
      survivorCount: 156,
      llmScoredCount: enrichedRecommendations.length,
      recommendedCount: enrichedRecommendations.length,
      tailoredCount: 12,
      tailoringAttemptedCount: 12,
      tailoringTargetCount: 12,
      recommendations: enrichedRecommendations,
    },
    recommendations: enrichedRecommendations,
    logs: omDemoPipelineLogs(enrichedRecommendations),
    followUps: emptyFollowUps(),
    fixture: {
      source: "data/om-demo",
      manifest,
      verification,
      organizations,
    },
  };
}

export function omDemoJobDetail(jobId: string) {
  const demo = generatedRecommendationByJobId(jobId);
  if (demo) {
    return enrichJobDetailFromGenerated(
      demo.baseDetail,
      demo.org,
      latestRankedByJobId.get(jobId) ?? demo.recommendation
    );
  }

  const detail = (jobDetails as unknown as Array<JobDetail>).find(
    (detail) => detail.job?._id === jobId || detail.recommendation?.jobId === jobId
  ) ?? null;
  if (!detail) return null;
  return enrichJobDetail(detail);
}

export function emptyFollowUps() {
  return {
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
  };
}

async function buildRankedOmDemoLivePayload(profile: RankingProfile): Promise<RankedOmDemoPayload> {
  const baseRecommendations = omDemoRecommendations();
  const candidates = buildOmDemoRankingCandidates(baseRecommendations, profile);
  const bm25Candidates = rankOmDemoCandidatesWithMiniSearch(candidates, profile);
  let telemetry: V2Telemetry | undefined;
  const v2Result = await rankWithHybridV2({
    profile,
    candidates: bm25Candidates.map((candidate) => ({
      jobId: candidate.job.id,
      job: candidate.job,
      bm25Score: candidate.bm25Score,
      bm25Normalized: candidate.bm25Normalized,
      ruleScore: candidate.ruleScore,
      softSignals: candidate.softSignals,
    })),
    recommendationCutoff: 0,
    maxRecommendations: OM_DEMO_RECOMMENDATION_COUNT,
    telemetry: (next) => {
      telemetry = next;
    },
  });

  const baseById = new Map(
    baseRecommendations.map((recommendation) => [recommendation.jobId, recommendation])
  );
  const rankedRecommendations = [...v2Result.scores]
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((score, index) => {
      const base = baseById.get(score.jobId);
      if (!base) return null;
      const ranked: RankedLiveRecommendation = {
        ...base,
        rank: index + 1,
        score: score.totalScore,
        llmScore: score.llmScore,
        rationale: score.rationale ?? base.rationale,
        strengths: score.strengths.length > 0 ? score.strengths : base.strengths,
        risks: score.risks,
        scoringMode: score.scoringMode,
        job: base.job
          ? {
              ...base.job,
              score: score.totalScore,
            } as NonNullable<LiveRecommendation["job"]>
          : base.job,
      };
      return ranked;
    })
    .filter((recommendation): recommendation is RankedLiveRecommendation => recommendation !== null);

  const payload = staticOmDemoLivePayload();
  payload.recommendations = rankedRecommendations;
  payload.run = {
    ...payload.run,
    scoringMode: v2Result.mode,
    llmScoredCount: rankedRecommendations.length,
    recommendedCount: rankedRecommendations.length,
    recommendations: rankedRecommendations,
  };
  payload.logs = omDemoPipelineLogs(rankedRecommendations, {
    mode: v2Result.mode,
    telemetry,
  });
  return payload;
}

function buildOmDemoRankingCandidates(
  baseRecommendations: LiveRecommendation[],
  profile: RankingProfile
): OmDemoRankingCandidate[] {
  const filterProfile: RankingProfile = {
    ...profile,
    prefs: {
      ...profile.prefs,
      locations: [],
      minSalary: undefined,
    },
  };

  return baseRecommendations.map((recommendation) => {
    const job = recommendationToRankingJob(recommendation);
    return {
      recommendation,
      job,
      decision: evaluateHardFilters(job, filterProfile, { softMode: true }),
    };
  });
}

type OmDemoBm25Candidate = {
  job: RankingJob;
  bm25Score: number;
  bm25Normalized: number;
  ruleScore: number;
  softSignals: Record<string, number>;
};

function rankOmDemoCandidatesWithMiniSearch(
  candidates: OmDemoRankingCandidate[],
  profile: RankingProfile
): OmDemoBm25Candidate[] {
  if (candidates.length === 0) return [];
  const docs = candidates.map(({ job }) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location ?? "",
    team: job.team ?? "",
    department: job.department ?? "",
    description: job.descriptionPlain ?? "",
  }));
  const query = buildProfileSearchQuery(profile);
  const search = new MiniSearch({
    fields: ["title", "company", "team", "department", "location", "description"],
    storeFields: ["title"],
    searchOptions: {
      boost: { title: 5, company: 4, team: 3, department: 2, description: 1, location: 0.5 },
      fuzzy: 0.1,
      prefix: true,
      combineWith: "OR",
    },
  });
  search.addAll(docs);
  const results: SearchResult[] =
    query.length > 0
      ? search.search(query)
      : docs.map((doc) => ({ id: doc.id, score: 1 }) as SearchResult);
  const resultScores = new Map(results.map((result) => [String(result.id), result.score]));
  const maxBm25 = Math.max(1, ...Array.from(resultScores.values()));

  return candidates
    .map(({ job, decision }) => {
      const bm25Score = resultScores.get(job.id) ?? 0;
      return {
        job,
        bm25Score,
        bm25Normalized: normalizeScore(bm25Score, maxBm25),
        ruleScore: decision.ruleScore,
        softSignals: decision.softSignals,
      };
    })
    .sort((a, b) => b.bm25Normalized - a.bm25Normalized);
}

function recommendationToRankingJob(recommendation: LiveRecommendation): RankingJob {
  const job = (recommendation.job ?? {}) as NonNullable<LiveRecommendation["job"]> & Record<string, unknown>;
  const jobId = recommendation.jobId ?? job._id ?? generatedRecordId(undefined, "job", recommendation.rank - 1);
  const location = recommendation.location ?? job.location;
  const descriptionPlain = [
    job.descriptionPlain,
    recommendation.rationale,
    (recommendation.strengths ?? []).join(" "),
    (recommendation.risks ?? []).join(" "),
  ].filter((part): part is string => Boolean(part && part.trim().length > 0)).join("\n\n");

  return {
    id: jobId,
    title: recommendation.title ?? job.title ?? "Software Engineer",
    company: recommendation.company ?? job.company ?? "Unknown",
    location,
    isRemote: /\bremote\b/i.test(location ?? ""),
    workplaceType: /\bremote\b/i.test(location ?? "") ? "remote" : undefined,
    department: "department" in job && typeof job.department === "string" ? job.department : undefined,
    team: "team" in job && typeof job.team === "string" ? job.team : undefined,
    descriptionPlain,
    compensationSummary: recommendation.compensationSummary ?? job.compensationSummary,
    jobUrl: recommendation.jobUrl ?? job.jobUrl ?? "#",
  };
}

function toOmDemoRankingProfile(profileInput?: UserProfile | RankingProfile | null): RankingProfile {
  if (!profileInput) return toRichRankingProfile(DEMO_PROFILE);
  if ("links" in profileInput || "suggestions" in profileInput || "provenance" in profileInput) {
    return toRichRankingProfile(profileInput as UserProfile);
  }
  return profileInput as RankingProfile;
}

function omDemoRecommendations(): LiveRecommendation[] {
  const source = recommendations as LiveRecommendation[];
  const generated = Array.from({ length: OM_DEMO_RECOMMENDATION_COUNT }, (_, index) => {
    const base = source[index % source.length];
    return enrichRecommendation(base, organizationForIndex(index), index);
  });
  return generated
    .sort(compareOmDemoRecommendations)
    .map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }));
}

function organizationForIndex(index: number): OmDemoOrganization {
  const orgs = organizations as OmDemoOrganization[];
  return orgs[index % orgs.length];
}

function organizationForJobId(jobId: string | undefined): OmDemoOrganization {
  const index = recommendationIndexForJobId(jobId);
  return organizationForIndex(index >= 0 ? index : 0);
}

function recommendationIndexForJobId(jobId: string | undefined): number {
  if (!jobId) return -1;
  const generatedMatch = jobId.match(/--om-demo-(\d+)$/);
  if (generatedMatch) {
    return Math.max(0, Number(generatedMatch[1]) - 1);
  }
  return (recommendations as LiveRecommendation[]).findIndex((recommendation) => recommendation.jobId === jobId);
}

function logoMeta(org: OmDemoOrganization): OrganizationLogo {
  return {
    company: org.company,
    domain: org.domain,
    logoUrl: org.logoUrl,
    logoAlt: org.logoAlt,
    brandColor: org.brandColor,
    backgroundColor: org.backgroundColor,
    prestigeTag: org.prestigeTag,
    prestigeLine: org.prestigeLine,
  };
}

function generatedRecommendationByJobId(jobId: string) {
  const source = recommendations as LiveRecommendation[];
  const details = jobDetails as unknown as Array<JobDetail>;
  for (let index = 0; index < OM_DEMO_RECOMMENDATION_COUNT; index += 1) {
    const base = source[index % source.length];
    const generatedId = generatedJobId(base.jobId, index);
    if (generatedId !== jobId && base.jobId !== jobId) continue;
    const baseDetail =
      details.find((detail) => detail.job?._id === base.jobId || detail.recommendation?.jobId === base.jobId) ??
      details[index % details.length];
    const org = organizationForIndex(index);
    const recommendation =
      omDemoRecommendations().find((candidate) => candidate.jobId === jobId) ??
      enrichRecommendation(base, org, index);
    return { baseDetail, org, recommendation };
  }
  return null;
}

function enrichRecommendation(
  recommendation: LiveRecommendation,
  org: OmDemoOrganization,
  index: number,
): LiveRecommendation {
  const organization = logoMeta(org);
  const score = scoreForIndex(org.score, index);
  const title = roleTitleForIndex(org, index);
  const jobId = generatedJobId(recommendation.jobId, index);
  const jobUrl = generatedJobUrl(org, index);

  return {
    ...recommendation,
    _id: generatedRecordId(recommendation._id, "rec", index),
    jobId,
    rank: index + 1,
    company: org.company,
    title,
    location: locationForIndex(org.location, index),
    jobUrl,
    compensationSummary: compensationForIndex(org.compensationSummary, index),
    score,
    llmScore: score,
    rationale: score >= 72 ? org.rationale : ruledOutRationale(org),
    strengths: score >= 72 ? rotateList(org.strengths, index).slice(0, 3) : [],
    risks: score >= 72 ? rotateList(org.risks, index).slice(0, 2) : ruledOutRisks(org),
    organization,
    job: recommendation.job
      ? enrichJob(recommendation.job, org, { jobId, title, score, index, jobUrl })
      : recommendation.job,
  };
}

function enrichJob<T extends NonNullable<LiveRecommendation["job"]> | NonNullable<JobDetail["job"]>>(
  job: T,
  org: OmDemoOrganization,
  generated?: { jobId: string; title: string; score: number; index: number; jobUrl: string },
): T {
  const index = generated?.index ?? 0;
  const title = generated?.title ?? roleTitleForIndex(org, index);
  const jobUrl = generated?.jobUrl ?? generatedJobUrl(org, index);
  return {
    ...job,
    _id: generated?.jobId ?? job._id,
    company: org.company,
    title,
    roleTitle: title,
    location: locationForIndex(org.location, index),
    jobUrl,
    applyUrl: `${jobUrl}${jobUrl.includes("?") ? "&" : "?"}apply=1`,
    sourceSlug: org.sourceSlug,
    compensationSummary: compensationForIndex(org.compensationSummary, index),
    department: "AI Platforms",
    team: org.prestigeTag ?? "Strategic AI",
    descriptionPlain: demoDescription(org, title),
    organization: logoMeta(org),
  } as T;
}

function enrichJobDetail(detail: JobDetail): JobDetail {
  const org = organizationForJobId(detail.recommendation?.jobId ?? detail.job?._id);
  const index = recommendationIndexForJobId(detail.recommendation?.jobId ?? detail.job?._id);
  const baseRecommendation = detail.recommendation ?? (recommendations as LiveRecommendation[])[Math.max(0, index)];
  const jobId = detail.recommendation?.jobId ?? detail.job?._id;
  const recommendation =
    omDemoRecommendations().find((candidate) => candidate.jobId === jobId) ??
    enrichRecommendation(baseRecommendation, org, Math.max(0, index));
  return enrichJobDetailFromGenerated(detail, org, recommendation);
}

function enrichJobDetailFromGenerated(
  detail: JobDetail,
  org: OmDemoOrganization,
  recommendation: LiveRecommendation,
): JobDetail {
  const score = recommendation.score;
  const ranked = recommendation as RankedLiveRecommendation;
  const title = recommendation.title;
  const jobUrl = recommendation.jobUrl;
  const originalIndex = recommendationIndexForJobId(recommendation.jobId ?? detail.job?._id);
  const index = originalIndex >= 0 ? originalIndex : Math.max(0, recommendation.rank - 1);
  return {
    ...detail,
    job: detail.job ? enrichJob(detail.job, org, {
      jobId: recommendation.jobId ?? detail.job._id,
      title,
      score,
      index,
      jobUrl,
    }) : detail.job,
    recommendation,
    score: detail.score
      ? {
          ...detail.score,
          totalScore: score,
          llmScore: recommendation.llmScore ?? score,
          rationale: recommendation.rationale,
          strengths: recommendation.strengths,
          risks: recommendation.risks,
          scoringMode: ranked.scoringMode ?? detail.score.scoringMode,
        }
      : detail.score,
    tailoredApplication: detail.tailoredApplication
      ? {
          ...detail.tailoredApplication,
          research: detail.tailoredApplication.research
            ? {
                ...detail.tailoredApplication.research,
                company: org.company,
                role: title,
                jobUrl,
                companyMission: org.mission,
                companyProducts: org.products,
                jdSummary: `${title} at ${org.company}. ${org.prestigeLine}`,
                techStack: org.techStack,
              }
            : detail.tailoredApplication.research,
        }
      : detail.tailoredApplication,
    artifacts: detail.artifacts?.map((artifact) => {
      if (artifact.kind !== "research_snapshot" || !artifact.payload || typeof artifact.payload !== "object") {
        return artifact;
      }
      return {
        ...artifact,
        payload: {
          ...(artifact.payload as Record<string, unknown>),
          company: org.company,
          role: title,
          jobUrl,
          companyMission: org.mission,
          companyProducts: org.products,
          jdSummary: `${title} at ${org.company}. ${org.prestigeLine}`,
          techStack: org.techStack,
        },
      };
    }),
  };
}

const ROLE_TITLES = [
  "Product Engineer, Agent Workflows",
  "Software Engineer, AI Product Platform",
  "Full Stack Engineer, AI Automation",
  "Software Engineer, LLM Evaluation Tools",
  "Product Engineer, Developer AI",
  "Software Engineer, Browser Automation",
  "AI Platform Engineer, Application Workflows",
  "Frontend Engineer, AI Interfaces",
  "Data Platform Engineer, Recommendation Quality",
  "Forward Deployed AI Engineer",
] as const;

const LOCATIONS = [
  "San Francisco, CA",
  "New York, NY",
  "Seattle, WA",
  "Mountain View, CA",
  "Cupertino, CA",
  "London, UK",
  "Toronto, Canada",
  "Remote, US",
  "Hybrid",
] as const;

function roleTitleForIndex(org: OmDemoOrganization, index: number) {
  if (index < (organizations as OmDemoOrganization[]).length) return org.title;
  return ROLE_TITLES[index % ROLE_TITLES.length];
}

function locationForIndex(fallback: string, index: number) {
  return index < (organizations as OmDemoOrganization[]).length ? fallback : LOCATIONS[index % LOCATIONS.length];
}

function compensationForIndex(base: string, index: number) {
  if (index < (organizations as OmDemoOrganization[]).length) return base;
  const low = 145 + ((index * 7) % 90);
  const high = low + 70 + ((index * 11) % 55);
  return `$${low}K - $${high}K + equity`;
}

function scoreForIndex(base: number, index: number) {
  if (index < (organizations as OmDemoOrganization[]).length) return base;
  const generatedBase = Math.min(base - 8, 90);
  const decay = Math.floor(index / (organizations as OmDemoOrganization[]).length) * 5;
  const jitter = ((index * 17) % 9) - 4;
  return Math.max(42, Math.min(90, generatedBase - decay + jitter));
}

function compareOmDemoRecommendations(left: LiveRecommendation, right: LiveRecommendation) {
  return right.score - left.score || left.rank - right.rank;
}

function generatedJobId(jobId: string | undefined, index: number) {
  const base = jobId || "job";
  return index === 0 ? base : `${base}--om-demo-${index + 1}`;
}

function generatedRecordId(id: string | undefined, prefix: string, index: number) {
  return index === 0 && id ? id : `${prefix}--om-demo-${index + 1}`;
}

function generatedJobUrl(org: OmDemoOrganization, index: number) {
  const pageSlug = OM_DEMO_COMPANY_PAGE_SLUGS[org.sourceSlug];
  const baseUrl = pageSlug ? `${OM_DEMO_COMPANY_PAGE_BASE_URL}/${pageSlug}` : org.jobUrl;
  if (index === 0) return baseUrl;
  return `${baseUrl.replace(/\/+$/, "")}?demoRole=${index + 1}`;
}

function rotateList<T>(items: T[], index: number): T[] {
  if (items.length === 0) return items;
  const offset = index % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function ruledOutRationale(org: OmDemoOrganization) {
  return `${org.company} is prestigious, but this generated role is deprioritized because the match is weaker than the top OM demo recommendations.`;
}

function ruledOutRisks(org: OmDemoOrganization) {
  return [
    `Lower evidence match for ${org.prestigeTag ?? "this team"} scope.`,
    "Would need a sharper resume angle before applying.",
  ];
}

function omDemoPipelineLogs(
  enrichedRecommendations: LiveRecommendation[],
  ranking?: {
    mode: string;
    telemetry?: V2Telemetry;
  }
): LivePipelineLog[] {
  const byJobId = new Map(enrichedRecommendations.map((recommendation) => [recommendation.jobId, recommendation]));
  for (const recommendation of enrichedRecommendations) {
    const originalId = recommendation.jobId?.replace(/--om-demo-\d+$/, "");
    if (originalId && !byJobId.has(originalId)) byJobId.set(originalId, recommendation);
  }
  const originalByJobId = new Map(
    (recommendations as LiveRecommendation[]).map((recommendation) => [recommendation.jobId, recommendation])
  );

  const rewrittenLogs = (pipelineLogs as LivePipelineLog[]).map((log) => {
    const payload = rewriteLogPayload(log.payload, byJobId);
    return {
      ...log,
      message: rewriteLogMessage(log.message, payload, byJobId, originalByJobId),
      payload,
    };
  });

  if (!ranking) return rewrittenLogs;

  const now = new Date().toISOString();
  const telemetry = ranking.telemetry;
  const top = enrichedRecommendations[0];
  const fallbackWarnings: LivePipelineLog[] = [];
  if (telemetry && !telemetry.embeddingsAvailable) {
    fallbackWarnings.push({
      _id: "om-demo-ranking-embeddings-fallback",
      createdAt: now,
      stage: "ranking",
      level: "warning",
      message: "Embeddings unavailable for OM demo ranking; v2 fell back to BM25-only retrieval.",
      payload: { error: telemetry.embeddingError },
    });
  }
  if (telemetry && !telemetry.rerankUsed) {
    fallbackWarnings.push({
      _id: "om-demo-ranking-rerank-fallback",
      createdAt: now,
      stage: "scoring",
      level: "warning",
      message: "Cohere rerank unavailable for OM demo ranking; v2 used fused retrieval score.",
      payload: { error: telemetry.rerankError },
    });
  }

  return [
    {
      _id: "om-demo-ranking-v2",
      createdAt: now,
      stage: "ranking",
      level: "success",
      message: `Ranked ${enrichedRecommendations.length} OM demo jobs with ${ranking.mode}.`,
      payload: {
        mode: ranking.mode,
        topJobId: top?.jobId,
        topCompany: top?.company,
        topTitle: top?.title,
        topScore: top?.score,
        embeddingMs: telemetry?.embedDurationMs,
        rerankMs: telemetry?.rerankDurationMs,
        rationaleMs: telemetry?.rationaleDurationMs,
      },
    },
    ...fallbackWarnings,
    ...rewrittenLogs,
  ];
}

function rewriteLogPayload(
  payload: unknown,
  byJobId: Map<string | undefined, LiveRecommendation>,
): unknown {
  if (Array.isArray(payload)) {
    return payload.map((item) => rewriteLogPayload(item, byJobId));
  }
  if (!payload || typeof payload !== "object") return payload;

  const source = payload as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    next[key] = rewriteLogPayload(value, byJobId);
  }

  const jobId = typeof source.jobId === "string" ? source.jobId : undefined;
  const recommendation = byJobId.get(jobId);
  if (recommendation) {
    if ("company" in source) next.company = recommendation.company;
    if ("title" in source) next.title = recommendation.title;
    if ("jobUrl" in source) next.jobUrl = recommendation.jobUrl;
    if ("score" in source) next.score = recommendation.score;
  } else if (typeof source.company === "string") {
    next.company = fetchCompanyReplacement(source.company);
  }

  return next;
}

function rewriteLogMessage(
  message: string,
  payload: unknown,
  byJobId: Map<string | undefined, LiveRecommendation>,
  originalByJobId: Map<string | undefined, LiveRecommendation>,
): string {
  const rawJobId = payload && typeof payload === "object" && "jobId" in payload
    ? (payload as { jobId?: string }).jobId
    : undefined;
  const jobId = typeof rawJobId === "string" ? rawJobId : undefined;
  const recommendation = byJobId.get(jobId);
  const original = originalByJobId.get(jobId);
  if (recommendation && original) {
    return message
      .replace(`${original.company} - ${original.title}`, `${recommendation.company} - ${recommendation.title}`)
      .replace(original.company, recommendation.company)
      .replace(original.title, recommendation.title);
  }

  return message
    .replaceAll("Aleph Alpha", "Google DeepMind")
    .replaceAll("Cohere", "OpenAI")
    .replaceAll("Clay Labs", "Apple")
    .replaceAll("Causaly", "NVIDIA")
    .replaceAll("Attio", "Meta")
    .replaceAll("Bland AI", "Microsoft AI");
}

function fetchCompanyReplacement(company: string) {
  const replacements: Record<string, string> = {
    "Aleph Alpha": "Google DeepMind",
    Cohere: "OpenAI",
    "Clay Labs": "Apple",
    Causaly: "NVIDIA",
    Attio: "Meta",
    "Bland AI": "Microsoft AI",
  };
  return replacements[company] ?? company;
}

function demoDescription(org: OmDemoOrganization, title = org.title) {
  return [
    `${org.company} is hiring for ${title}.`,
    org.prestigeLine,
    `Mission: ${org.mission}`,
    `Products: ${org.products.join(", ")}.`,
    `The role focuses on ${org.techStack.slice(0, 4).join(", ")} and shipping reliable AI systems at company scale.`,
    "This is seeded OM demo data, not a live job posting.",
  ].join("\n\n");
}

const omDemoTailoredCache = new Map<string, { filename: string; application: TailoredApplication }>();

export function omDemoTailoredApplication(
  jobId: string,
): { filename: string; application: TailoredApplication } | null {
  const cached = omDemoTailoredCache.get(jobId);
  if (cached) return cached;

  const detail = omDemoJobDetail(jobId);
  if (!detail) return null;
  const sourceJob = detail.job;
  if (!sourceJob) return null;

  const job: Job = {
    id: jobId,
    company: sourceJob.company,
    role: sourceJob.title,
    jobUrl: sourceJob.jobUrl,
    location: sourceJob.location,
    descriptionPlain: sourceJob.descriptionPlain,
  };

  const fixtureApp = (detail.tailoredApplication ?? {}) as Record<string, unknown>;
  const fixtureResume = fixtureApp.tailoredResume as Partial<TailoredResume> | undefined;
  const fixtureResearch = fixtureApp.research as
    | {
        source?: TailoredApplication["research"]["source"];
        jdSummary?: string;
        requirements?: unknown[];
        techStack?: unknown[];
      }
    | undefined;

  const org = organizationForJobId(jobId);
  const tailoredResume: TailoredResume = {
    name: DEMO_PROFILE.name ?? "Demo Candidate",
    email: DEMO_PROFILE.email ?? "demo@example.com",
    location: DEMO_PROFILE.location,
    links: {
      github: DEMO_PROFILE.links.github,
      linkedin: DEMO_PROFILE.links.linkedin,
      website: DEMO_PROFILE.links.website,
    },
    headline: fixtureResume?.headline ?? `${DEMO_PROFILE.headline} — ${job.role} at ${job.company}`,
    summary:
      fixtureResume?.summary ??
      `${DEMO_PROFILE.summary} Aligned with ${job.company}'s focus on ${org.products.slice(0, 2).join(" and ")}.`,
    skills:
      fixtureResume?.skills && fixtureResume.skills.length > 0
        ? fixtureResume.skills
        : Array.from(new Set([...DEMO_PROFILE.skills, ...org.techStack])).slice(0, 12),
    experience: fixtureResume?.experience ?? [],
    education: fixtureResume?.education ?? [],
    projects: fixtureResume?.projects ?? [],
    coverLetterBlurb:
      fixtureResume?.coverLetterBlurb ??
      `Excited to contribute to ${job.company}'s ${org.products[0] ?? "platform"} as ${job.role}.`,
    tailoringNotes: fixtureResume?.tailoringNotes ?? {
      matchedKeywords: org.techStack.slice(0, 6),
      emphasizedExperience: DEMO_PROFILE.experience.map((exp) => `${exp.title} at ${exp.company}`),
      gaps: [],
      confidence: 0.86,
    },
  };

  const research: TailoredApplication["research"] = {
    source: fixtureResearch?.source ?? "ingested-description",
    summary:
      fixtureResearch?.jdSummary ?? `${job.role} at ${job.company}. ${org.prestigeLine}`,
    requirementsCount: Array.isArray(fixtureResearch?.requirements)
      ? fixtureResearch.requirements.length
      : 6,
    techStackCount: Array.isArray(fixtureResearch?.techStack)
      ? fixtureResearch.techStack.length
      : org.techStack.length,
  };

  const pdfBytes = textToPdf(resumeFallbackText(tailoredResume));
  const pdfBase64 = toBase64(pdfBytes);
  const safeCompany = job.company.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const filename = `Resume_${safeCompany || "Tailored"}.pdf`;

  const tailoringScore =
    typeof fixtureApp.tailoringScore === "number" ? fixtureApp.tailoringScore : 86;
  const keywordCoverage =
    typeof fixtureApp.keywordCoverage === "number" ? fixtureApp.keywordCoverage : 0.78;
  const durationMs =
    typeof fixtureApp.durationMs === "number" ? fixtureApp.durationMs : 4200;

  const application: TailoredApplication = {
    jobId,
    job,
    research,
    tailoredResume,
    pdfBase64,
    tailoringScore,
    keywordCoverage,
    durationMs,
  };

  const result = { filename, application };
  omDemoTailoredCache.set(jobId, result);
  return result;
}

export function omDemoTailoredPdf(
  jobId: string,
): { filename: string; base64: string } | null {
  const tailored = omDemoTailoredApplication(jobId);
  if (!tailored) return null;
  return { filename: tailored.filename, base64: tailored.application.pdfBase64 };
}
