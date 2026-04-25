// Sequential client-side orchestrator. Loops over the 10 jobs,
// for each: optionally skip if cached, call /api/research/job, then
// /api/tailor/job, persist the result to localStorage, emit events.
//
// Per Peter's spec: research the first, hand off to tailor, then move
// to the next. Not parallel.

import type { UserProfile } from "@/lib/profile";
import type {
  Job,
  JobResearch,
  PipelineEvent,
  TailoredApplication,
} from "./types";

export const TAILORED_APPS_STORAGE_KEY = "recruit:tailoredApplications";

export function readCachedApplications(): Record<string, TailoredApplication> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TAILORED_APPS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, TailoredApplication>;
  } catch {
    return {};
  }
}

function persistApplication(app: TailoredApplication): void {
  if (typeof window === "undefined") return;
  try {
    const cur = readCachedApplications();
    cur[app.jobId] = app;
    window.localStorage.setItem(TAILORED_APPS_STORAGE_KEY, JSON.stringify(cur));
  } catch {
    // localStorage quota or JSON error - swallow, the in-memory state still works.
  }
}

export function clearCachedApplications(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TAILORED_APPS_STORAGE_KEY);
  } catch {}
}

async function callResearch(
  job: Job,
  signal?: AbortSignal
): Promise<{ ok: true; research: JobResearch } | { ok: false; reason: string }> {
  try {
    const res = await fetch("/api/research/job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ job }),
    });
    const json = (await res.json()) as
      | { ok: true; research: JobResearch }
      | { ok: false; reason: string };
    return json;
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? "research_fetch_failed" };
  }
}

async function callTailor(
  profile: UserProfile,
  research: JobResearch,
  job: Job,
  signal?: AbortSignal
): Promise<
  | { ok: true; application: TailoredApplication }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/tailor/job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ profile, research, job }),
    });
    const json = (await res.json()) as
      | { ok: true; application: TailoredApplication }
      | { ok: false; reason: string };
    return json;
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? "tailor_fetch_failed" };
  }
}

export type RunOptions = {
  useCache?: boolean;
  signal?: AbortSignal;
};

export async function runTailorPipeline(
  jobs: Job[],
  profile: UserProfile,
  onEvent: (event: PipelineEvent) => void,
  opts: RunOptions = {}
): Promise<TailoredApplication[]> {
  const useCache = opts.useCache ?? true;
  const cached = useCache ? readCachedApplications() : {};
  const results: TailoredApplication[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    onEvent({ type: "queued", jobId: job.id, jobIndex: i });

    if (useCache && cached[job.id]) {
      onEvent({ type: "skipped", jobId: job.id, cached: cached[job.id] });
      results.push(cached[job.id]);
      continue;
    }

    onEvent({ type: "research-start", jobId: job.id });
    const research = await callResearch(job, opts.signal);
    if (!research.ok) {
      onEvent({ type: "error", jobId: job.id, phase: "research", reason: research.reason });
      continue;
    }
    onEvent({ type: "research-done", jobId: job.id, research: research.research });

    onEvent({ type: "tailor-start", jobId: job.id });
    const tailor = await callTailor(profile, research.research, job, opts.signal);
    if (!tailor.ok) {
      onEvent({ type: "error", jobId: job.id, phase: "tailor", reason: tailor.reason });
      continue;
    }

    persistApplication(tailor.application);
    results.push(tailor.application);
    onEvent({ type: "tailor-done", jobId: job.id, application: tailor.application });
  }

  onEvent({ type: "complete", results });
  return results;
}

export function downloadPdf(app: TailoredApplication): void {
  if (typeof window === "undefined") return;
  try {
    const bytes = Uint8Array.from(atob(app.pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeCompany = app.job.company.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    a.download = `Resume_${safeCompany || "Tailored"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {}
}
