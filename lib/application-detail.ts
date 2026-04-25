import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import {
  mockApplications,
  mockMappedQuestions,
  mockPersonaReviews,
  type MappedQuestion,
  type PersonaReview,
  type Stage,
} from "@/lib/mock-data";

export type ApplicationDetailEvent = {
  id: string;
  time: string;
  stage: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  evidence?: string;
};

export type ApplicationDetailArtifact = {
  title: string;
  meta: string;
  kind: "file" | "preview" | "attachment";
};

export type ApplicationDetailSummary = {
  label: string;
  value: string;
};

export type ApplicationDetailModel = {
  id: string;
  source: "seeded" | "live" | "fallback";
  notice?: string;
  company: string;
  role: string;
  location: string;
  provider: "Ashby" | "Greenhouse" | "Lever" | "Workday" | "Unknown";
  stage: Stage;
  matchScore: number | null;
  tailoringScore: number | null;
  startedAt: string;
  jobUrl: string;
  salaryRange?: string;
  logoBg: string;
  logoText: string;
  questions: MappedQuestion[];
  questionSummary: string;
  cacheReuseCount: number | null;
  personaReviews: PersonaReview[];
  artifacts: ApplicationDetailArtifact[];
  summary: ApplicationDetailSummary[];
  events: ApplicationDetailEvent[];
  browserEvidence: {
    tone: "Recorded" | "Live-ready" | "Seeded";
    label: string;
    detail: string;
    url?: string;
  };
  submitEvidence: {
    status: string;
    tone: "success" | "warn" | "neutral";
    detail: string;
  };
};

