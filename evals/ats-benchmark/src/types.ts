import type { TailoredResume } from "@/lib/tailor/types";

export const RUN_PROFILES = {
  smoke: 50,
  standard: 200,
  full: 1000,
} as const;

export type RunProfile = keyof typeof RUN_PROFILES;

export type BenchmarkSample = {
  sampleId: string;
  source: string;
  resumeText: string;
  jobDescription: string;
  minimumRequirements: string[];
  referenceScore?: number;
  referenceLabel?: "match" | "partial" | "mismatch";
  valid: boolean;
  roleFamily?: string;
  metadata?: BenchmarkMetadata;
};

export type BenchmarkMetadata = {
  sourceFile?: string;
  details?: Record<string, unknown>;
  personalInfo?: Record<string, unknown>;
  structuredProfile?: {
    hasStructuredProfile: boolean;
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    currentCompany?: string;
    currentPosition?: string;
    skills: string[];
    employers: string[];
    projects: string[];
  };
  dataQuality?: {
    resumeLooksLikeJobDescription: boolean;
    missingStructuredProfile: boolean;
    reasons: string[];
  };
};

export type JobKeywords = {
  required_skills?: string[];
  preferred_skills?: string[];
  keywords?: string[];
  key_responsibilities?: string[];
  [key: string]: unknown;
};

export type AtsScoreBreakdown = {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  requiredScore: number;
  preferredScore: number;
  keywordScore: number;
  totalKeywords: number;
  flags: string[];
};

export type BenchmarkResult = {
  sampleId: string;
  source: string;
  roleFamily?: string;
  valid: boolean;
  baselineScore: number;
  recruitScore?: number;
  resumeMatcherScore?: number;
  scoreDelta?: number;
  referenceScore?: number;
  referenceLabel?: string;
  keywordCount: number;
  matchedBefore: number;
  matchedAfter?: number;
  qualityIssues: string[];
  status: "scored" | "tailored" | "failed" | "skipped";
  errors: string[];
  skipReason?: string;
  tailoredResume?: TailoredResume;
};

export type RankingRow = {
  anchorJobId: string;
  sampleId: string;
  baselineScore: number;
  recruitScore: number;
  baselineRank: number;
  recruitRank: number;
  rankDelta: number;
};

export type BenchmarkSummary = {
  ok: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  profile: RunProfile;
  sampleCount: number;
  validSampleCount: number;
  skippedCount: number;
  failedCount: number;
  tailoredCount: number;
  averageBaselineScore: number;
  medianBaselineScore: number;
  averageRecruitScore: number;
  medianRecruitScore: number;
  averageScoreDelta: number;
  medianScoreDelta: number;
  averageRankDelta: number;
  top10Entrants: number;
  top25Entrants: number;
  sidecarFailures: number;
  recruitTailoringFailures: number;
  invalidResumeLikeJob: number;
  missingStructuredProfile: number;
  validationHardFailures: number;
  validationPenaltyRate: number;
  cacheHits: number;
};

export type BenchmarkRunArtifacts = {
  summary: BenchmarkSummary;
  results: BenchmarkResult[];
  rankings: RankingRow[];
  runDir: string;
};

export type BenchmarkOptions = {
  profile: RunProfile;
  inputPath: string;
  outputRoot: string;
  scorer: "resume-matcher";
  tailor: "none" | "recruit";
  resumeMatcherUrl: string;
  useSidecar: boolean;
  includeResumeMatcherTailor: boolean;
  concurrency: number;
  now?: Date;
};
