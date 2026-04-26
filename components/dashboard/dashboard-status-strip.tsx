"use client";

import { Fragment, type ReactNode } from "react";
import { Activity, Check, ChevronRight, Loader2, Play, Radio } from "lucide-react";
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

type StageState = "idle" | "active" | "done" | "failed";

type Stage = {
  id: string;
  label: string;
  value: ReactNode;
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
    <section className="relative overflow-hidden rounded-[20px] border border-[var(--dashboard-panel-border)] bg-[var(--dashboard-panel-bg)] px-4 py-3 text-[var(--dashboard-panel-fg)] shadow-[var(--dashboard-panel-shadow)] backdrop-blur-xl">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      <div className="relative flex flex-col gap-4">
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
            {run?.applyInProgress ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                <Activity className="h-3.5 w-3.5" />
                Applying in flight
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
              onClick={controls?.onRunPipeline}
              className="min-w-[132px] bg-[var(--dashboard-command-button-bg)] text-[var(--dashboard-command-button-fg)] hover:bg-[var(--dashboard-command-button-hover)]"
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
        "grid grid-cols-1 gap-3 border-t border-[var(--dashboard-panel-divider)] pt-3",
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
      aria-label={`${stage.label}: ${String(stage.value)} (${stage.state})`}
      className={cn(
        "relative h-full rounded-[18px] border px-4 py-3 transition-colors",
        "bg-[var(--dashboard-card-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
        isActive && "border-[var(--color-accent)] bg-[var(--color-accent-soft)]",
        isDone && "border-[var(--dashboard-card-border)]",
        stage.state === "idle" && "border-[var(--dashboard-card-border)] opacity-72",
        isFailed && "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]",
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
                ? "text-[var(--dashboard-panel-kicker)]"
                : isFailed
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--dashboard-panel-subtle)]",
          )}
        >
          {stage.label}
        </div>
      </div>
      <div
        className={cn(
          "mt-2 text-xl font-semibold tracking-[-0.03em]",
          stage.state === "idle" ? "text-[var(--dashboard-panel-subtle)]" : "text-[var(--dashboard-panel-fg)]",
        )}
      >
        {stage.value}
      </div>
      <div
        className={cn(
          "mt-1 text-xs",
          stage.state === "idle" ? "text-[var(--dashboard-panel-subtle)]" : "text-[var(--dashboard-panel-muted)]",
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
        className="h-3.5 w-3.5 text-[var(--color-success)]"
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
        className="inline-block h-2 w-2 rounded-full bg-[var(--color-danger)]"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full border border-[var(--dashboard-card-border)]"
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
    <div aria-hidden className="hidden items-center justify-center px-2 md:flex">
      <div className="relative flex w-full items-center">
        <div
          className={cn(
            "h-px w-full transition-colors",
            reached
              ? "bg-gradient-to-r from-[var(--color-accent)]/55 to-[var(--color-accent)]/30"
              : "bg-[var(--dashboard-panel-divider)]",
          )}
        />
        <ChevronRight
          className={cn(
            "absolute right-[-6px] h-4 w-4 transition-colors",
            reached ? "text-[var(--color-accent)]" : "text-[var(--dashboard-panel-subtle)]",
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
      caption: "What we know",
      state: "done",
    },
    {
      id: "sources",
      label: "Sources",
      value: sourceCount > 0 ? <CountUpPair left={fetchedCount} right={sourceCount} /> : "—",
      caption: "Where we look",
      state: sourcesState,
    },
    {
      id: "jobs",
      label: "Jobs",
      value: rawJobCount > 0 ? <CountUpNumber value={rawJobCount} /> : "—",
      caption: "What we found",
      state: jobsState,
    },
    {
      id: "ranked",
      label: "Best matches",
      value: recommendedCount > 0 ? <CountUpNumber value={recommendedCount} /> : "—",
      caption: "Narrowed by fit",
      state: rankedState,
    },
    {
      id: "tailored",
      label: "Tailored",
      value:
        tailoringTargetCount > 0
          ? <CountUpPair left={tailoredCount} right={tailoringTargetCount} />
          : tailoredCount > 0
            ? <CountUpNumber value={tailoredCount} />
            : "—",
      caption: "Resumes ready",
      state: tailoredState,
    },
    {
      id: "applied",
      label: "Applied",
      value:
        appliedTargetCount > 0
          ? <CountUpPair left={appliedCount} right={appliedTargetCount} />
          : appliedCount > 0
            ? <CountUpNumber value={appliedCount} />
            : "—",
      caption: "Auto-submitted",
      state: appliedState,
    },
  ];
}

function CountUpNumber({ value }: { value: number }) {
  return <AnimatedNumber value={value} />;
}

function CountUpPair({ left, right }: { left: number; right: number }) {
  return (
    <>
      <CountUpNumber value={left} />
      /
      <CountUpNumber value={right} />
    </>
  );
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
  if (run.status === "completed" && run.applyInProgress) return "Applying";
  if (run.status === "completed" && run.tailoringInProgress) return "Tailoring";
  if (run.status === "completed") return "Ready";
  return "Attention";
}

function runTone(run: LiveRunSummary | null | undefined) {
  if (!run) return "neutral";
  if (run.status === "failed") return "danger";
  if (run.status === "completed" && !run.tailoringInProgress && !run.applyInProgress) return "success";
  return "active";
}
