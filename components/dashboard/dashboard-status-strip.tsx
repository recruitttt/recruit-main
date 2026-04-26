"use client";

import { Activity, Check, ChevronRight, Loader2, Play, Radio } from "lucide-react";
import { Fragment } from "react";
import { ActionButton, StatusBadge } from "@/components/design-system";
import { cn } from "@/lib/utils";
import type { DashboardRunControls, LiveRunSummary } from "./dashboard-types";

type DashboardStatusStripProps = {
  run: LiveRunSummary | null | undefined;
  recommendationCount: number;
  refreshedAt: number | null;
  controls?: DashboardRunControls;
};

type StageState = "idle" | "active" | "done" | "failed";

type Stage = {
  id: string;
  label: string;
  value: string;
  caption: string;
  state: StageState;
};

export function DashboardStatusStrip({
  run,
  recommendationCount,
  refreshedAt,
  controls,
}: DashboardStatusStripProps) {
  const stages = buildStages(run, recommendationCount);

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
              onClick={controls?.onRunPipeline}
              className="min-w-[132px] bg-slate-950 text-white"
            >
              <Play className="h-4 w-4" />
              {controls?.busy ? "Running" : controls?.label ?? "Run pipeline"}
            </ActionButton>
          </div>
        </div>

        <PipelineFlow stages={stages} />
      </div>
    </section>
  );
}

