import { readApplyServiceSettings } from "./settings";
import type {
  ApplyServiceProfile,
  JobCandidate,
  NormalizedApplyBatchResult,
  TailoredResume,
} from "./types";

export function normalizeApplyBatchRequest(raw: unknown): NormalizedApplyBatchResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: "bad_request", status: 400 };
  }
  const consent = isRecord(raw.consent) ? raw.consent : {};
  if (consent.externalTargetsApproved !== true) {
    return { ok: false, reason: "external_targets_not_approved", status: 403 };
  }
  const settings = readApplyServiceSettings(raw.settings, raw.mode);
  const jobs = readJobs(raw.jobs);
  if (jobs.length === 0) {
    return { ok: false, reason: "missing_jobs", status: 400 };
  }
  if (jobs.length > settings.maxApplicationsPerRun) {
    return {
      ok: false,
      reason: "too_many_jobs",
      status: 400,
      maxApplicationsPerRun: settings.maxApplicationsPerRun,
    };
  }
  const profile = isRecord(raw.profile) ? raw.profile as ApplyServiceProfile : {};
  const tailoredResumes = readTailoredResumes(raw.tailoredResumes);
  return {
    ok: true,
    value: {
      jobs,
      profile,
      tailoredResumes,
      settings,
      consent: {
        externalTargetsApproved: true,
        finalSubmitApproved: consent.finalSubmitApproved === true,
      },
    },
  };
}

function readJobs(raw: unknown): JobCandidate[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const jobs: JobCandidate[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const url = stringValue(item.applicationUrl) || stringValue(item.url);
    const parsed = parseJobUrl(url);
    if (!parsed) continue;
    const key = canonicalJobUrl(parsed);
    if (seen.has(key)) continue;
    seen.add(key);
    const id = stringValue(item.id) || stableJobId(parsed.toString());
    jobs.push({
      id,
      company: stringValue(item.company) || parsed.hostname.replace(/^www\./, ""),
      title: stringValue(item.title) || stringValue(item.role) || "Open role",
      url: stringValue(item.url) || parsed.toString(),
      applicationUrl: stringValue(item.applicationUrl) || parsed.toString(),
      location: stringValue(item.location) || undefined,
      source: stringValue(item.source) || undefined,
      description: stringValue(item.description) || stringValue(item.descriptionPlain) || undefined,
      requirements: Array.isArray(item.requirements)
        ? item.requirements.map(String).filter(Boolean)
        : undefined,
    });
  }
  return jobs;
}

function readTailoredResumes(raw: unknown): Record<string, TailoredResume> {
  if (!isRecord(raw)) return {};
  const out: Record<string, TailoredResume> = {};
  for (const [jobId, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    const filename = stringValue(value.filename);
    if (!filename) continue;
    out[jobId] = {
      jobId: stringValue(value.jobId) || jobId,
      filename,
      path: stringValue(value.path) || undefined,
      base64: stringValue(value.base64) || undefined,
      byteLength: numberValue(value.byteLength),
      source: readResumeSource(value.source),
    };
  }
  return out;
}

export function canonicalJobUrl(url: URL): string {
  const copy = new URL(url.toString());
  copy.hash = "";
  for (const key of [...copy.searchParams.keys()]) {
    if (/^utm_|^fbclid$|^gclid$/i.test(key)) copy.searchParams.delete(key);
  }
  copy.hostname = copy.hostname.toLowerCase().replace(/^www\./, "");
  copy.pathname = copy.pathname.replace(/\/+$/, "");
  return copy.toString();
}

function parseJobUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

function stableJobId(url: string): string {
  let hash = 0;
  for (let index = 0; index < url.length; index++) {
    hash = (hash * 31 + url.charCodeAt(index)) >>> 0;
  }
  return `job_${hash.toString(16)}`;
}

function readResumeSource(value: unknown): TailoredResume["source"] | undefined {
  return value === "convex" || value === "browser" || value === "generated" || value === "manual"
    ? value
    : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
