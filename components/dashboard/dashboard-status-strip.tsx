"use client";

import type { ReactNode } from "react";
import { Activity, Play, Radio } from "lucide-react";
import { ActionButton, StatusBadge } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./metric-animation";
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
      value: run ? (
        <>
          <CountUpNumber value={run.fetchedCount} />
          /
          <CountUpNumber value={run.sourceCount} />
        </>
      ) : "0/0",
      detail: "Fetched",
    },
    {
      label: "Jobs",
      value: <CountUpNumber value={run?.rawJobCount ?? 0} />,
      detail: "Captured",
    },
    {
      label: "Ranked",
      value: <CountUpNumber value={run?.recommendedCount ?? recommendationCount} />,
      detail: "On board",
    },
    {
      label: "Tailored",
      value: (
        <>
          <CountUpNumber value={tailoredCount} />
          /
          <CountUpNumber value={tailoringTargetCount} />
        </>
      ),
      detail: "PDF-ready target",
    },
  ] satisfies Array<{ label: string; value: ReactNode; detail: string }>;

  return (
    <section className="relative overflow-hidden rounded-[20px] border border-[var(--dashboard-panel-border)] bg-[var(--dashboard-panel-bg)] px-4 py-3 text-[var(--dashboard-panel-fg)] shadow-[var(--dashboard-panel-shadow)] backdrop-blur-xl">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      <div className="relative flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={runTone(run)}>{statusLabel(run)}</StatusBadge>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--dashboard-card-border)] bg-[var(--dashboard-control-bg)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dashboard-panel-muted)]">
              <Radio className="h-3.5 w-3.5 text-[var(--color-accent)]" />
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
                    ? "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                    : "border-[var(--dashboard-card-border)] bg-[var(--dashboard-control-bg)] text-[var(--dashboard-panel-muted)]",
                )}
              >
                {controls.error ?? controls.message}
              </div>
            ) : null}
            <ActionButton
              variant="primary"
              disabled={!controls?.canRun || controls?.busy}
              onClick={controls?.onRunFirst3}
              className="min-w-[132px] bg-[var(--dashboard-command-button-bg)] text-[var(--dashboard-command-button-fg)] hover:bg-[var(--dashboard-command-button-hover)]"
            >
              <Play className="h-4 w-4" />
              {controls?.busy ? "Running" : controls?.label ?? "Run first 3"}
            </ActionButton>
          </div>
        </div>

        <div className="grid gap-y-3 border-t border-[var(--dashboard-panel-divider)] pt-3 md:grid-cols-5 md:divide-x md:divide-[var(--dashboard-panel-divider)]">
          {counts.map((count) => (
            <div
              key={count.label}
              className="px-0 py-1 md:px-4 md:first:pl-0 md:last:pr-0"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dashboard-panel-kicker)]">
                {count.label}
              </div>
              <div className="mt-2 text-xl font-semibold text-[var(--dashboard-panel-fg)]">
                {count.value}
              </div>
              <div className="mt-1 text-xs text-[var(--dashboard-panel-subtle)]">{count.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CountUpNumber({ value }: { value: number }) {
  return <AnimatedNumber value={value} />;
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
