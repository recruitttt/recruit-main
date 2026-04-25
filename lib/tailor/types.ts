// Shared types for the research → tailor → render → PDF pipeline.
// One job goes through both endpoints sequentially; the client
// orchestrator chains them and writes results to localStorage.

import type { UserProfile } from "@/lib/profile";

export type Job = {
  id: string;
  company: string;
  role: string;
  jobUrl: string;
  location?: string;
  logoBg?: string;
  logoText?: string;
};

export type JobResearch = {
  jobUrl: string;
  company: string;
  role: string;
  jdSummary: string;
  responsibilities: string[];
  requirements: string[];
  niceToHaves: string[];
  techStack: string[];
  companyMission: string;
  companyProducts: string[];
  cultureSignals: string[];
  recentNews?: string[];
  source: "deep-research" | "firecrawl-fallback" | "title-only";
  modelDurationMs: number;
};

export type TailoredExperience = {
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  bullets: string[];
};

export type TailoredEducation = {
  school: string;
  degree?: string;
  field?: string;
  endDate?: string;
};

export type TailoringNotes = {
  matchedKeywords: string[];
  emphasizedExperience: string[];
  gaps: string[];
  confidence: number;
};

export type TailoredResume = {
  name: string;
  email: string;
  location?: string;
  links: { github?: string; linkedin?: string; website?: string };
  headline: string;
  summary: string;
  skills: string[];
  experience: TailoredExperience[];
  education: TailoredEducation[];
  coverLetterBlurb?: string;
  tailoringNotes: TailoringNotes;
};

export type TailoredApplication = {
  jobId: string;
  job: Job;
  research: {
    source: JobResearch["source"];
    summary: string;
    requirementsCount: number;
    techStackCount: number;
  };
  tailoredResume: TailoredResume;
  pdfBase64: string;
  tailoringScore: number;
  keywordCoverage: number;
  durationMs: number;
};

export type PipelineEvent =
  | { type: "queued"; jobId: string; jobIndex: number }
  | { type: "skipped"; jobId: string; cached: TailoredApplication }
  | { type: "research-start"; jobId: string }
  | { type: "research-done"; jobId: string; research: JobResearch }
  | { type: "tailor-start"; jobId: string }
  | { type: "tailor-done"; jobId: string; application: TailoredApplication }
  | { type: "error"; jobId: string; phase: "research" | "tailor"; reason: string }
  | { type: "complete"; results: TailoredApplication[] };

export type ResearchRequest = { job: Job };
export type ResearchResponse =
  | { ok: true; research: JobResearch }
  | { ok: false; reason: string };

export type TailorRequest = { profile: UserProfile; research: JobResearch };
export type TailorResponse =
  | { ok: true; application: Omit<TailoredApplication, "jobId" | "job"> & { jobId: string; job: Job } }
  | { ok: false; reason: string };
