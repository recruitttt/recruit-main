"use client";

// 10-row sequential tailor run UI. The button kicks off runTailorPipeline,
// each row ticks queued → researching → tailoring → done [Download PDF].
// Restores cached applications from localStorage on mount so reloading
// preserves prior runs.

import * as React from "react";
import {
  ArrowDown,
  CheckCircle2,
  CircleDashed,
  Download,
  Loader2,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/ui/logo";
import { readProfile, subscribeProfile } from "@/lib/profile";
import {
  clearCachedApplications,
  downloadPdf,
  readCachedApplications,
  runTailorPipeline,
} from "@/lib/tailor/client";
import { mockTailorJobs } from "@/lib/mock-data";
import type {
  Job,
  PipelineEvent,
  TailoredApplication,
} from "@/lib/tailor/types";
import { cn } from "@/lib/utils";

type RowStatus = "queued" | "researching" | "tailoring" | "done" | "error" | "cached";

type RowState = {
  job: Job;
  status: RowStatus;
  application?: TailoredApplication;
  error?: string;
  source?: TailoredApplication["research"]["source"];
};

const STATUS_LABEL: Record<RowStatus, string> = {
  queued: "Queued",
  researching: "Researching",
  tailoring: "Tailoring",
  done: "Done",
  error: "Error",
  cached: "Cached",
};

const STATUS_COLOR: Record<RowStatus, string> = {
  queued: "text-[var(--color-fg-subtle)]",
  researching: "text-[var(--color-accent)]",
  tailoring: "text-amber-700",
  done: "text-emerald-700",
  cached: "text-emerald-700",
  error: "text-red-700",
};

function StatusIcon({ status }: { status: RowStatus }) {
  const cls = "h-3.5 w-3.5";
  if (status === "queued") return <CircleDashed className={cn(cls, "text-[var(--color-fg-subtle)]")} />;
  if (status === "researching") return <Search className={cn(cls, "text-[var(--color-accent)] animate-pulse")} />;
  if (status === "tailoring") return <Loader2 className={cn(cls, "text-amber-700 animate-spin")} />;
  if (status === "done" || status === "cached")
    return <CheckCircle2 className={cn(cls, "text-emerald-700")} />;
  return <XCircle className={cn(cls, "text-red-700")} />;
}

export function TailorRunList({ jobs = mockTailorJobs }: { jobs?: Job[] }) {
  const [profile, setProfile] = React.useState(() => readProfile());
  const [running, setRunning] = React.useState(false);
  const [rows, setRows] = React.useState<RowState[]>(() =>
    jobs.map((job) => ({ job, status: "queued" as RowStatus }))
  );

  React.useEffect(() => {
    const unsub = subscribeProfile(() => setProfile(readProfile()));
    return unsub;
  }, []);

  // Hydrate cached applications on mount so refreshes preserve prior runs.
  React.useEffect(() => {
    const cache = readCachedApplications();
    queueMicrotask(() => {
      setRows((prev) =>
        prev.map((r) => {
          const cached = cache[r.job.id];
          if (!cached) return r;
          return {
            ...r,
            status: "cached",
            application: cached,
            source: cached.research.source,
          };
        })
      );
    });
  }, []);

  const profileReady =
    !!profile.name &&
    !!profile.email &&
    profile.experience.length > 0;

  const completedCount = rows.filter((r) => r.status === "done" || r.status === "cached").length;

  const onRun = React.useCallback(async () => {
    if (!profileReady || running) return;
    setRunning(true);

    setRows((prev) =>
      prev.map((r) =>
        r.status === "cached" || r.status === "done"
          ? r
          : { ...r, status: "queued", error: undefined }
      )
    );

    const handleEvent = (ev: PipelineEvent) => {
      setRows((prev) => {
        const next = prev.slice();
        const idx = next.findIndex((r) => "jobId" in ev && r.job.id === (ev as { jobId: string }).jobId);
        if (ev.type === "research-start" && idx >= 0) {
          next[idx] = { ...next[idx], status: "researching", error: undefined };
        } else if (ev.type === "research-done" && idx >= 0) {
          next[idx] = { ...next[idx], status: "tailoring", source: ev.research.source };
        } else if (ev.type === "tailor-start" && idx >= 0) {
          next[idx] = { ...next[idx], status: "tailoring" };
        } else if (ev.type === "tailor-done" && idx >= 0) {
          next[idx] = {
            ...next[idx],
            status: "done",
            application: ev.application,
            source: ev.application.research.source,
          };
        } else if (ev.type === "skipped" && idx >= 0) {
          next[idx] = {
            ...next[idx],
            status: "cached",
            application: ev.cached,
            source: ev.cached.research.source,
          };
        } else if (ev.type === "error" && idx >= 0) {
          next[idx] = {
            ...next[idx],
            status: "error",
            error: `${ev.phase}: ${ev.reason}`,
          };
        }
        return next;
      });
    };

    try {
      await runTailorPipeline(jobs, profile, handleEvent);
    } finally {
      setRunning(false);
    }
  }, [jobs, profile, profileReady, running]);

  const onResetAndRun = React.useCallback(async () => {
    clearCachedApplications();
    setRows(jobs.map((job) => ({ job, status: "queued" as RowStatus })));
    // Defer to next tick so state propagates before run.
    setTimeout(() => onRun(), 0);
  }, [jobs, onRun]);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-3.5">
        <div>
          <h3 className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
            Tailor resumes for matched jobs
          </h3>
          <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] font-mono">
            Research agent · Tailor agent · One job at a time · {rows.length} matches
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
            {completedCount} of {rows.length}
          </span>
          {completedCount > 0 && !running && (
            <Button variant="ghost" size="sm" onClick={onResetAndRun} title="Clear cache and re-run">
              <RotateCcw className="h-3.5 w-3.5" />
              Re-run
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onRun}
            disabled={!profileReady || running}
            title={!profileReady ? "Complete onboarding first" : undefined}
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running
              </>
            ) : (
              <>Run pipeline</>
            )}
          </Button>
        </div>
      </div>

      {!profileReady && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-[12px] text-[var(--color-fg-muted)]">
          Complete onboarding so the tailor agent has a profile to work from.
        </div>
      )}

      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map((row, i) => {
          const score = row.application?.tailoringScore;
          const coverage = row.application?.keywordCoverage;
          const gaps = row.application?.tailoredResume?.tailoringNotes?.gaps ?? [];
          const qualityIssues = row.application?.tailoredResume?.tailoringNotes?.qualityIssues ?? [];
          const fallbackBg = row.job.logoBg ?? "#222";
          const fallbackText = row.job.logoText ?? row.job.company.slice(0, 1).toUpperCase();

          return (
            <li key={row.job.id} className="px-5 py-3.5">
              <div className="flex items-start gap-3">
                <div className="text-[10px] font-mono text-[var(--color-fg-subtle)] pt-1.5 w-5 shrink-0">
                  {(i + 1).toString().padStart(2, "0")}
                </div>
                <CompanyLogo bg={fallbackBg} text={fallbackText} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13.5px] font-medium text-[var(--color-fg)] truncate">
                        {row.job.company}
                      </span>
                      <span className="text-[13.5px] text-[var(--color-fg-muted)] truncate">
                        {row.job.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("flex items-center gap-1.5 text-[11px] font-mono", STATUS_COLOR[row.status])}>
                        <StatusIcon status={row.status} />
                        {STATUS_LABEL[row.status]}
                      </span>
                      {row.application && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => downloadPdf(row.application!)}
                          title="Download tailored resume PDF"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--color-fg-subtle)] font-mono flex-wrap">
                    {row.job.location && <span>{row.job.location}</span>}
                    {row.source && (
                      <>
                        <span>·</span>
                        <span title="Research source">
                          {row.source === "ingested-description"
                            ? "ingested JD"
                            : row.source === "deep-research"
                            ? "deep research"
                            : row.source === "firecrawl-fallback"
                            ? "firecrawl fallback"
                            : "title-only"}
                        </span>
                      </>
                    )}
                    {typeof score === "number" && (
                      <>
                        <span>·</span>
                        <span className="text-[var(--color-fg-muted)]">
                          tailoring {score}
                        </span>
                      </>
                    )}
                    {typeof coverage === "number" && (
                      <>
                        <span>·</span>
                        <span>keywords {coverage}%</span>
                      </>
                    )}
                    {row.application && (
                      <>
                        <span>·</span>
                        <span>{Math.round(row.application.durationMs / 1000)}s</span>
                      </>
                    )}
                  </div>
                  {row.error && (
                    <div className="mt-1.5 text-[11px] text-red-700 font-mono">
                      <ArrowDown className="inline h-3 w-3 -mt-0.5" /> {row.error}
                    </div>
                  )}
                  {gaps.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      <span className="text-[var(--color-fg-subtle)] font-mono uppercase tracking-[0.12em]">
                        gaps
                      </span>
                      {gaps.slice(0, 3).map((g, j) => (
                        <span
                          key={j}
                          className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-800"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                  {qualityIssues.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                      <span className="text-[var(--color-fg-subtle)] font-mono uppercase tracking-[0.12em]">
                        quality
                      </span>
                      {qualityIssues.slice(0, 3).map((issue, j) => (
                        <span
                          key={j}
                          className="rounded-full border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-2 py-0.5 text-[var(--color-accent)]"
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
