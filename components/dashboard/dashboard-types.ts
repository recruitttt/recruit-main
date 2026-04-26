import type { JobResearch, TailoredApplication } from "@/lib/tailor/types";

export type LiveRunSummary = {
  _id: string;
  provider?: string;
  status: "fetching" | "fetched" | "ranking" | "completed" | "failed";
  originalStatus?: "fetching" | "fetched" | "ranking" | "completed" | "failed";
  stale?: boolean;
  staleReason?: string;
  suppressedLatestRun?: {
    _id: string;
    provider?: string;
    status: "fetching" | "fetched" | "ranking" | "completed" | "failed";
    startedAt: string;
    stale?: boolean;
  };
  startedAt: string;
  completedAt?: string;
  sourceCount: number;
  fetchedCount: number;
  rawJobCount: number;
  filteredCount: number;
  survivorCount: number;
  llmScoredCount: number;
  recommendedCount: number;
  errorCount: number;
  scoringMode?: string;
  tailoredCount?: number;
  tailoringAttemptedCount?: number;
  tailoringTargetCount?: number;
  tailoringInProgress?: boolean;
  hasCompletedTailoring?: boolean;
  recommendations?: LiveRecommendation[];
};

export type LiveRecommendation = {
  _id?: string;
  jobId?: string;
  company: string;
  title: string;
  location?: string;
  score: number;
  rank: number;
  jobUrl: string;
  compensationSummary?: string;
  rationale?: string;
  strengths?: string[];
  risks?: string[];
  job?: {
    _id?: string;
    company?: string;
    title?: string;
    location?: string;
    jobUrl?: string;
    sourceSlug?: string;
    descriptionPlain?: string;
    compensationSummary?: string;
  } | null;
};

export type JobDetail = {
  job?: {
    _id: string;
    runId?: string;
    sourceSlug?: string;
    company: string;
    title: string;
    location?: string;
    jobUrl: string;
    descriptionPlain?: string;
    compensationSummary?: string;
    department?: string;
    team?: string;
  };
  decision?: {
    status: "kept" | "rejected";
    reasons?: string[];
    ruleScore?: number;
  };
  score?: {
    totalScore: number;
    llmScore?: number;
    rationale?: string;
    strengths?: string[];
    risks?: string[];
    scoringMode?: string;
  };
  recommendation?: LiveRecommendation;
  tailoredApplication?: {
    status: "tailoring" | "completed" | "failed";
    tailoredResume?: TailoredApplication["tailoredResume"];
    research?: JobResearch;
    tailoringScore?: number;
    keywordCoverage?: number;
    pdfReady: boolean;
    pdfFilename?: string;
    pdfByteLength?: number;
    pdfBase64?: string;
    error?: string;
  };
  artifacts?: Array<{
    _id: string;
    kind:
      | "ingested_description"
      | "ranking_score"
      | "research_snapshot"
      | "tailored_resume"
      | "cover_letter"
      | "pdf_ready"
      | "pdf_file";
    title: string;
    content?: string;
    payload?: unknown;
    createdAt: string;
  }>;
};

export type TailorState = {
  running: boolean;
  message: string;
  error?: string;
  downloadable?: TailoredApplication;
};

export type DashboardRunControls = {
  canRun: boolean;
  busy: boolean;
  label: string;
  message?: string;
  error?: string;
  onRunFirst3?: () => void;
};

export type LiveDashboardPayload = {
  run: LiveRunSummary | null;
  recommendations: LiveRecommendation[];
};

export type LeaderboardRow = {
  key: string;
  jobId: string;
  rank: number;
  title: string;
  company: string;
  locationLabel: string;
  providerLabel: string;
  score: number;
  secondaryLine: string;
  statusLabel: string;
  statusTone: "neutral" | "active" | "success" | "warning" | "danger";
  actionLabel: string;
  recommendation: LiveRecommendation;
};
