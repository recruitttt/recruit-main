"use client";

import * as React from "react";
import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CirclePause,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  Maximize2,
  MessageSquareText,
  MonitorUp,
  MousePointer2,
  PanelsTopLeft,
  Play,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isProfileUsable } from "@/lib/demo-profile";
import { readProfile } from "@/lib/profile";
import {
  applyHubMetrics,
  fieldProgress,
  mergeRunJobState,
  reduceLiveApplyEvent,
  seedLiveApplyJobs,
  statusLabel,
  type ApplyMode,
  type ApplyEvent,
  type ApplyRun,
  type ComputerUseModel,
  type DeferredQuestionGroup,
  type LiveApplyEvent,
  type LiveApplyField,
  type LiveApplyJob,
  type TailoredResume,
} from "@/lib/apply-service";
import type { LeaderboardRow, LiveRecommendation } from "@/components/dashboard/dashboard-types";

type Props = {
  rows: LeaderboardRow[];
  selected: LiveRecommendation | null;
  selectedJobId: string | null;
  tailoredResume?: TailoredResume | null;
};

type StartResponse =
  | { ok: true; run: ApplyRun; recruit2?: { runId: string; baseUrl: string } | null }
  | { ok: false; reason: string };

const MODEL_OPTIONS: Array<{ value: ComputerUseModel; label: string }> = [
  { value: "gpt-5.4-nano", label: "Nano" },
  { value: "gpt-5.4-mini", label: "Mini" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
];

const LIVE_EVENT_KINDS = [
  "status",
  "step",
  "thought",
  "agent_note",
  "screenshot",
  "draft",
  "login_required",
  "surface_snapshot",
  "verification_required",
  "site_blocked",
  "manual_finish_required",
  "missing_required_answer",
  "awaiting_final_approval",
  "phase_transition",
  "snapshot_taken",
  "field_set",
  "field_filled",
  "field_skipped",
  "field_failed",
  "ats_detected",
] as const;

export function ApplyHub({ rows, selected, selectedJobId, tailoredResume }: Props) {
  const [count, setCount] = React.useState(5);
  const [customUrls, setCustomUrls] = React.useState("");
  const [mode, setMode] = React.useState<ApplyMode>("auto-strict");
  const [model, setModel] = React.useState<ComputerUseModel>("gpt-5.4-nano");
  const [concurrency, setConcurrency] = React.useState(10);
  const [run, setRun] = React.useState<ApplyRun | null>(null);
  const [events, setEvents] = React.useState<ApplyEvent[]>([]);
  const [liveJobs, setLiveJobs] = React.useState<LiveApplyJob[]>([]);
  const [selectedLiveJobId, setSelectedLiveJobId] = React.useState<string | null>(null);
  const [focusedShot, setFocusedShot] = React.useState<{ jobId: string; png: string } | null>(null);
  const [liveConnected, setLiveConnected] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [autoSubmitEnabled, setAutoSubmitEnabled] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const autoSubmitInFlight = React.useRef<Set<string>>(new Set());

  const selectedRows = React.useMemo(() => rows.slice(0, count), [count, rows]);
  const customJobs = React.useMemo(() => parseCustomUrls(customUrls), [customUrls]);
  const plannedCount = selectedRows.length + customJobs.length;
  const selectedIncluded = Boolean(selectedJobId && selectedRows.some((row) => row.jobId === selectedJobId));
  const profileReady = typeof window !== "undefined" ? isProfileUsable(readProfile()) : false;
  const pendingQuestions = run?.questionGroups.filter((group) => group.status === "pending") ?? [];
  const selectedLiveJob = liveJobs.find((job) => job.id === selectedLiveJobId) ?? liveJobs[0] ?? null;
  const metrics = applyHubMetrics(liveJobs);
  const autoSubmitReadyCount = pendingQuestions.length > 0
    ? 0
    : liveJobs.filter((job) => isAutoSubmittableStatus(job.status)).length;

  React.useEffect(() => {
    if (!run?.id) return;
    const runId = run.id;
    let cancelled = false;
    async function refresh() {
      try {
        const [runResponse, eventsResponse, questionsResponse] = await Promise.all([
          fetch(`/api/applications/runs/${encodeURIComponent(runId)}`, { cache: "no-store" }),
          fetch(`/api/applications/runs/${encodeURIComponent(runId)}/events`, { cache: "no-store" }),
          fetch(`/api/applications/runs/${encodeURIComponent(runId)}/questions`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (runResponse.ok) {
          const body = await runResponse.json() as { run?: ApplyRun };
          if (body.run) {
            setRun(body.run);
            setLiveJobs((current) => current.length === 0 ? seedLiveApplyJobs(body.run!) : mergeRunJobState(current, body.run!));
            setSelectedLiveJobId((current) => current ?? body.run!.jobs[0]?.id ?? null);
          }
        }
        if (eventsResponse.ok) {
          const body = await eventsResponse.json() as { events?: ApplyEvent[] };
          setEvents(body.events ?? []);
        }
        if (questionsResponse.ok) {
          const body = await questionsResponse.json() as { groups?: DeferredQuestionGroup[] };
          const groups = body.groups;
          if (groups) {
            setRun((current) => current ? {
              ...current,
              status: groups.some((group) => group.status === "pending") ? "questions_ready" : current.status,
              questionGroups: groups,
            } : current);
          }
        }
      } catch {
        // Polling is best-effort; the next tick may recover.
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [run?.id]);

  React.useEffect(() => {
    if (!run?.id || !run.remoteRunId) {
      return;
    }

    const source = new EventSource(`/api/applications/runs/${encodeURIComponent(run.id)}/recruit2/events`);
    source.onopen = () => setLiveConnected(true);
    source.onerror = () => setLiveConnected(false);

    const handlers = LIVE_EVENT_KINDS.map((kind) => {
      const handler = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as LiveApplyEvent;
          setLiveJobs((current) => reduceLiveApplyEvent(current, parsed));
        } catch {
          // Ignore malformed upstream events.
        }
      };
      source.addEventListener(kind, handler);
      return { kind, handler };
    });

    return () => {
      for (const { kind, handler } of handlers) source.removeEventListener(kind, handler);
      source.close();
      setLiveConnected(false);
    };
  }, [run?.id, run?.remoteRunId]);

  // Screenshot poller for the Convex engine path. When the recruit2 SSE
  // stream isn't providing screenshots (Convex-based runs), poll the
  // latest captured screenshot from Convex evidence for the active job.
  React.useEffect(() => {
    if (!run?.id || !selectedLiveJob?.id) return;
    // If we already have a screenshot via SSE, skip polling.
    if (selectedLiveJob.screenshotPng || selectedLiveJob.annotatedScreenshotPng) return;
    if (focusedShot?.jobId === selectedLiveJob.id) return;

    let cancelled = false;
    async function pollScreenshot() {
      if (cancelled || !run?.id || !selectedLiveJob?.id) return;
      try {
        const response = await fetch(
          screenshotUrl(run!, selectedLiveJob!),
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) return;
        const body = await response.json() as { ok: boolean; screenshotPng?: string };
        if (body.ok && body.screenshotPng && !cancelled) {
          setFocusedShot({ jobId: selectedLiveJob!.id, png: body.screenshotPng });
          setLiveJobs((current) => current.map((job) => (
            job.id === selectedLiveJob!.id ? { ...job, screenshotPng: body.screenshotPng } : job
          )));
        }
      } catch {
        // Best-effort polling.
      }
    }
    void pollScreenshot();
    const timer = window.setInterval(() => void pollScreenshot(), 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [run?.id, selectedLiveJob?.id, selectedLiveJob?.screenshotPng, selectedLiveJob?.annotatedScreenshotPng, focusedShot?.jobId]);

  async function startBatch() {
    if (pending || plannedCount === 0) return;
    setPending(true);
    setError(null);
    setFocusedShot(null);
    autoSubmitInFlight.current.clear();
    try {
      const profile = readProfile();
      const jobs = [
        ...selectedRows.map((row) => ({
          id: row.jobId,
          company: row.company,
          title: row.title,
          url: row.recommendation.jobUrl,
          applicationUrl: row.recommendation.job?.applyUrl ?? row.recommendation.job?.jobUrl ?? row.recommendation.jobUrl,
          location: row.recommendation.location,
          source: row.providerLabel,
          description: row.recommendation.job?.descriptionPlain,
          requirements: row.recommendation.strengths,
        })),
        ...customJobs,
      ];
      const response = await fetch("/api/applications/batch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobs,
          profile,
          tailoredResumes: tailoredResume ? { [tailoredResume.jobId]: tailoredResume } : {},
          mode,
          settings: {
            maxApplicationsPerRun: 20,
            maxConcurrentApplications: concurrency,
            maxConcurrentPerDomain: concurrency,
            computerUseModel: model,
            devSkipRealSubmit: true,
          },
          consent: { externalTargetsApproved: true, finalSubmitApproved: false },
        }),
      });
      const body = await response.json().catch(() => null) as StartResponse | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body && !body.ok ? body.reason : `apply_start_${response.status}`);
      }
      setRun(body.run);
      setEvents(body.run.events);
      setLiveJobs(seedLiveApplyJobs(body.run));
      setSelectedLiveJobId(body.run.jobs[0]?.id ?? null);
      setAnswers({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  async function resolveQuestions(groups: DeferredQuestionGroup[]) {
    if (!run) return;
    const payload: Record<string, { answer: string; remember: boolean }> = {};
    for (const group of groups) {
      const answer = (answers[group.id] ?? group.provisionalAnswer).trim();
      if (answer) payload[group.id] = { answer, remember: true };
    }
    if (Object.keys(payload).length === 0) return;
    const response = await fetch(`/api/applications/runs/${encodeURIComponent(run.id)}/questions/resolve-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: payload }),
    });
    if (response.ok) {
      const body = await response.json() as { groups?: DeferredQuestionGroup[] };
      setRun((current) => current ? {
        ...current,
        status: body.groups?.some((group) => group.status === "pending") ? "questions_ready" : current.status,
        questionGroups: body.groups ?? current.questionGroups,
      } : current);
    }
  }

  async function focusQuestion(group: DeferredQuestionGroup) {
    const item = group.items.find((candidate) => candidate.field?.selector) ?? group.items[0];
    if (!item) return;
    const job = liveJobs.find((candidate) => candidate.id === item.jobId);
    if (!job) return;
    await focusField(job, {
      label: item.field?.label ?? group.prompt,
      selector: item.field?.selector,
      value: answers[group.id] ?? group.provisionalAnswer,
    });
  }

  const approve = React.useCallback(async (jobId: string) => {
    if (!run) return;
    const response = await fetch(`/api/applications/runs/${encodeURIComponent(run.id)}/jobs/${encodeURIComponent(jobId)}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devSkipRealSubmit: true }),
    });
    if (response.ok) {
      const body = await response.json() as { job?: ApplyRun["jobs"][number] };
      if (body.job) {
        setRun((current) => {
          if (!current) return current;
          const next = { ...current, jobs: current.jobs.map((job) => job.id === body.job!.id ? body.job! : job) };
          setLiveJobs((live) => mergeRunJobState(live, next));
          return next;
        });
      }
    }
  }, [run]);

  async function focusField(job: LiveApplyJob, field: Pick<LiveApplyField, "selector" | "label" | "value">) {
    setSelectedLiveJobId(job.id);
    if (!run || !field.selector) return;
    const response = await fetch(`/api/applications/runs/${encodeURIComponent(run.id)}/jobs/${encodeURIComponent(job.id)}/focus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepIndex: 0,
        selector: field.selector,
        label: field.label,
        value: field.value,
      }),
    });
    if (!response.ok) return;
    const body = await response.json().catch(() => null) as { screenshotPng?: string } | null;
    if (body?.screenshotPng) setFocusedShot({ jobId: job.id, png: body.screenshotPng });
  }

  React.useEffect(() => {
    if (!autoSubmitEnabled || !run || pendingQuestions.length > 0) return;
    const readyJobs = liveJobs.filter((job) => isAutoSubmittableStatus(job.status));
    for (const job of readyJobs) {
      if (autoSubmitInFlight.current.has(job.id)) continue;
      autoSubmitInFlight.current.add(job.id);
      void approve(job.id)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => {
          autoSubmitInFlight.current.delete(job.id);
        });
    }
  }, [approve, autoSubmitEnabled, liveJobs, pendingQuestions.length, run]);

  return (
    <section className="rounded-[24px] border border-[var(--dashboard-panel-border)] bg-[var(--dashboard-panel-bg)] px-4 py-4 text-[var(--dashboard-panel-fg)] shadow-[var(--dashboard-panel-shadow)] backdrop-blur-2xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dashboard-panel-kicker)]">
            <Bot className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            Apply Hub
            {run?.remoteRunId ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px]", liveConnected ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--dashboard-card-bg)] text-[var(--dashboard-panel-subtle)]")}>
                {liveConnected ? "live stream" : "stream reconnecting"}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-[var(--dashboard-panel-fg)]">
            Apply to shortlisted jobs with live application form control
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--dashboard-panel-muted)]">
            Watch every cloud browser run, inspect field-level progress, and approve all queued review items from one hub.
          </p>
          {selected ? (
            <p className="mt-1 text-xs text-[var(--dashboard-panel-subtle)]">
              Selected role: {selected.company} / {selected.title}{selectedIncluded ? " is included in this batch." : " is outside the current top-job slice."}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-4 xl:w-[620px]">
          <LabeledSelect label="Jobs" value={String(count)} onChange={(value) => setCount(Number(value))}>
            {[1, 3, 5, 10, 15, 20].map((value) => (
              <option key={value} value={value}>Top {value}</option>
            ))}
          </LabeledSelect>
          <ModeControl value={mode} onChange={setMode} />
          <LabeledSelect label="Model" value={model} onChange={(value) => setModel(value as ComputerUseModel)}>
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </LabeledSelect>
          <LabeledSelect label="Active" value={String(concurrency)} onChange={(value) => setConcurrency(Number(value))}>
            {[5, 10, 15, 20].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </LabeledSelect>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(320px,0.68fr)_minmax(0,1.32fr)]">
        <div className="space-y-3">
          <textarea
            value={customUrls}
            onChange={(event) => setCustomUrls(event.target.value)}
            placeholder="Optional: paste extra job URLs, one per line"
            className="min-h-24 w-full resize-y rounded-xl border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-control-bg)] px-3 py-2 text-sm text-[var(--dashboard-panel-fg)] outline-none transition placeholder:text-[var(--dashboard-panel-subtle)] focus:border-[var(--color-accent)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || plannedCount === 0}
              onClick={() => void startBatch()}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--dashboard-action-border)] px-3 py-2 text-sm font-semibold text-[var(--dashboard-action-fg)] transition hover:border-[var(--color-fg)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start {plannedCount || "batch"}
            </button>
            <button
              type="button"
              aria-pressed={autoSubmitEnabled}
              onClick={() => setAutoSubmitEnabled((current) => !current)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
                autoSubmitEnabled
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                  : "border-[var(--dashboard-action-border)] text-[var(--dashboard-action-fg)] hover:border-[var(--color-fg)] hover:text-[var(--color-fg)]",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Auto-submit {autoSubmitEnabled ? "on" : "off"}
            </button>
            <span className="text-xs text-[var(--dashboard-panel-subtle)]">
              {profileReady ? "Profile ready" : "Profile fallback may be used"} / {tailoredResume ? "tailored resume attached" : "resume selected by profile"}
              {autoSubmitEnabled ? ` / ${autoSubmitReadyCount} ready to auto-submit` : ""}
            </span>
          </div>
          {error ? (
            <div className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}
          <LaunchPreview selectedRows={selectedRows} customJobs={customJobs} />
        </div>

        <div className="min-w-0 space-y-4">
          {run ? (
            <>
              <MetricStrip metrics={metrics} />
              <div className="grid min-h-[560px] gap-3 xl:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)]">
                <div className="min-h-0 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--dashboard-panel-fg)]">Application agents</span>
                    <span className="font-mono text-[10px] text-[var(--dashboard-panel-subtle)]">{liveJobs.length} jobs</span>
                  </div>
                  <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
                    {liveJobs.map((job) => (
                      <LiveJobCard
                        key={job.id}
                        job={job}
                        selected={job.id === selectedLiveJob?.id}
                        onClick={() => {
                          setSelectedLiveJobId(job.id);
                          setFocusedShot(null);
                        }}
                      />
                    ))}
                  </div>
                </div>

                <LiveFormPanel
                  key={selectedLiveJob?.id ?? "empty-live-form"}
                  job={selectedLiveJob}
                  focusedScreenshot={focusedShot?.jobId === selectedLiveJob?.id ? focusedShot.png : null}
                  onApprove={approve}
                  onFocusField={focusField}
                />
              </div>

              {pendingQuestions.length > 0 ? (
              <QuestionsPanel
                  groups={pendingQuestions}
                  answers={answers}
                  onAnswer={(groupId, answer) => setAnswers((current) => ({ ...current, [groupId]: answer }))}
                  onResolve={() => void resolveQuestions(pendingQuestions)}
                  onFocus={(group) => void focusQuestion(group)}
                />
              ) : null}

              <EventRail events={events.length ? events : run.events} />
            </>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-[var(--dashboard-panel-divider)] text-center text-sm text-[var(--dashboard-panel-muted)]">
              Start a batch to see live form screenshots, per-job progress bars, approval modes, and AI activity here.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function screenshotUrl(run: ApplyRun, job: LiveApplyJob): string {
  const base = `/api/applications/runs/${encodeURIComponent(run.id)}/jobs/${encodeURIComponent(job.id)}/screenshot`;
  if (run.source !== "convex-application-actions" || !job.remoteSlug) return base;
  return `${base}?convexJobId=${encodeURIComponent(job.remoteSlug)}`;
}

function ModeControl({ value, onChange }: { value: ApplyMode; onChange: (mode: ApplyMode) => void }) {
  const [lastAutoMode, setLastAutoMode] = React.useState<"auto-strict" | "auto-aggressive">(
    value === "auto-aggressive" ? "auto-aggressive" : "auto-strict",
  );
  const main = value === "auto-strict" || value === "auto-aggressive" ? "auto" : value;

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-panel-kicker)]">
        Mode
        <span title="Auto Strict pauses more often; Auto Aggressive moves faster but still keeps final review.">
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <span className="relative block">
        <select
          value={main}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "auto" ? lastAutoMode : next as ApplyMode);
          }}
          className="h-9 w-full appearance-none rounded-lg border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-control-bg)] px-3 pr-8 text-xs font-semibold text-[var(--dashboard-panel-fg)] outline-none focus:border-[var(--color-accent)]"
        >
          <option value="manual">Manual</option>
          <option value="auto">Auto</option>
          <option value="hands-free">Hands-free</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-[var(--dashboard-panel-subtle)]" />
      </span>
      {main === "auto" ? (
        <div className="mt-1 grid grid-cols-2 rounded-lg border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-card-bg)] p-0.5">
          {(["auto-strict", "auto-aggressive"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={value === option}
              onClick={() => {
                setLastAutoMode(option);
                onChange(option);
              }}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-semibold transition",
                value === option ? "bg-[var(--color-accent)] text-white" : "text-[var(--dashboard-panel-muted)] hover:bg-[var(--dashboard-control-bg)]",
              )}
            >
              {option === "auto-strict" ? "Strict" : "Aggressive"}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MetricStrip({ metrics }: { metrics: ReturnType<typeof applyHubMetrics> }) {
  const fieldPercent = metrics.fieldsTotal > 0 ? Math.round((metrics.fieldsFilled / metrics.fieldsTotal) * 100) : 0;
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <MetricTile icon={Activity} label="Active" value={metrics.active} sub={`${metrics.total} total`} />
      <MetricTile icon={CirclePause} label="Needs review" value={metrics.needsReview} sub="questions or approvals" />
      <MetricTile icon={CheckCircle2} label="Submitted" value={metrics.submitted} sub={`${metrics.failed} failed`} />
      <MetricTile icon={ListChecks} label="Fields" value={`${fieldPercent}%`} sub={`${metrics.fieldsFilled}/${metrics.fieldsTotal || 0} filled`} />
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-card-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--dashboard-panel-muted)]">{label}</span>
        <Icon aria-hidden className="h-4 w-4 text-[var(--dashboard-panel-subtle)]" />
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums text-[var(--dashboard-panel-fg)]">{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--dashboard-panel-subtle)]">{sub}</div>
    </div>
  );
}

function LiveJobCard({ job, selected, onClick }: { job: LiveApplyJob; selected: boolean; onClick: () => void }) {
  const progress = fieldProgress(job);
  const percent = progress.total > 0 ? Math.round((progress.filled / progress.total) * 100) : statusPercent(job.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition hover:border-[var(--color-accent)]",
        selected ? "border-[var(--color-accent)] bg-[var(--dashboard-control-bg)] shadow-sm" : "border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-card-bg)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--dashboard-control-bg)] text-sm font-semibold">
          {monogram(job.company)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-[var(--dashboard-panel-fg)]">{job.company}</p>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--dashboard-panel-muted)]">{job.title}</p>
        </div>
      </div>
      <ProgressBar value={percent} className="mt-3" />
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--dashboard-panel-subtle)]">
        <span>{progress.total > 0 ? `${progress.filled}/${progress.total} fields` : statusLabel(job.status)}</span>
        <span>{job.timeline.length} steps</span>
      </div>
      {job.attention ? <p className="mt-2 line-clamp-2 text-xs text-[var(--color-warn)]">{job.attention}</p> : null}
    </button>
  );
}

function LiveFormPanel({
  job,
  focusedScreenshot,
  onApprove,
  onFocusField,
}: {
  job: LiveApplyJob | null;
  focusedScreenshot: string | null;
  onApprove: (jobId: string) => Promise<void>;
  onFocusField: (job: LiveApplyJob, field: LiveApplyField) => Promise<void>;
}) {
  const [expanded, setExpanded] = React.useState<"browser" | "fields" | "timeline" | null>(null);

  if (!job) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-xl border border-dashed border-[var(--dashboard-panel-divider)] text-sm text-[var(--dashboard-panel-muted)]">
        Select an application agent.
      </div>
    );
  }
  const png = focusedScreenshot ?? job.annotatedScreenshotPng ?? job.screenshotPng;
  const progress = fieldProgress(job);
  const showApprove = job.status === "review_ready" || job.status === "awaiting_final_approval" || job.status === "questions_ready";
  return (
    <div className="min-w-0 rounded-xl border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-card-bg)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MonitorUp className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="truncate text-sm font-semibold">{job.company} live form</h3>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 truncate text-xs text-[var(--dashboard-panel-muted)]">{job.pageTitle ?? job.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {job.liveViewUrl ? (
            <a href={job.liveViewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--dashboard-action-border)] px-2 py-1 text-xs font-semibold">
              Live browser <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          {showApprove ? (
            <button
              type="button"
              onClick={() => void onApprove(job.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-2 py-1 text-xs font-semibold text-white"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Approve dev
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]">
        <div className="min-w-0">
          <BrowserPreview
            png={png}
            company={job.company}
            onExpand={() => setExpanded("browser")}
          />
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <p className="min-w-0 truncate font-mono text-[var(--dashboard-panel-subtle)]">{job.pageUrl ?? job.url}</p>
            <span className="shrink-0 text-[var(--dashboard-panel-muted)]">{progress.total} fields</span>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">Field progress</span>
              <span className="font-mono text-[10px] text-[var(--dashboard-panel-subtle)]">{progress.filled}/{progress.total || 0}</span>
            </div>
            <ProgressBar value={progress.total > 0 ? Math.round((progress.filled / progress.total) * 100) : statusPercent(job.status)} />
          </div>
          <FieldList job={job} onFocusField={onFocusField} onExpand={() => setExpanded("fields")} />
        </div>
      </div>

      <Timeline job={job} onExpand={() => setExpanded("timeline")} />

      {expanded === "browser" ? (
        <ExpandDialog title={`${job.company} browser`} onClose={() => setExpanded(null)}>
          <div className="flex h-full min-h-0 flex-col">
            <BrowserPreview png={png} company={job.company} expanded />
            <p className="mt-2 truncate font-mono text-[11px] text-[var(--dashboard-panel-subtle)]">{job.pageUrl ?? job.url}</p>
          </div>
        </ExpandDialog>
      ) : null}

      {expanded === "fields" ? (
        <ExpandDialog title={`${job.company} fields`} onClose={() => setExpanded(null)}>
          <FieldList job={job} onFocusField={onFocusField} expanded />
        </ExpandDialog>
      ) : null}

      {expanded === "timeline" ? (
        <ExpandDialog title={`${job.company} AI activity`} onClose={() => setExpanded(null)}>
          <Timeline job={job} expanded />
        </ExpandDialog>
      ) : null}
    </div>
  );
}

function BrowserPreview({
  png,
  company,
  onExpand,
  expanded = false,
}: {
  png?: string;
  company: string;
  onExpand?: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      disabled={!onExpand}
      className={cn(
        "group relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-control-bg)] text-left",
        expanded ? "min-h-0 flex-1" : "aspect-video",
        onExpand && "cursor-zoom-in hover:border-[var(--color-accent)]",
      )}
    >
      {png ? (
        <Image
          src={`data:image/png;base64,${png}`}
          alt={`${company} latest application form`}
          width={1600}
          height={1000}
          unoptimized
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-center text-xs text-[var(--dashboard-panel-muted)]">
          <PanelsTopLeft className="h-7 w-7 text-[var(--dashboard-panel-subtle)]" />
          Waiting for live screenshot.
        </div>
      )}
      {onExpand ? (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-panel-bg)]/90 px-2 py-1 text-[11px] font-semibold opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" />
          Expand
        </span>
      ) : null}
    </button>
  );
}

function FieldList({
  job,
  onFocusField,
  onExpand,
  expanded = false,
}: {
  job: LiveApplyJob;
  onFocusField: (job: LiveApplyJob, field: LiveApplyField) => Promise<void>;
  onExpand?: () => void;
  expanded?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-[var(--dashboard-panel-subtle)]" />
          Detected fields
        </span>
        {onExpand ? (
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--dashboard-panel-divider)] px-2 py-1 text-[11px] text-[var(--dashboard-panel-muted)] hover:border-[var(--color-accent)] hover:text-[var(--dashboard-panel-fg)]"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Expand
          </button>
        ) : null}
      </div>
      <ol className={cn("space-y-1 overflow-auto rounded-lg border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-control-bg)] p-1", expanded ? "max-h-[70vh]" : "max-h-56")}>
        {job.fields.length === 0 ? (
          <li className="px-2 py-2 text-xs text-[var(--dashboard-panel-muted)]">Waiting for field map.</li>
        ) : (
          job.fields.map((field) => (
            <li key={field.fieldId}>
              <button
                type="button"
                onClick={() => void onFocusField(job, field)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition hover:bg-[var(--dashboard-card-bg)]"
              >
                <FieldDot status={field.status} />
                <span className="font-mono text-[10px] text-[var(--dashboard-panel-subtle)]">#{field.fieldId}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate font-semibold">{field.label || `Field ${field.fieldId}`}</span>
                    {field.required ? <span className="text-[var(--color-danger)]">*</span> : null}
                  </span>
                  {field.value ? <span className="block truncate font-mono text-[10px] text-[var(--dashboard-panel-subtle)]">{field.value}</span> : null}
                  {field.error ? <span className="block truncate text-[10px] text-[var(--color-danger)]">{field.error}</span> : null}
                </span>
                {field.selector ? <MousePointer2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--dashboard-panel-subtle)]" /> : null}
              </button>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}

function Timeline({ job, onExpand, expanded = false }: { job: LiveApplyJob; onExpand?: () => void; expanded?: boolean }) {
  const rows = job.timeline.slice(-16);
  return (
    <div className="mt-3 border-t border-[var(--dashboard-panel-divider)] pt-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold">AI activity</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[var(--dashboard-panel-subtle)]">{job.timeline.length} steps</span>
          {onExpand ? (
            <button
              type="button"
              onClick={onExpand}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--dashboard-panel-divider)] px-2 py-1 text-[11px] text-[var(--dashboard-panel-muted)] hover:border-[var(--color-accent)] hover:text-[var(--dashboard-panel-fg)]"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Expand
            </button>
          ) : null}
        </span>
      </div>
      <div className={cn("space-y-1 overflow-auto rounded-lg border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-control-bg)] p-2", expanded ? "max-h-[70vh]" : "max-h-44")}>
        {rows.length === 0 ? (
          <p className="text-xs text-[var(--dashboard-panel-muted)]">No AI actions yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-2 text-xs">
              <span className="font-mono text-[10px] text-[var(--dashboard-panel-subtle)]">#{row.stepIndex}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{row.label}</p>
                <p className="truncate text-[var(--dashboard-panel-muted)]">{row.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ExpandDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-[min(86vh,900px)] w-[min(94vw,1320px)] min-w-0 flex-col rounded-xl border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-panel-bg)] p-3 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="truncate text-sm font-semibold text-[var(--dashboard-panel-fg)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--dashboard-panel-divider)] text-[var(--dashboard-panel-muted)] hover:border-[var(--color-accent)] hover:text-[var(--dashboard-panel-fg)]"
            aria-label="Close expanded view"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function QuestionsPanel({
  groups,
  answers,
  onAnswer,
  onResolve,
  onFocus,
}: {
  groups: DeferredQuestionGroup[];
  answers: Record<string, string>;
  onAnswer: (groupId: string, answer: string) => void;
  onResolve: () => void;
  onFocus: (group: DeferredQuestionGroup) => void;
}) {
  const unansweredCount = groups.filter((group) => !(answers[group.id] ?? group.provisionalAnswer).trim()).length;
  return (
    <div className="rounded-xl border border-[var(--color-warn-border)] bg-[var(--dashboard-card-bg)] p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquareText className="h-4 w-4 text-[var(--color-accent)]" />
            Questions to answer
          </div>
          <p className="mt-1 text-xs text-[var(--dashboard-panel-muted)]">
            The application agents paused with grouped questions. Answer once here, then apply it back to every affected form.
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-warn-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--color-warn)]">
          {groups.length} group{groups.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id} className="rounded-lg border border-[var(--dashboard-panel-divider)] p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-panel-kicker)]">
                  {group.items.length} field{group.items.length === 1 ? "" : "s"} / {group.requiresExplicitGate ? "explicit review" : "shared answer"}
                </span>
                <p className="mt-1 text-sm font-semibold text-[var(--dashboard-panel-fg)]">{group.prompt}</p>
              </div>
              <button
                type="button"
                onClick={() => onFocus(group)}
                className="shrink-0 rounded-md border border-[var(--dashboard-panel-divider)] px-2 py-1 text-[11px] font-semibold text-[var(--dashboard-panel-muted)] hover:border-[var(--color-accent)] hover:text-[var(--dashboard-panel-fg)]"
              >
                Show field
              </button>
            </div>
            {group.items.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {group.items.slice(0, 5).map((item) => (
                  <span key={item.id} className="rounded-full bg-[var(--dashboard-control-bg)] px-2 py-0.5 text-[10px] text-[var(--dashboard-panel-muted)]">
                    {item.company ?? item.jobTitle ?? item.field?.label ?? "Job"}
                  </span>
                ))}
              </div>
            ) : null}
            <input
              value={answers[group.id] ?? group.provisionalAnswer}
              onChange={(event) => onAnswer(group.id, event.target.value)}
              placeholder="Type the answer to use for this question"
              className="mt-2 w-full rounded-lg border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-control-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            {group.items[0]?.options?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {group.items[0].options?.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onAnswer(group.id, option)}
                    className="rounded-md border border-[var(--dashboard-panel-divider)] px-2 py-1 text-[11px] text-[var(--dashboard-panel-muted)] hover:border-[var(--color-accent)] hover:text-[var(--dashboard-panel-fg)]"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onResolve}
        disabled={unansweredCount > 0}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--dashboard-action-border)] px-3 py-2 text-xs font-semibold text-[var(--dashboard-action-fg)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Apply answers to all jobs
      </button>
      {unansweredCount > 0 ? (
        <span className="ml-2 text-xs text-[var(--dashboard-panel-subtle)]">{unansweredCount} still blank</span>
      ) : null}
    </div>
  );
}

function EventRail({ events }: { events: ApplyEvent[] }) {
  return (
    <div className="max-h-36 space-y-2 overflow-y-auto border-t border-[var(--dashboard-panel-divider)] pt-3">
      {events.slice(-8).reverse().map((event) => (
        <div key={event.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-xs">
          <span className="mt-1 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          <div className="min-w-0">
            <div className="truncate font-medium text-[var(--dashboard-panel-fg)]">{event.message}</div>
            <div className="mt-0.5 uppercase tracking-[0.12em] text-[var(--dashboard-panel-subtle)]">{event.kind}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LaunchPreview({
  selectedRows,
  customJobs,
}: {
  selectedRows: LeaderboardRow[];
  customJobs: ReturnType<typeof parseCustomUrls>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {selectedRows.slice(0, 6).map((row) => (
        <div key={row.jobId} className="border-b border-[var(--dashboard-panel-divider)] py-2">
          <div className="truncate text-sm font-semibold text-[var(--dashboard-panel-fg)]">{row.company}</div>
          <div className="truncate text-xs text-[var(--dashboard-panel-muted)]">{row.title}</div>
        </div>
      ))}
      {customJobs.slice(0, 4).map((job) => (
        <div key={job.id} className="border-b border-[var(--dashboard-panel-divider)] py-2">
          <div className="truncate text-sm font-semibold text-[var(--dashboard-panel-fg)]">{job.company}</div>
          <div className="truncate text-xs text-[var(--dashboard-panel-muted)]">{job.url}</div>
        </div>
      ))}
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-panel-kicker)]">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full appearance-none rounded-lg border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-control-bg)] px-3 pr-8 text-xs font-semibold text-[var(--dashboard-panel-fg)] outline-none focus:border-[var(--color-accent)]"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-[var(--dashboard-panel-subtle)]" />
      </span>
    </label>
  );
}

function StatusBadge({ status }: { status: LiveApplyJob["status"] }) {
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        tone === "good" && "bg-[var(--color-success-soft)] text-[var(--color-success)]",
        tone === "warn" && "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
        tone === "bad" && "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
        tone === "neutral" && "bg-[var(--dashboard-control-bg)] text-[var(--dashboard-panel-muted)]",
      )}
    >
      {tone === "good" ? <CheckCircle2 className="h-3 w-3" /> : tone === "bad" ? <XCircle className="h-3 w-3" /> : tone === "warn" ? <AlertTriangle className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
      {statusLabel(status)}
    </span>
  );
}

function FieldDot({ status }: { status: LiveApplyField["status"] }) {
  return (
    <span
      aria-label={status}
      className={cn(
        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
        status === "filled" && "bg-[var(--color-success)]",
        status === "failed" && "bg-[var(--color-danger)]",
        status === "acting" && "animate-pulse bg-[var(--color-accent)]",
        status === "pending" && "bg-[var(--dashboard-panel-subtle)]",
        status === "skipped" && "bg-[var(--dashboard-panel-muted)]",
      )}
    />
  );
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-[var(--dashboard-control-bg)]", className)}>
      <div className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${width}%` }} />
    </div>
  );
}

function statusTone(status: LiveApplyJob["status"]): "good" | "warn" | "bad" | "neutral" {
  if (status === "submitted" || status === "submitted_dev") return "good";
  if (status === "failed" || status === "cancelled") return "bad";
  if (status === "questions_ready" || status === "review_ready" || status === "awaiting_user_input" || status === "awaiting_final_approval" || status === "awaiting_login" || status === "manual_finish_required") return "warn";
  return "neutral";
}

function statusPercent(status: LiveApplyJob["status"]): number {
  if (status === "queued") return 5;
  if (status === "tailoring") return 15;
  if (status === "filling" || status === "running") return 45;
  if (status === "questions_ready" || status === "review_ready" || status === "awaiting_final_approval") return 82;
  if (status === "submit_queued" || status === "submitting") return 92;
  if (status === "submitted" || status === "submitted_dev") return 100;
  if (status === "failed" || status === "cancelled") return 100;
  return 60;
}

function isAutoSubmittableStatus(status: LiveApplyJob["status"]): boolean {
  return status === "review_ready" || status === "awaiting_final_approval" || status === "questions_ready";
}

function monogram(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function parseCustomUrls(raw: string) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((url, index) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
        return [{
          id: `custom_${index}_${parsed.hostname.replace(/[^a-z0-9]+/gi, "_")}`,
          company: parsed.hostname.replace(/^www\./, ""),
          title: "External job",
          url: parsed.toString(),
          applicationUrl: parsed.toString(),
          source: "custom",
        }];
      } catch {
        return [];
      }
    });
}
