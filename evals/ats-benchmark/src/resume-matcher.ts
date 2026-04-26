import { createHash } from "node:crypto";
import type { JobKeywords } from "./types";

// Structural fetch signature so test fixtures and other inline
// implementations don't have to match the full `typeof fetch` interface
// (which now requires `preconnect` under newer DOM lib types).
export type ResumeMatcherFetch = (
  input: URL | RequestInfo,
  init?: RequestInit,
) => Promise<Response>;

export type ResumeMatcherClientOptions = {
  baseUrl: string;
  fetchFn?: ResumeMatcherFetch;
};

export type ResumeMatcherAnalysis = {
  resumeId: string;
  jobId: string;
  jobKeywords: JobKeywords;
  cacheHit: boolean;
  tailoredMarkdown?: string;
  score?: number;
};

type CacheEntry = {
  jobKeywords: JobKeywords;
  tailoredMarkdown?: string;
  score?: number;
};

type JsonObject = Record<string, unknown>;

export class ResumeMatcherClient {
  private readonly baseUrl: string;
  private readonly fetchFn: ResumeMatcherFetch;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: ResumeMatcherClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async health(): Promise<boolean> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/v1/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async analyze(input: {
    sampleId: string;
    resumeText: string;
    jobDescription: string;
    includeTailoredPreview?: boolean;
  }): Promise<ResumeMatcherAnalysis> {
    const cacheKey = digest([input.resumeText, input.jobDescription, String(input.includeTailoredPreview)]);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        resumeId: `cached_resume_${input.sampleId}`,
        jobId: `cached_job_${input.sampleId}`,
        jobKeywords: cached.jobKeywords,
        tailoredMarkdown: cached.tailoredMarkdown,
        score: cached.score,
        cacheHit: true,
      };
    }

    const resumeId = await this.uploadResume(input.sampleId, input.resumeText);
    const jobId = await this.uploadJob(input.jobDescription, resumeId);
    const preview = await this.improvePreview(resumeId, jobId);
    const job = await this.getJob(jobId);
    const jobKeywords = parseJobKeywords(job.job_keywords) ?? parseJobKeywords(preview.job_keywords) ?? {};
    const previewData = recordAt(preview.data);
    const refinementStats = recordAt(previewData?.refinement_stats);
    const tailoredMarkdown = stringAt(previewData?.markdownImproved) ?? stringAt(preview.markdownImproved);
    const score = numberAt(refinementStats?.final_match_percentage);

    this.cache.set(cacheKey, { jobKeywords, tailoredMarkdown, score });
    return { resumeId, jobId, jobKeywords, tailoredMarkdown, score, cacheHit: false };
  }

  async uploadJob(jobDescription: string, resumeId?: string): Promise<string> {
    const res = await this.fetchJson(`${this.baseUrl}/api/v1/jobs/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_descriptions: [jobDescription], resume_id: resumeId }),
    });
    const ids = Array.isArray(res.job_id) ? res.job_id : [];
    const jobId = ids.find((id): id is string => typeof id === "string");
    if (!jobId) throw new Error("resume_matcher_missing_job_id");
    return jobId;
  }

  async uploadResume(sampleId: string, resumeText: string): Promise<string> {
    const file = new File([resumeText], `${safeName(sampleId)}.txt`, { type: "text/plain" });
    const form = new FormData();
    form.set("file", file);
    const res = await this.fetchJson(`${this.baseUrl}/api/v1/resumes/upload`, {
      method: "POST",
      body: form,
    });
    if (typeof res.resume_id !== "string") throw new Error("resume_matcher_missing_resume_id");
    return res.resume_id;
  }

  async improvePreview(resumeId: string, jobId: string): Promise<JsonObject> {
    return this.fetchJson(`${this.baseUrl}/api/v1/resumes/improve/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_id: resumeId, job_id: jobId }),
    });
  }

  async getJob(jobId: string): Promise<JsonObject> {
    return this.fetchJson(`${this.baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`);
  }

  private async fetchJson(url: string, init?: RequestInit): Promise<JsonObject> {
    const res = await this.fetchFn(url, init);
    const text = await res.text();
    let json: JsonObject = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`resume_matcher_bad_json:${res.status}`);
    }
    if (!res.ok) {
      const detail = typeof json.detail === "string" ? json.detail : `http_${res.status}`;
      throw new Error(`resume_matcher_${detail}`);
    }
    return json;
  }
}

export function parseJobKeywords(value: unknown): JobKeywords | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JobKeywords;
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "resume";
}

function digest(parts: string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest("hex");
}

function stringAt(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberAt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function recordAt(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}
