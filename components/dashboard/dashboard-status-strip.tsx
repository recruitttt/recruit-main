"use client";

import { Activity, Play, Radio } from "lucide-react";
import { ActionButton, StatusBadge } from "@/components/design-system";
import { cn } from "@/lib/utils";
import type { DashboardRunControls, LiveRunSummary } from "./dashboard-types";

type DashboardStatusStripProps = {
  run: LiveRunSummary | null | undefined;
  recommendationCount: number;
  refreshedAt: number | null;
  controls?: DashboardRunControls;
};

export function DashboardStatusStrip({
  run,
  recommendationCount,
  refreshedAt,
  controls,
}: DashboardStatusStripProps) {
  const tailoredCount = run?.tailoredCount ?? 0;
  const tailoringTargetCount = run?.tailoringTargetCount ?? (recommendationCount > 0 ? Math.min(recommendationCount, 3) : 0);
  const counts = [
    {
      label: "Run",
      value: statusLabel(run),
      detail: run ? shortRunMeta(run) : "Ready for ingestion",
    },
    {
      label: "Sources",
      value: run ? `${run.fetchedCount}/${run.sourceCount}` : "0/0",
      detail: "Fetched",
    },
    {
      label: "Jobs",
      value: String(run?.rawJobCount ?? 0),
      detail: "Captured",
    },
    {
      label: "Ranked",
      value: String(run?.recommendedCount ?? recommendationCount),
      detail: "On board",
    },
    {
      label: "Tailored",
      value: `${tailoredCount}/${tailoringTargetCount}`,
      detail: "PDF-ready target",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/55 bg-white/65 p-4 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.24)] backdrop-blur-xl">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
      <div className="absolute -top-10 right-12 h-24 w-24 rounded-full bg-[var(--color-accent-soft)] blur-3xl" />
      <div className="absolute -bottom-16 left-14 h-24 w-24 rounded-full bg-amber-200/35 blur-3xl" />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={runTone(run)}>{statusLabel(run)}</StatusBadge>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              <Radio className="h-3.5 w-3.5 text-emerald-600" />
              {refreshedAt ? `Live ${formatTime(refreshedAt)}` : "Awaiting first sync"}
            </span>
            {run?.tailoringInProgress ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                <Activity className="h-3.5 w-3.5" />
                Tailoring in flight
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {controls?.error || controls?.message ? (
              <div
                className={cn(
                  "max-w-full rounded-full border px-3 py-2 text-xs font-medium leading-tight",
                  controls.error
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-slate-200/80 bg-white/85 text-slate-600",
                )}
              >
                {controls.error ?? controls.message}
              </div>
            ) : null}
            <ActionButton
              variant="primary"
              disabled={!controls?.canRun || controls?.busy}
              onClick={controls?.onRunFirst3}
              className="min-w-[132px] bg-slate-950 text-white"
            >
              <Play className="h-4 w-4" />
              {controls?.busy ? "Running" : controls?.label ?? "Run first 3"}
            </ActionButton>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-5">
          {counts.map((count) => (
            <div
              key={count.label}
              className="rounded-[22px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.82))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {count.label}
              </div>
              <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                {count.value}
              </div>
              <div className="mt-1 text-xs text-slate-500">{count.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function shortRunMeta(run: LiveRunSummary) {
  if (run.status === "completed") {
    return `${run.recommendedCount} recommendations ready`;
  }
  if (run.status === "failed") {
    return `${run.errorCount} error${run.errorCount === 1 ? "" : "s"}`;
  }
  return `${run.filteredCount} filtered · ${run.llmScoredCount} scored`;
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(run: LiveRunSummary | null | undefined) {
  if (!run) return "Idle";
  if (run.status === "fetching") return "Fetching";
  if (run.status === "fetched") return "Staging";
  if (run.status === "ranking") return "Ranking";
  if (run.status === "completed" && run.tailoringInProgress) return "Tailoring";
  if (run.status === "completed") return "Ready";
  return "Attention";
}

function runTone(run: LiveRunSummary | null | undefined) {
  if (!run) return "neutral";
  if (run.status === "failed") return "danger";
  if (run.status === "completed" && !run.tailoringInProgress) return "success";
  return "active";
}
