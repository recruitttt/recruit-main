"use client";

import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  Database,
  Filter,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { convexRefs } from "@/lib/convex-refs";
import { readProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

type RunState = "idle" | "syncing" | "ingesting" | "ranking" | "done" | "error";

type IngestionSummary = {
  status?: string;
  rawJobCount?: number;
  filteredCount?: number;
  llmScoredCount?: number;
  recommendedCount?: number;
  scoringMode?: string;
};

type Recommendation = {
  _id: string;
  jobId: string;
  rank: number;
  score: number;
  llmScore?: number;
  company: string;
  title: string;
  location?: string;
  jobUrl: string;
  compensationSummary?: string;
  rationale?: string;
  job?: {
    descriptionPlain?: string;
  } | null;
};

export function JobIngestionPanel({
  onSelectJob,
  selectedJobId,
}: {
  onSelectJob?: (job: Recommendation) => void;
  selectedJobId?: string;
}) {
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  if (!hasConvex) {
    return (
      <PanelShell>
        <div className="flex items-center justify-between gap-4">
          <PanelTitle />
          <Pill tone="warn">Convex missing</Pill>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
          Set NEXT_PUBLIC_CONVEX_URL to connect the dashboard to Convex.
        </p>
      </PanelShell>
    );
  }

  return <ConnectedJobIngestionPanel onSelectJob={onSelectJob} selectedJobId={selectedJobId} />;
}

function ConnectedJobIngestionPanel({
  onSelectJob,
  selectedJobId,
}: {
  onSelectJob?: (job: Recommendation) => void;
  selectedJobId?: string;
}) {
  const [state, setState] = useState<RunState>("idle");
  const [message, setMessage] = useState<string>("");
  const sources = useQuery(convexRefs.ashby.enabledAshbySources, {});
  const summary = useQuery(convexRefs.ashby.latestIngestionRunSummary, {});
  const recommendations = useQuery(convexRefs.ashby.currentRecommendations, {});
  const syncProfile = useMutation(convexRefs.ashby.upsertDemoProfileSnapshot);
  const seedSources = useAction(convexRefs.ashbyActions.seedAshbySourcesFromCareerOps);
  const runIngestion = useAction(convexRefs.ashbyActions.runAshbyIngestion);
  const rankRun = useAction(convexRefs.ashbyActions.rankIngestionRun);

  const busy = state === "syncing" || state === "ingesting" || state === "ranking";
  const sourceCount = Array.isArray(sources) ? sources.length : 0;
  const recs = Array.isArray(recommendations)
    ? (recommendations as Recommendation[])
    : [];
  const latest = summary as IngestionSummary | null | undefined;

  const statusTone = useMemo(() => {
    if (state === "error") return "warn";
    if (latest?.status === "completed") return "success";
    if (busy) return "accent";
    return "neutral";
  }, [busy, latest?.status, state]);

  async function handleRun(limitSources?: number) {
    try {
      setMessage("");
      setState("syncing");
      await syncProfile({ profile: readProfile() });
      if (sourceCount === 0) {
        await seedSources({});
      }

      setState("ingesting");
      const ingestion = (await runIngestion({ limitSources })) as { runId: string };

      setState("ranking");
      await rankRun({ runId: ingestion.runId });

      setState("done");
      setMessage("Scan complete.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <PanelShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <PanelTitle />
            <Pill tone={statusTone as "neutral" | "accent" | "success" | "warn"}>
              {busy ? state : latest?.status ?? "idle"}
            </Pill>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void handleRun(3)}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run first 3
          </Button>
          <Button
            variant="accent"
            size="sm"
            disabled={busy}
            onClick={() => void handleRun()}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Run full scan
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "mt-4 rounded-md border px-3 py-2 text-[12px] font-mono",
            state === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-700"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
          )}
        >
          {message}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-5">
        <Metric label="Sources" value={sourceCount || "·"} icon={Database} />
        <Metric label="Raw jobs" value={latest?.rawJobCount ?? "·"} icon={RefreshCw} />
        <Metric label="Filtered" value={latest?.filteredCount ?? "·"} icon={Filter} />
        <Metric label="Scored" value={latest?.llmScoredCount ?? "·"} icon={Sparkles} />
        <Metric label="Recommended" value={latest?.recommendedCount ?? recs.length ?? "·"} icon={ArrowUpRight} />
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[12px] font-medium text-[var(--color-fg)]">
            Ranked recommendations
          </h4>
          {latest?.scoringMode && <Pill tone="neutral">{latest.scoringMode}</Pill>}
        </div>

        {recs.length === 0 ? (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-4 text-[13px] text-[var(--color-fg-muted)]">
            {latest?.status === "completed"
              ? "No jobs cleared the 70 score bar."
              : "No ranked jobs yet."}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {recs.slice(0, 8).map((job) => {
              const selected = selectedJobId === job.jobId;
              return (
              <button
                key={job._id}
                type="button"
                onClick={() => onSelectJob?.(job)}
                className={cn(
                  "group block w-full px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-1)]",
                  selected && "bg-cyan-500/10"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
                        #{job.rank}
                      </span>
                      <span className="truncate text-[13px] font-medium text-[var(--color-fg)]">
                        {job.company}
                      </span>
                      <span className="truncate text-[13px] text-[var(--color-fg-muted)]">
                        {job.title}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-mono text-[var(--color-fg-subtle)]">
                      {job.location && <span>{job.location}</span>}
                      {job.compensationSummary && <span>{job.compensationSummary}</span>}
                    </div>
                    {job.rationale && (
                      <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
                        {job.rationale}
                      </p>
                    )}
                    {job.job?.descriptionPlain && (
                      <p className="mt-2 text-[11px] font-mono text-[var(--color-fg-subtle)]">
                        Description captured · click to inspect
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-serif text-[24px] leading-none text-[var(--color-fg)]">
                      {job.llmScore ?? job.score}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] transition-colors group-hover:text-[var(--color-accent)]" />
                  </div>
                </div>
              </button>
            );
            })}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {children}
    </div>
  );
}

function PanelTitle() {
  return (
    <h3 className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
      Ashby ingestion
    </h3>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-[var(--color-surface)] p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-2 font-serif text-[26px] leading-none text-[var(--color-fg)] tabular-nums">
        {value}
      </div>
    </div>
  );
}
