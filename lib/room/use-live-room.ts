"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { AGENT_ORDER, type AgentId } from "@/lib/agents";
import type { Stage } from "@/lib/mock-data";

export type AgentTask = {
  company: string;
  role: string;
  stage: Stage;
  jobUrl?: string;
  matchScore?: number;
  tailoringScore?: number;
  location?: string;
  provider?: string;
  logoBg?: string;
  logoText?: string;
  rank: number;
};

export type IngestionStatus = "idle" | "fetching" | "ranking" | "completed" | "failed";

export type IngestionState = {
  status: IngestionStatus;
  fetchedCount: number;
  survivorCount: number;
  llmScoredCount: number;
  recommendedCount: number;
};

export type TailoringJob = {
  company: string;
  role: string;
  rank: number;
  matchScore?: number;
};

export type TailoringState = {
  inProgress: boolean;
  completed: number;
  target: number;
  jobs: TailoringJob[];
};

export type SubmissionsState = {
  byStatus: Partial<Record<string, number>>;
};

export type FollowUpsState = {
  applicationCount: number;
  appliedCount: number;
  interviewCount: number;
  offerCount: number;
};

export type LiveRoom = {
  byAgent: Partial<Record<AgentId, AgentTask>>;
  isBusy: boolean;
  hasData: boolean;
  ingestion: IngestionState;
  tailoring: TailoringState;
  submissions: SubmissionsState;
  followUps: FollowUpsState;
};

type LiveRunSummary = {
  status?: string;
  tailoringInProgress?: boolean;
  tailoredCount?: number;
  tailoringTargetCount?: number;
  fetchedCount?: number;
  survivorCount?: number;
  llmScoredCount?: number;
  recommendedCount?: number;
};

type LiveRecommendation = {
  rank: number;
  company: string;
  title: string;
  location?: string;
  jobUrl?: string;
  totalScore?: number;
  llmScore?: number;
  score?: number;
};

type FollowUpsSummary = {
  applications?: ReadonlyArray<{ status?: string }>;
  counts?: {
    applications?: number;
    applied?: number;
    interviews?: number;
    responses?: number;
    rejectedClosed?: number;
    due?: number;
  };
};

type LiveResponse = {
  run?: LiveRunSummary | null;
  recommendations?: LiveRecommendation[] | null;
  logs?: unknown;
  followUps?: FollowUpsSummary | null;
};

type LiveStore = {
  data: LiveResponse | null;
  hasData: boolean;
  refCount: number;
  setData: (next: LiveResponse) => void;
  retain: () => void;
  release: () => void;
};

const FAST_INTERVAL_MS = 2500;
const SLOW_INTERVAL_MS = 8000;
const VISIBILITY_REFRESH_MS = 4000;

const useLiveStore = create<LiveStore>((set, get) => ({
  data: null,
  hasData: false,
  refCount: 0,
  setData: (next) => set({ data: next, hasData: true }),
  retain: () => {
    const next = get().refCount + 1;
    set({ refCount: next });
    if (next === 1) startPolling();
  },
  release: () => {
    const next = Math.max(0, get().refCount - 1);
    set({ refCount: next });
    if (next === 0) stopPolling();
  },
}));

let pollTimer: number | null = null;
let pollCancelled = false;
let lastFetchAt = 0;

function isBusyResponse(r: LiveResponse | null): boolean {
  if (!r?.run) return false;
  if (r.run.tailoringInProgress) return true;
  if (r.run.status && ["fetching", "ranking"].includes(r.run.status)) return true;
  return false;
}