type LiveJobDetail = {
  job?: {
    _id: string;
    runId?: string;
    company: string;
    title: string;
    location?: string;
    jobUrl: string;
    compensationSummary?: string;
    department?: string;
    team?: string;
  } | null;
  score?: {
    totalScore?: number;
    llmScore?: number;
    rationale?: string;
    strengths?: string[];
    risks?: string[];
    scoringMode?: string;
  } | null;
  recommendation?: {
    score?: number;
    rank?: number;
    rationale?: string;
    strengths?: string[];
    risks?: string[];
  } | null;
  tailoredApplication?: {
    status: "tailoring" | "completed" | "failed";
    tailoredResume?: {
      summary?: string;
      skills?: string[];
      tailoringNotes?: {
        matchedKeywords?: string[];
        emphasizedExperience?: string[];
        gaps?: string[];
        confidence?: number;
      };
    };
    research?: {
      source?: string;
      summary?: string;
      requirementsCount?: number;
      techStackCount?: number;
    };
    tailoringScore?: number;
    keywordCoverage?: number;
    pdfReady: boolean;
    pdfFilename?: string;
    pdfByteLength?: number;
    error?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  artifacts?: Array<{
    _id: string;
    kind: string;
    title: string;
    content?: string;
    payload?: unknown;
    createdAt: string;
  }>;
};

type PipelineLog = {
  _id?: string;
  stage: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  payload?: unknown;
  createdAt: string;
};

const DEMO_STARTED_AT = new Date(Date.now() - 1000 * 60 * 12).toISOString();

export async function getApplicationDetail(id: string): Promise<ApplicationDetailModel> {
  const seeded = mockApplications.find((application) => application.id === id);
  if (seeded) return seededDetail(seeded);

  const client = getConvexClient();
  if (!client) return fallbackDetail(id, "Convex is not configured, so this live application detail is shown as a fallback shell.");

  try {
    const detail = await client.query(api.ashby.jobDetail, { jobId: id as never }) as LiveJobDetail | null;
    if (!detail?.job) return fallbackDetail(id, "No live Convex application record was found for this id.");

    const logs = await client.query(
      api.ashby.latestPipelineLogs,
      detail.job.runId ? { runId: detail.job.runId as never, limit: 40 } : { limit: 40 }
    ) as PipelineLog[];

    return liveDetail(id, detail, logs);
  } catch (err) {
    return fallbackDetail(
      id,
      `Live Convex detail could not be loaded: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function seededDetail(application: typeof mockApplications[number]): ApplicationDetailModel {
  return {
    id: application.id,
    source: "seeded",
    company: application.company,
    role: application.role,
    location: application.location,
    provider: application.provider,
    stage: application.stage,
    matchScore: application.matchScore,
    tailoringScore: application.tailoringScore || null,
    startedAt: application.startedAt,
    jobUrl: application.jobUrl,
    salaryRange: application.salaryRange,
    logoBg: application.logoBg,
    logoText: application.logoText,
    questions: mockMappedQuestions,
    questionSummary: `${mockMappedQuestions.filter((q) => q.verified).length} of ${mockMappedQuestions.length} seeded answers verified`,
    cacheReuseCount: mockMappedQuestions.filter((q) => q.source === "cache").length,
    personaReviews: mockPersonaReviews,
    artifacts: [
      {
        title: `mo-hoshir-${application.company.toLowerCase()}.pdf`,
        meta: "Tailored PDF - 2 pages - 184 KB",
        kind: "file",
      },
      { title: "Before/after resume summary", meta: "Seeded artifact", kind: "preview" },
      { title: "Submit evidence", meta: "Recorded seeded classification", kind: "attachment" },
    ],
    summary: [
      { label: "Bullets reordered", value: "7" },
      { label: "Skills emphasized", value: "+4" },
      { label: "Question source", value: "Seeded Ashby map" },
      { label: "Evidence mode", value: "Replayable fallback" },
    ],
    events: [
      {
        id: "seeded-discovery",
        time: application.startedAt,
        stage: "discovery",
        level: "success",
        message: "Discovered Ashby form and mapped required questions.",
        evidence: "seed",
      },
      {
        id: "seeded-artifact",
        time: application.lastEventAt,
        stage: "artifact",
        level: "success",
        message: "Attached tailored resume artifact and prepared submit evidence.",
        evidence: "artifact",
      },
      {
        id: "seeded-submit",
        time: application.lastEventAt,
        stage: "submit",
        level: application.stage === "blocked" ? "warning" : "success",
        message: application.stage === "submitted"
          ? "Submission classified as confirmed in seeded replay."
          : "Submit evidence is staged for demo replay.",
        evidence: "classification",
      },
    ],
    browserEvidence: {
      tone: "Recorded",
      label: "Browserbase seeded replay",
      detail: "Recording placeholder mirrors the live provider evidence contract.",
    },
    submitEvidence: application.stage === "submitted"
      ? {
          status: "confirmed",
          tone: "success",
          detail: "Seeded replay includes confirmed submit evidence.",
        }
      : {
          status: "pending seeded replay",
          tone: "warn",
          detail: "Submit classification is not treated as confirmed until evidence is present.",
        },
  };
}

function liveDetail(id: string, detail: LiveJobDetail, logs: PipelineLog[]): ApplicationDetailModel {
  const job = detail.job;
  if (!job) return fallbackDetail(id, "Live application detail is missing its job record.");

  const tailored = detail.tailoredApplication;
  const stage = liveStage(tailored?.status);
  const score = detail.score?.totalScore ?? detail.recommendation?.score ?? null;
  const artifactList = liveArtifacts(detail);
  const eventList = logs.slice(-12).map((log, index) => ({
    id: log._id ?? `live-log-${index}`,
    time: log.createdAt,
    stage: log.stage,
    level: log.level,
    message: log.message,
    evidence: log.stage,
  }));

  return {
    id,
    source: "live",
    company: job.company,
    role: job.title,
    location: job.location ?? "Location not specified",
    provider: "Ashby",
    stage,
    matchScore: score,
    tailoringScore: tailored?.tailoringScore ?? null,
    startedAt: tailored?.createdAt ?? logs[0]?.createdAt ?? DEMO_STARTED_AT,
    jobUrl: job.jobUrl,
    salaryRange: job.compensationSummary,
    logoBg: logoColor(job.company),
    logoText: job.company.slice(0, 1).toUpperCase(),
    questions: [],
    questionSummary: "0 live provider questions captured",
    cacheReuseCount: null,
    personaReviews: [],
    artifacts: artifactList,
    summary: liveSummary(detail),
    events: eventList.length > 0 ? eventList : [
      {
        id: "live-empty",
        time: new Date().toISOString(),
        stage: "read-model",
        level: "info",
        message: "Live job detail loaded; no pipeline logs were available for this run.",
        evidence: "convex",
      },
    ],
    browserEvidence: {
      tone: "Live-ready",
      label: "Provider evidence pending",
      detail: "Browserbase recording/live-view is not persisted in this bridge yet.",
    },
    submitEvidence: {
      status: tailored?.status === "failed" ? "blocked before submit" : "pending provider run",
      tone: tailored?.status === "failed" ? "warn" : "neutral",
      detail: tailored?.status === "failed"
        ? tailored.error ?? "Tailoring failed before provider execution."
        : "No submit classifier record exists yet, so this view does not claim a successful submit.",
    },
  };
}

function fallbackDetail(id: string, notice: string): ApplicationDetailModel {
  return {
    id,
    source: "fallback",
    notice,
    company: "Live application",
    role: "Application detail pending",
    location: "Convex read model unavailable",
    provider: "Unknown",
    stage: "queued",
    matchScore: null,
    tailoringScore: null,
    startedAt: DEMO_STARTED_AT,
    jobUrl: "#",
    logoBg: "#334155",
    logoText: "?",
    questions: [],
    questionSummary: "0 live provider questions captured",
    cacheReuseCount: null,
    personaReviews: [],
    artifacts: [{ title: "Live artifact pending", meta: "No Convex artifact loaded", kind: "preview" }],
    summary: [
      { label: "Read model", value: "Fallback" },
      { label: "Live id", value: id.slice(-10) },
      { label: "Submit status", value: "Not claimed" },
      { label: "Evidence mode", value: "Seeded fallback" },
    ],
    events: [
      {
        id: "fallback",
        time: new Date().toISOString(),
        stage: "read-model",
        level: "warning",
        message: notice,
        evidence: "fallback",
      },
    ],
    browserEvidence: {
      tone: "Seeded",
      label: "Fallback evidence shell",
      detail: "Live Browserbase evidence will appear after provider-run persistence is implemented.",
    },
    submitEvidence: {
      status: "not classified",
      tone: "neutral",
      detail: "No submit classifier record was loaded for this application.",
    },
  };
}

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

function liveStage(status?: "tailoring" | "completed" | "failed"): Stage {
  if (status === "failed") return "blocked";
  if (status === "completed") return "reviewing";
  if (status === "tailoring") return "tailoring";
  return "queued";
}

function liveArtifacts(detail: LiveJobDetail): ApplicationDetailArtifact[] {
  const artifacts: ApplicationDetailArtifact[] = [];
  const tailored = detail.tailoredApplication;

  if (tailored?.pdfReady) {
    artifacts.push({
      title: tailored.pdfFilename ?? "Tailored resume PDF",
      meta: `PDF ready${typeof tailored.pdfByteLength === "number" ? ` - ${formatBytes(tailored.pdfByteLength)}` : ""}`,
      kind: "file",
    });
  }

  for (const artifact of detail.artifacts ?? []) {
    artifacts.push({
      title: artifact.title,
      meta: artifact.content ?? artifact.kind.replace(/_/g, " "),
      kind: artifact.kind === "pdf_ready" ? "file" : "preview",
    });
  }

  return artifacts.length > 0
    ? artifacts
    : [{ title: "Artifact pending", meta: "Tailoring has not produced a PDF yet", kind: "preview" }];
}

function liveSummary(detail: LiveJobDetail): ApplicationDetailSummary[] {
  const tailored = detail.tailoredApplication;
  const notes = tailored?.tailoredResume?.tailoringNotes;
  return [
    {
      label: "Matched keywords",
      value: String(notes?.matchedKeywords?.length ?? detail.score?.strengths?.length ?? 0),
    },
    {
      label: "Experience emphasized",
      value: String(notes?.emphasizedExperience?.length ?? 0),
    },
    {
      label: "Known gaps",
      value: String(notes?.gaps?.length ?? detail.score?.risks?.length ?? 0),
    },
    {
      label: "Research source",
      value: tailored?.research?.source ?? detail.score?.scoringMode ?? "ranking",
    },
  ];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function logoColor(input: string): string {
  const colors = ["#0f766e", "#2563eb", "#7c3aed", "#be123c", "#b45309", "#4338ca"];
  const index = input.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}
