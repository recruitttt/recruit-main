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

export type LiveRoom = {
  byAgent: Partial<Record<AgentId, AgentTask>>;
  isBusy: boolean;
  hasData: boolean;
};

type LiveResponse = {
  run?: {
    status?: string;
    tailoringInProgress?: boolean;
    tailoredCount?: number;
    tailoringTargetCount?: number;
  } | null;
  recommendations?: Array<{
    rank: number;
    company: string;
    title: string;
    location?: string;
    jobUrl?: string;
    totalScore?: number;
    llmScore?: number;
  }> | null;
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

function deriveStage(run: LiveResponse["run"], rank: number): Stage {
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

const EMPTY: LiveRoom = { byAgent: {}, isBusy: false, hasData: false };

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
    if (!data || !data.recommendations || data.recommendations.length === 0) {
      return { ...EMPTY, hasData };
    }
    const recs = data.recommendations.slice(0, AGENT_ORDER.length);
    const byAgent: Partial<Record<AgentId, AgentTask>> = {};
    recs.forEach((rec, idx) => {
      const agentId = AGENT_ORDER[idx];
      if (!agentId) return;
      const palette = LOGO_PALETTE[idx % LOGO_PALETTE.length];
      byAgent[agentId] = {
        company: rec.company,
        role: rec.title,
        stage: deriveStage(data.run, idx),
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
    return { byAgent, isBusy: isBusyResponse(data), hasData: true };
  }, [data, hasData]);
}