async function fetchLiveOnce(): Promise<void> {
  try {
    const res = await fetch("/api/dashboard/live", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as LiveResponse;
    if (pollCancelled) return;
    useLiveStore.getState().setData(json);
  } catch {
    // swallow — keep last good data
  }
}

function scheduleNextTick(): void {
  if (pollCancelled) return;
  const interval = isBusyResponse(useLiveStore.getState().data) ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
  pollTimer = window.setTimeout(async () => {
    lastFetchAt = Date.now();
    await fetchLiveOnce();
    scheduleNextTick();
  }, interval);
}

function startPolling(): void {
  pollCancelled = false;
  if (pollTimer !== null) return;
  void (async () => {
    lastFetchAt = Date.now();
    await fetchLiveOnce();
    scheduleNextTick();
  })();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
}

function stopPolling(): void {
  pollCancelled = true;
  if (pollTimer !== null) {
    window.clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibility);
  }
}

function onVisibility(): void {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - lastFetchAt < VISIBILITY_REFRESH_MS) return;
  void fetchLiveOnce();
}

const PROVIDER_FROM_URL = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const host = new URL(url).host.toLowerCase();
    if (host.includes("greenhouse")) return "Greenhouse";
    if (host.includes("lever")) return "Lever";
    if (host.includes("workday") || host.includes("myworkday")) return "Workday";
    if (host.includes("ashby")) return "Ashby";
    return host.replace(/^www\./, "");
  } catch {
    return undefined;
  }
};

const LOGO_PALETTE = [
  { bg: "#0F172A", text: "#FFFFFF" },
  { bg: "#1F2937", text: "#FFFFFF" },
  { bg: "#0E7490", text: "#FFFFFF" },
  { bg: "#7C3AED", text: "#FFFFFF" },
  { bg: "#D97706", text: "#FFFFFF" },
];

