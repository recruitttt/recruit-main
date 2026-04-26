import dashboardSummary from "@/data/om-demo/dashboard-summary.json";
import jobDetails from "@/data/om-demo/job-details.json";
import manifest from "@/data/om-demo/manifest.json";
import organizations from "@/data/om-demo/organizations.json";
import pipelineLogs from "@/data/om-demo/pipeline-logs.json";
import recommendations from "@/data/om-demo/recommendations.json";
import verification from "@/data/om-demo/verification.json";
import type {
  JobDetail,
  LivePipelineLog,
  LiveRecommendation,
  LiveRunSummary,
  OrganizationLogo,
} from "@/components/dashboard/dashboard-types";

export const OM_DEMO_USER_ID = "om-demo";
const OM_DEMO_RECOMMENDATION_COUNT = 100;
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

export function shouldUseOmDemoData() {
  return process.env.DASHBOARD_DATA_SOURCE !== "convex";
}

export function omDemoLivePayload() {
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
    return enrichJobDetailFromGenerated(demo.baseDetail, demo.org, demo.recommendation);
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

function omDemoRecommendations(): LiveRecommendation[] {
  const source = recommendations as LiveRecommendation[];
  return Array.from({ length: OM_DEMO_RECOMMENDATION_COUNT }, (_, index) => {
    const base = source[index % source.length];
    return enrichRecommendation(base, organizationForIndex(index), index);
  });
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
    const recommendation = enrichRecommendation(base, org, index);
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
  const recommendation = enrichRecommendation(baseRecommendation, org, Math.max(0, index));
  return enrichJobDetailFromGenerated(detail, org, recommendation);
}

function enrichJobDetailFromGenerated(
  detail: JobDetail,
  org: OmDemoOrganization,
  recommendation: LiveRecommendation,
): JobDetail {
  const score = recommendation.score;
  const title = recommendation.title;
  const jobUrl = recommendation.jobUrl;
  const index = Math.max(0, recommendation.rank - 1);
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
          llmScore: score,
          rationale: recommendation.rationale,
          strengths: recommendation.strengths,
          risks: recommendation.risks,
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
  "Staff Software Engineer, Agent Platform",
  "Machine Learning Engineer, Product Intelligence",
  "Senior AI Infrastructure Engineer",
  "Product Engineer, Applied AI",
  "Research Engineer, Evaluation Systems",
  "Software Engineer, Developer AI",
  "Applied Scientist, Retrieval Agents",
  "Full Stack Engineer, AI Workflows",
  "Data Platform Engineer, Model Quality",
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
  const decay = Math.floor(index / 8) * 3;
  const jitter = ((index * 17) % 9) - 4;
  return Math.max(42, Math.min(98, base - decay + jitter));
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

function omDemoPipelineLogs(enrichedRecommendations: LiveRecommendation[]): LivePipelineLog[] {
  const byJobId = new Map(enrichedRecommendations.map((recommendation) => [recommendation.jobId, recommendation]));
  for (const recommendation of enrichedRecommendations) {
    const originalId = recommendation.jobId?.replace(/--om-demo-\d+$/, "");
    if (originalId && !byJobId.has(originalId)) byJobId.set(originalId, recommendation);
  }
  const originalByJobId = new Map(
    (recommendations as LiveRecommendation[]).map((recommendation) => [recommendation.jobId, recommendation])
  );

  return (pipelineLogs as LivePipelineLog[]).map((log) => {
    const payload = rewriteLogPayload(log.payload, byJobId);
    return {
      ...log,
      message: rewriteLogMessage(log.message, payload, byJobId, originalByJobId),
      payload,
    };
  });
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
