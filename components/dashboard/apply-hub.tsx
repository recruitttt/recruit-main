"use client";

import * as React from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  CirclePause,
  ExternalLink,
  Loader2,
  MessageSquareText,
  Play,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isProfileUsable } from "@/lib/demo-profile";
import { readProfile } from "@/lib/profile";
import type {
  ApplyEvent,
  ApplyRun,
  ComputerUseModel,
  DeferredQuestionGroup,
  TailoredResume,
} from "@/lib/apply-service/types";
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

export function ApplyHub({ rows, selected, selectedJobId, tailoredResume }: Props) {
  const [count, setCount] = React.useState(5);
  const [customUrls, setCustomUrls] = React.useState("");
  const [mode, setMode] = React.useState<"auto-strict" | "auto-aggressive" | "hands-free">("auto-strict");
  const [model, setModel] = React.useState<ComputerUseModel>("gpt-5.4-nano");
  const [concurrency, setConcurrency] = React.useState(10);
  const [run, setRun] = React.useState<ApplyRun | null>(null);
  const [events, setEvents] = React.useState<ApplyEvent[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedRows = React.useMemo(() => rows.slice(0, count), [count, rows]);
  const customJobs = React.useMemo(() => parseCustomUrls(customUrls), [customUrls]);
  const plannedCount = selectedRows.length + customJobs.length;
  const selectedIncluded = Boolean(selectedJobId && selectedRows.some((row) => row.jobId === selectedJobId));

  React.useEffect(() => {
    if (!run?.id) return;
    const runId = run.id;
    let cancelled = false;
    async function refresh() {
      try {
        const [runResponse, eventsResponse] = await Promise.all([
          fetch(`/api/applications/runs/${encodeURIComponent(runId)}`, { cache: "no-store" }),
          fetch(`/api/applications/runs/${encodeURIComponent(runId)}/events`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (runResponse.ok) {
          const body = await runResponse.json() as { run?: ApplyRun };
          if (body.run) setRun(body.run);
        }
        if (eventsResponse.ok) {
          const body = await eventsResponse.json() as { events?: ApplyEvent[] };
          setEvents(body.events ?? []);
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

  async function startBatch() {
    if (pending || plannedCount === 0) return;
    setPending(true);
    setError(null);
    try {
      const profile = readProfile();
      const jobs = [
        ...selectedRows.map((row) => ({
          id: row.jobId,
          company: row.company,
          title: row.title,
          url: row.recommendation.jobUrl,
          applicationUrl: row.recommendation.job?.jobUrl ?? row.recommendation.jobUrl,
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
      const answer = answers[group.id]?.trim();
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
      setRun((current) => current ? { ...current, questionGroups: body.groups ?? current.questionGroups } : current);
    }
  }

  async function approve(jobId: string) {
    if (!run) return;
    const response = await fetch(`/api/applications/runs/${encodeURIComponent(run.id)}/jobs/${encodeURIComponent(jobId)}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devSkipRealSubmit: true }),
    });
    if (response.ok) {
      const body = await response.json() as { job?: ApplyRun["jobs"][number] };
      if (body.job) {
        setRun((current) => current
          ? { ...current, jobs: current.jobs.map((job) => job.id === body.job!.id ? body.job! : job) }
          : current);
      }
    }
  }

  const profileReady = typeof window !== "undefined" ? isProfileUsable(readProfile()) : false;
  const pendingQuestions = run?.questionGroups.filter((group) => group.status === "pending") ?? [];

  return (
    <section className="rounded-[24px] border border-[var(--dashboard-panel-border)] bg-[var(--dashboard-panel-bg)] px-4 py-4 text-[var(--dashboard-panel-fg)] shadow-[var(--dashboard-panel-shadow)] backdrop-blur-2xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dashboard-panel-kicker)]">
            <Bot className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            Recruit2 Apply Hub
          </div>
          <h2 className="mt-2 text-lg font-semibold text-[var(--dashboard-panel-fg)]">
            Apply to shortlisted jobs with the Recruit2 computer-use pipeline
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--dashboard-panel-muted)]">
            Fill runs can proceed in parallel, grouped questions are held for one review pass, and local development approvals mark jobs as submitted without clicking real external submit.
          </p>
          {selected ? (
            <p className="mt-1 text-xs text-[var(--dashboard-panel-subtle)]">
              Selected role: {selected.company} / {selected.title}{selectedIncluded ? " is included in this batch." : " is outside the current top-job slice."}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-4 xl:w-[540px]">
          <LabeledSelect label="Jobs" value={String(count)} onChange={(value) => setCount(Number(value))}>
            {[1, 3, 5, 10, 15, 20].map((value) => (
              <option key={value} value={value}>Top {value}</option>
            ))}
          </LabeledSelect>
          <LabeledSelect label="Mode" value={mode} onChange={(value) => setMode(value as typeof mode)}>
            <option value="auto-strict">Auto Strict</option>
            <option value="auto-aggressive">Auto Aggressive</option>
            <option value="hands-free">Hands-free</option>
          </LabeledSelect>
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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(380px,1.12fr)]">
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
            <span className="text-xs text-[var(--dashboard-panel-subtle)]">
              {profileReady ? "Profile ready" : "Profile fallback may be used"} / {tailoredResume ? "selected tailored resume attached" : "resume selected per Recruit2 profile"}
            </span>
          </div>
          {error ? (
            <div className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}

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
        </div>

        <div className="space-y-4">
          {run ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {run.jobs.map((job) => (
                  <div key={job.id} className="rounded-xl border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-card-bg)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--dashboard-panel-fg)]">{job.job.company}</div>
                        <div className="truncate text-xs text-[var(--dashboard-panel-muted)]">{job.job.title}</div>
                      </div>
                      <StatusIcon status={job.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-panel-kicker)]">{job.status.replace(/_/g, " ")}</span>
                      <a href={job.job.applicationUrl ?? job.job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--dashboard-score-fg)]">
                        Site <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {job.reviewItems.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void approve(job.id)}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        disabled={job.status === "submitted_dev" || job.status === "submitted"}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Approve dev submit
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              {pendingQuestions.length > 0 ? (
                <div className="rounded-xl border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-card-bg)] p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <MessageSquareText className="h-4 w-4 text-[var(--color-accent)]" />
                    Questions to confirm
                  </div>
                  <div className="space-y-3">
                    {pendingQuestions.map((group) => (
                      <label key={group.id} className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-panel-kicker)]">
                          {group.items.length} fields / {group.requiresExplicitGate ? "explicit review" : "shared answer"}
                        </span>
                        <span className="mt-1 block text-sm text-[var(--dashboard-panel-fg)]">{group.prompt}</span>
                        <input
                          value={answers[group.id] ?? group.provisionalAnswer}
                          onChange={(event) => setAnswers((current) => ({ ...current, [group.id]: event.target.value }))}
                          className="mt-2 w-full rounded-lg border border-[var(--dashboard-panel-divider)] bg-[var(--dashboard-control-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void resolveQuestions(pendingQuestions)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--dashboard-action-border)] px-3 py-2 text-xs font-semibold text-[var(--dashboard-action-fg)]"
                  >
                    Apply answers to all jobs
                  </button>
                </div>
              ) : null}

              <div className="max-h-36 space-y-2 overflow-y-auto border-t border-[var(--dashboard-panel-divider)] pt-3">
                {(events.length ? events : run.events).slice(-8).reverse().map((event) => (
                  <div key={event.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-xs">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[var(--dashboard-panel-fg)]">{event.message}</div>
                      <div className="mt-0.5 uppercase tracking-[0.12em] text-[var(--dashboard-panel-subtle)]">{event.kind}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-[var(--dashboard-panel-divider)] text-center text-sm text-[var(--dashboard-panel-muted)]">
              Start a batch to see all application agents, grouped questions, and approval state here.
            </div>
          )}
        </div>
      </div>
    </section>
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

function StatusIcon({ status }: { status: string }) {
  if (status === "submitted_dev" || status === "submitted") {
    return <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />;
  }
  if (status === "failed" || status === "cancelled") {
    return <XCircle className="h-4 w-4 text-[var(--color-danger)]" />;
  }
  if (status === "questions_ready" || status === "review_ready") {
    return <CirclePause className="h-4 w-4 text-[var(--color-warning)]" />;
  }
  return <Loader2 className={cn("h-4 w-4 text-[var(--color-accent)]", status === "filling" && "animate-spin")} />;
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