const initialsFor = (company: string): string => {
  const parts = company.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

function deriveStage(run: LiveRunSummary | null | undefined, rank: number): Stage {
  if (!run) return "queued";
  const tailored = run.tailoredCount ?? 0;
  const target = run.tailoringTargetCount ?? 0;
  if (tailored >= target && target > 0) return "submitted";
  if (run.tailoringInProgress) {
    if (rank < tailored) return "submitted";
    if (rank < tailored + 1) return "tailoring";
    return "queued";
  }
  if (rank < tailored) return "submitted";
  return "queued";
}

const KNOWN_INGESTION_STATUSES: ReadonlySet<IngestionStatus> = new Set([
  "idle",
  "fetching",
  "ranking",
  "completed",
  "failed",
]);

function normalizeIngestionStatus(raw: string | undefined): IngestionStatus {
  if (!raw) return "idle";
  if (KNOWN_INGESTION_STATUSES.has(raw as IngestionStatus)) return raw as IngestionStatus;
  // Unknown statuses (e.g. "started", "fetched") map to "fetching" if mid-pipeline,
  // otherwise treat as idle so we don't overstate progress.
  if (raw === "started" || raw === "fetched") return "fetching";
  return "idle";
}

const EMPTY_INGESTION: IngestionState = {
  status: "idle",
  fetchedCount: 0,
  survivorCount: 0,
  llmScoredCount: 0,
  recommendedCount: 0,
};

const EMPTY_TAILORING: TailoringState = {
  inProgress: false,
  completed: 0,
  target: 0,
  jobs: [],
};

const EMPTY_SUBMISSIONS: SubmissionsState = { byStatus: {} };

const EMPTY_FOLLOW_UPS: FollowUpsState = {
  applicationCount: 0,
  appliedCount: 0,
  interviewCount: 0,
  offerCount: 0,
};

const EMPTY: LiveRoom = {
  byAgent: {},
  isBusy: false,
  hasData: false,
  ingestion: EMPTY_INGESTION,
  tailoring: EMPTY_TAILORING,
  submissions: EMPTY_SUBMISSIONS,
  followUps: EMPTY_FOLLOW_UPS,
};

function buildIngestion(run: LiveRunSummary | null | undefined): IngestionState {
  if (!run) return EMPTY_INGESTION;
  return {
    status: normalizeIngestionStatus(run.status),
    fetchedCount: run.fetchedCount ?? 0,
    survivorCount: run.survivorCount ?? 0,
    llmScoredCount: run.llmScoredCount ?? 0,
    recommendedCount: run.recommendedCount ?? 0,
  };
}

function buildTailoring(
  run: LiveRunSummary | null | undefined,
  recommendations: LiveRecommendation[]
): TailoringState {
  const jobs: TailoringJob[] = recommendations.map((rec) => ({
    company: rec.company,
    role: rec.title,
    rank: rec.rank,
    matchScore: typeof rec.totalScore === "number"
      ? Math.round(rec.totalScore)
      : typeof rec.score === "number"
        ? Math.round(rec.score)
        : undefined,
  }));
  return {
    inProgress: Boolean(run?.tailoringInProgress),
    completed: run?.tailoredCount ?? 0,
    target: run?.tailoringTargetCount ?? 0,
    jobs,
  };
}

function buildSubmissions(followUps: FollowUpsSummary | null | undefined): SubmissionsState {
  const apps = followUps?.applications;
  if (!Array.isArray(apps) || apps.length === 0) return EMPTY_SUBMISSIONS;
  const byStatus: Record<string, number> = {};
  for (const app of apps) {
    const status = typeof app.status === "string" ? app.status : "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return { byStatus };
}

function buildFollowUps(followUps: FollowUpsSummary | null | undefined): FollowUpsState {
  const counts = followUps?.counts;
  if (!counts) return EMPTY_FOLLOW_UPS;
  // `offer` isn't in the API counts, so derive it from applications array.
  const apps = followUps?.applications ?? [];
  const offerCount = apps.filter((app) => app.status === "offer").length;
  return {
    applicationCount: counts.applications ?? 0,
    appliedCount: counts.applied ?? 0,
    interviewCount: counts.interviews ?? 0,
    offerCount,
  };
}

export function useLiveRoom(): LiveRoom {
  const data = useLiveStore((s) => s.data);
  const hasData = useLiveStore((s) => s.hasData);
  const retain = useLiveStore((s) => s.retain);
  const release = useLiveStore((s) => s.release);

  useEffect(() => {
    retain();
    return () => release();
  }, [retain, release]);

  return useMemo<LiveRoom>(() => {
    if (!data) return { ...EMPTY, hasData };

    const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
    const run = data.run ?? null;
    const followUps = data.followUps ?? null;

    const ingestion = buildIngestion(run);
    const tailoring = buildTailoring(run, recommendations);
    const submissions = buildSubmissions(followUps);
    const followUpsState = buildFollowUps(followUps);

    if (recommendations.length === 0) {
      return {
        ...EMPTY,
        hasData,
        ingestion,
        tailoring,
        submissions,
        followUps: followUpsState,
        isBusy: isBusyResponse(data),
      };
    }

    const recs = recommendations.slice(0, AGENT_ORDER.length);
    const byAgent: Partial<Record<AgentId, AgentTask>> = {};
    recs.forEach((rec, idx) => {
      const agentId = AGENT_ORDER[idx];
      if (!agentId) return;
      const palette = LOGO_PALETTE[idx % LOGO_PALETTE.length];
      byAgent[agentId] = {
        company: rec.company,
        role: rec.title,
        stage: deriveStage(run, idx),
        jobUrl: rec.jobUrl,
        matchScore: typeof rec.totalScore === "number" ? Math.round(rec.totalScore) : undefined,
        tailoringScore: typeof rec.llmScore === "number" ? Math.round(rec.llmScore) : undefined,
        location: rec.location,
        provider: PROVIDER_FROM_URL(rec.jobUrl),
        logoBg: palette.bg,
        logoText: initialsFor(rec.company),
        rank: rec.rank,
      };
    });

    return {
      byAgent,
      isBusy: isBusyResponse(data),
      hasData: true,
      ingestion,
      tailoring,
      submissions,
      followUps: followUpsState,
    };
  }, [data, hasData]);
}