function PipelineFlow({ stages }: { stages: Stage[] }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3",
        "md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-0",
      )}
      role="list"
      aria-label="Pipeline progress"
    >
      {stages.map((stage, index) => {
        const next = stages[index + 1];
        return (
          <Fragment key={stage.id}>
            <PipelineNode stage={stage} />
            {next ? (
              <PipelineConnector
                fromState={stage.state}
                toState={next.state}
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

function PipelineNode({ stage }: { stage: Stage }) {
  const isActive = stage.state === "active";
  const isDone = stage.state === "done";
  const isFailed = stage.state === "failed";

  return (
    <div
      role="listitem"
      aria-label={`${stage.label}: ${stage.value} (${stage.state})`}
      className={cn(
        "relative h-full rounded-[22px] border px-4 py-3 transition-colors",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]",
        isActive &&
          "border-[var(--color-accent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),var(--color-accent-soft))]",
        isDone &&
          "border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.82))]",
        stage.state === "idle" &&
          "border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(248,250,252,0.45))]",
        isFailed && "border-red-200 bg-red-50/70",
      )}
    >
      <div className="flex items-center gap-1.5">
        <StateIcon state={stage.state} />
        <div
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.18em]",
            isActive
              ? "text-[var(--color-accent)]"
              : isDone
                ? "text-slate-600"
                : isFailed
                  ? "text-red-700"
                  : "text-slate-400",
          )}
        >
          {stage.label}
        </div>
      </div>
      <div
        className={cn(
          "mt-2 text-xl font-semibold tracking-[-0.03em]",
          stage.state === "idle" ? "text-slate-400" : "text-slate-950",
        )}
      >
        {stage.value}
      </div>
      <div
        className={cn(
          "mt-1 text-xs",
          stage.state === "idle" ? "text-slate-400" : "text-slate-500",
        )}
      >
        {stage.caption}
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <Check
        aria-hidden
        className="h-3.5 w-3.5 text-emerald-600"
        strokeWidth={3}
      />
    );
  }
  if (state === "active") {
    return (
      <Loader2
        aria-hidden
        className="h-3.5 w-3.5 animate-spin text-[var(--color-accent)]"
      />
    );
  }
  if (state === "failed") {
    return (
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full bg-red-500"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full border border-slate-300"
    />
  );
}

function PipelineConnector({
  fromState,
  toState,
}: {
  fromState: StageState;
  toState: StageState;
}) {
  const reached = fromState === "done" || (fromState === "active" && toState !== "idle");

  return (
    <div
      aria-hidden
      className={cn(
        "hidden md:flex items-center justify-center px-2",
      )}
    >
      <div className="relative flex w-full items-center">
        <div
          className={cn(
            "h-px w-full transition-colors",
            reached
              ? "bg-gradient-to-r from-[var(--color-accent)]/55 to-[var(--color-accent)]/35"
              : "bg-slate-200/80",
          )}
        />
        <ChevronRight
          className={cn(
            "absolute right-[-6px] h-4 w-4 transition-colors",
            reached ? "text-[var(--color-accent)]" : "text-slate-300",
          )}
          strokeWidth={2.25}
        />
      </div>
    </div>
  );
}

function buildStages(
  run: LiveRunSummary | null | undefined,
  recommendationCount: number,
): Stage[] {
  const tailoredCount = run?.tailoredCount ?? 0;
  const tailoringTargetCount =
    run?.tailoringTargetCount ?? (recommendationCount > 0 ? Math.min(recommendationCount, 3) : 0);

  const sourceCount = run?.sourceCount ?? 0;
  const fetchedCount = run?.fetchedCount ?? 0;
  const rawJobCount = run?.rawJobCount ?? 0;
  const recommendedCount = run?.recommendedCount ?? recommendationCount;
  const appliedCount = run?.appliedCount ?? 0;
  const appliedAttemptedCount = run?.appliedAttemptedCount ?? 0;
  const appliedTargetCount = run?.appliedTargetCount ?? tailoringTargetCount;
  const applyInProgress = run?.applyInProgress ?? false;

  const status = run?.status;
  const failed = status === "failed";

  const sourcesState: StageState = !run
    ? "idle"
    : status === "fetching"
      ? "active"
      : failed && fetchedCount === 0
        ? "failed"
        : "done";

  const jobsState: StageState = !run
    ? "idle"
    : status === "fetching"
      ? "idle"
      : failed && rawJobCount === 0
        ? "failed"
        : "done";

  const rankedState: StageState = !run
    ? "idle"
    : status === "fetching" || status === "fetched"
      ? "idle"
      : status === "ranking"
        ? "active"
        : failed && recommendedCount === 0
          ? "failed"
          : "done";

  const tailoredState: StageState = !run
    ? "idle"
    : run.tailoringInProgress
      ? "active"
      : tailoredCount > 0
        ? "done"
        : "idle";

  const appliedState: StageState = !run
    ? "idle"
    : applyInProgress
      ? "active"
      : appliedAttemptedCount > 0 && appliedCount === appliedAttemptedCount
        ? "done"
        : appliedAttemptedCount > 0
          ? "done"
          : tailoredState === "done" && status === "completed"
            ? "idle"
            : "idle";

  return [
    {
      id: "profile",
      label: "Profile",
      value: "Ready",
      caption: "What we know about you",
      state: "done",
    },
    {
      id: "sources",
      label: "Sources",
      value: sourceCount > 0 ? `${fetchedCount}/${sourceCount}` : "—",
      caption: "Where we look",
      state: sourcesState,
    },
    {
      id: "jobs",
      label: "Jobs",
      value: rawJobCount > 0 ? String(rawJobCount) : "—",
      caption: "What we found",
      state: jobsState,
    },
    {
      id: "ranked",
      label: "Best matches",
      value: recommendedCount > 0 ? String(recommendedCount) : "—",
      caption: "Narrowed by fit",
      state: rankedState,
    },
    {
      id: "tailored",
      label: "Tailored",
      value:
        tailoringTargetCount > 0
          ? `${tailoredCount}/${tailoringTargetCount}`
          : tailoredCount > 0
            ? String(tailoredCount)
            : "—",
      caption: "Resumes ready",
      state: tailoredState,
    },
    {
      id: "applied",
      label: "Applied",
      value:
        appliedTargetCount > 0
          ? `${appliedCount}/${appliedTargetCount}`
          : appliedCount > 0
            ? String(appliedCount)
            : "—",
      caption: "Auto-submitted (dry-run)",
      state: appliedState,
    },
  ];
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
