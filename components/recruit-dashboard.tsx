"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { isProfileUsable } from "@/lib/demo-profile";
import type { DashboardSeed } from "@/lib/dashboard-seed";
import { readProfile } from "@/lib/profile";
import { downloadPdf } from "@/lib/tailor/client";
import type { TailoredApplication } from "@/lib/tailor/types";
import { TailoredPdfViewer } from "@/components/tailored-pdf-viewer";
import { ActionButton } from "@/components/design-system";
import { DashboardJobInspector } from "@/components/dashboard/dashboard-job-inspector";
import { DashboardLeaderboard } from "@/components/dashboard/dashboard-leaderboard";
import {
  buildLeaderboardVisualOrder,
  normalizeLeaderboardRecommendations,
  preserveLeaderboardSelection,
} from "@/components/dashboard/leaderboard-helpers";
import { IntakeProgressBanner } from "@/components/dashboard/intake-progress-banner";
import type {
  DashboardRunControls,
  JobDetail,
  LeaderboardRow,
  LiveDashboardPayload,
  LiveRecommendation,
  LiveRunSummary,
  TailorState,
} from "@/components/dashboard/dashboard-types";

type PipelineRunState = "idle" | "syncing" | "ingesting" | "ranking" | "done" | "error";

const FAST_INTERVAL_MS = 2500;
const SLOW_INTERVAL_MS = 8000;

function ConnectedRecruitDashboard() {
  const [runState, setRunState] = useState<PipelineRunState>("idle");
  const [runMessage, setRunMessage] = useState<string>();
  const [runError, setRunError] = useState<string>();
  const [liveError, setLiveError] = useState<string>();
  const [liveData, setLiveData] = useState<LiveDashboardPayload>();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null | undefined>(undefined);
  const [detailError, setDetailError] = useState<string>();
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [tailorState, setTailorState] = useState<TailorState>({
    running: false,
    message: "Select an application to inspect and tailor.",
  });

  const normalizedRecommendations = useMemo(
    () => normalizeLeaderboardRecommendations(liveData?.recommendations ?? []),
    [liveData?.recommendations],
  );
  const boardRows: LeaderboardRow[] = useMemo(
    () => normalizedRecommendations.map((recommendation) => ({
      key: recommendation.jobId,
      jobId: recommendation.jobId,
      rank: recommendation.trueRank,
      title: recommendation.title,
      company: recommendation.company,
      locationLabel: recommendation.location?.trim() || "Location pending",
      providerLabel: providerLabel(recommendation),
      score: recommendation.score,
      secondaryLine: secondaryLine(recommendation),
      ...applicationStatus(recommendation, liveData?.run),
      recommendation,
    })),
    [liveData?.run, normalizedRecommendations],
  );
  const selection = preserveLeaderboardSelection(boardRows, selectedJobId, {
    fallbackToFirst: false,
  });
  const selectedRow = selection.selected;
  const selected = selectedRow?.recommendation ?? null;
  const renderedRows = useMemo(
    () => buildLeaderboardVisualOrder(boardRows, {
      seed: `applications:${boardRows.map((row) => row.jobId).join("|")}`,
      pinnedJobId: selection.selectedJobId,
    }).shuffled,
    [boardRows, selection.selectedJobId],
  );

  const busy = runState === "syncing" ||
    runState === "ingesting" ||
    runState === "ranking" ||
    Boolean(liveData?.run?.tailoringInProgress) ||
    Boolean(liveData?.run && ["fetching", "fetched", "ranking"].includes(liveData.run.status));

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/dashboard/live", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`dashboard_live_${response.status}`);
        }

        const payload = await response.json() as LiveDashboardPayload;
        if (cancelled) return;
        setLiveData(payload);
        setLiveError(undefined);
        setRefreshedAt(new Date().getTime());
      } catch (error) {
        if (cancelled) return;
        setLiveError(error instanceof Error ? error.message : String(error));
        setLiveData({ run: null, recommendations: [] });
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, busy ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [busy]);

  useEffect(() => {
    const activeJobId = selected?.jobId;
    if (typeof activeJobId !== "string" || !activeJobId) return;
    const jobId = activeJobId;

    let cancelled = false;

    async function loadDetail() {
      try {
        const response = await fetch(`/api/dashboard/job-detail?jobId=${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? `job_detail_${response.status}`);
        }

        const payload = await response.json() as { detail: JobDetail };
        if (!cancelled) {
          setJobDetail(payload.detail);
        }
      } catch (error) {
        if (cancelled) return;
        setJobDetail(null);
        setDetailError(error instanceof Error ? error.message : String(error));
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selected?.jobId]);

  async function refreshLiveDataOnce() {
    const response = await fetch("/api/dashboard/live", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`dashboard_live_${response.status}`);
    }
    const payload = await response.json() as LiveDashboardPayload;
    setLiveData(payload);
    setRefreshedAt(new Date().getTime());
    setLiveError(undefined);
  }

  async function loadJobDetail(jobId: string) {
    const response = await fetch(`/api/dashboard/job-detail?jobId=${encodeURIComponent(jobId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error ?? `job_detail_${response.status}`);
    }
    const payload = await response.json() as { detail: JobDetail };
    setJobDetail(payload.detail);
    setDetailError(undefined);
  }

  async function runFirstThreeSources() {
    if (busy || !canStartRun(liveData?.run)) return;

    try {
      setRunError(undefined);
      setRunMessage("Preparing Ashby sources...");
      setRunState("syncing");

      setRunMessage("Fetching jobs from the first 3 Ashby sources...");
      setRunState("ingesting");

      setRunMessage("Ranking scraped jobs...");
      setRunState("ranking");

      const response = await fetch("/api/dashboard/run-first-3", { method: "POST" });
      const body = await response.json().catch(() => null) as
        | { error?: string; rankingWarning?: string | null }
        | null;

      if (!response.ok) {
        throw new Error(body?.error ?? `dashboard_run_${response.status}`);
      }

      setRunState("done");
      setRunMessage(
        body?.rankingWarning
          ? `Ingestion completed with a ranking warning: ${body.rankingWarning}`
          : "Pipeline run complete. Board refreshed from live data.",
      );
      await refreshLiveDataOnce();
    } catch (error) {
      setRunState("error");
      setRunError(error instanceof Error ? error.message : String(error));
      setRunMessage(undefined);
    }
  }

  function selectRecommendation(recommendation: LiveRecommendation) {
    if (!recommendation.jobId) {
      setTailorState({
        running: false,
        message: "This recommendation is missing a persisted job id.",
        error: "missing_job_id",
      });
      return;
    }

    setSelectedJobId(recommendation.jobId);
    setJobDetail(undefined);
    setDetailError(undefined);
    setPdfViewerOpen(false);
    setTailorState({
      running: false,
      message: "Inspect the role, then tailor this job when ready.",
    });
  }

  async function tailorSelectedJob() {
    if (!selected?.jobId || tailorState.running) return;

    const profile = readProfile();
    const usingDemoProfile = !isProfileUsable(profile);

    try {
      setTailorState({
        running: true,
        message: usingDemoProfile
          ? "Using the sample profile from Convex, then tailoring this job..."
          : "Researching the selected role and tailoring the resume...",
      });

      const response = await fetch("/api/dashboard/tailor-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selected.jobId, profile }),
      });
      const body = await response.json().catch(() => null) as
        | { ok: true; application: TailoredApplication; profileSource?: "browser" | "demo" }
        | { ok: false; reason?: string }
        | null;

      if (!response.ok || !body || !body.ok) {
        throw new Error(body && !body.ok ? body.reason ?? `tailor_${response.status}` : `tailor_${response.status}`);
      }

      setTailorState({
        running: false,
        message: body.profileSource === "demo"
          ? "Tailored resume ready using the sample Convex profile. PDF is available for this session."
          : "Tailored resume ready. PDF is available for this session.",
        downloadable: body.application,
      });

      await Promise.all([
        loadJobDetail(selected.jobId),
        refreshLiveDataOnce(),
      ]);
    } catch (error) {
      setTailorState({
        running: false,
        message: "Tailoring failed.",
        error: error instanceof Error ? error.message : String(error),
      });
      await refreshLiveDataOnce().catch(() => undefined);
    }
  }

  function downloadTailoredPdf() {
    if (tailorState.downloadable) {
      downloadPdf(tailorState.downloadable);
      return;
    }

    if (selected?.jobId && (jobDetail?.tailoredApplication?.pdfBase64 || artifactOf(jobDetail?.artifacts ?? [], "pdf_file"))) {
      window.location.href = `/api/dashboard/resume-pdf?jobId=${encodeURIComponent(selected.jobId)}`;
    }
  }

  const artifacts = jobDetail?.artifacts ?? [];
  const persistedPdfBase64 =
    (jobDetail?.tailoredApplication?.pdfBase64 as string | undefined) ??
    ((artifactOf(artifacts, "pdf_file")?.payload as { base64?: string } | undefined)?.base64 ?? null);
  const viewerPdfBase64 = tailorState.downloadable?.pdfBase64 ?? persistedPdfBase64 ?? null;
  const hasPersistedPdf = Boolean(persistedPdfBase64 || artifactOf(artifacts, "pdf_file"));
  const pdfState = {
    canView: Boolean(viewerPdfBase64 || (selected?.jobId && hasPersistedPdf)),
    canDownload: Boolean(tailorState.downloadable || hasPersistedPdf),
    filename: jobDetail?.tailoredApplication?.pdfFilename,
    sizeKb: jobDetail?.tailoredApplication?.pdfByteLength
      ? Math.round(jobDetail.tailoredApplication.pdfByteLength / 1024)
      : undefined,
    ready: Boolean(tailorState.downloadable || jobDetail?.tailoredApplication?.pdfReady),
  };

  const controls: DashboardRunControls = {
    canRun: canStartRun(liveData?.run),
    busy,
    label: runButtonLabel(liveData?.run),
    message: runMessage ?? runGuardMessage(liveData?.run),
    error: runError ?? liveError,
    onRunFirst3: () => void runFirstThreeSources(),
  };
  const readyCount = boardRows.filter((row) => row.statusLabel === "Ready").length;
  const needsReviewCount = boardRows.filter((row) => row.statusLabel === "Needs review").length;

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-4 py-6 text-[var(--color-fg)] md:px-8 md:py-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-fg)] md:text-4xl">
              Applications
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-fg-muted)]">
              {dashboardSummary(boardRows.length, readyCount, needsReviewCount, refreshedAt)}
            </p>
          </div>
          <ActionButton
            disabled={!controls.canRun || controls.busy}
            onClick={controls.onRunFirst3}
            className="self-start"
          >
            <Search className="h-4 w-4" />
            {controls.busy ? "Running" : "Start search"}
          </ActionButton>
        </div>

        <div className="mb-4">
          <IntakeProgressBanner />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <SummaryPill>{liveData?.run ? statusLabel(liveData.run) : "Idle"}</SummaryPill>
          <SummaryPill>{boardRows.length} applications</SummaryPill>
          <SummaryPill>{readyCount} ready</SummaryPill>
          {needsReviewCount > 0 ? <SummaryPill>{needsReviewCount} need review</SummaryPill> : null}
          <SummaryPill>{refreshedAt ? `Updated ${formatTime(refreshedAt)}` : "Awaiting sync"}</SummaryPill>
        </div>

        {controls.error || controls.message ? (
          <div
            className={
              controls.error
                ? "mb-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                : "mb-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-fg-muted)]"
            }
          >
            {controls.error ?? controls.message}
          </div>
        ) : null}

        <DashboardLeaderboard
          rows={boardRows}
          displayRows={renderedRows}
          selectedJobId={selection.selectedJobId}
          loadingJobId={selected?.jobId && jobDetail === undefined ? selected.jobId : null}
          onSelect={selectRecommendation}
        />
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close application details"
            className="absolute inset-0 bg-[#102016]/24"
            onClick={() => setSelectedJobId(null)}
          />
          <aside className="absolute inset-y-0 right-0 w-full max-w-[560px] overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-[-24px_0_70px_-42px_rgba(16,32,22,0.38)] md:p-5">
            <div className="sticky top-0 z-10 mb-3 flex justify-end bg-[var(--color-bg)] py-1 backdrop-blur">
              <button
                type="button"
                aria-label="Close application details"
                onClick={() => setSelectedJobId(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <DashboardJobInspector
              inline
              selected={selected}
              detail={jobDetail}
              detailError={detailError}
              state={tailorState}
              pdf={pdfState}
              onTailor={() => void tailorSelectedJob()}
              onOpenPdf={() => setPdfViewerOpen(true)}
              onDownload={downloadTailoredPdf}
            />
          </aside>
        </div>
      ) : null}

      <TailoredPdfViewer
        open={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        jobId={selected?.jobId ?? null}
        filename={pdfState.filename}
        sizeKb={pdfState.sizeKb}
        pdfBase64={viewerPdfBase64}
      />
    </main>
  );
}

function providerLabel(recommendation: LiveRecommendation) {
  const sourceSlug = recommendation.job?.sourceSlug ?? "";
  if (sourceSlug === "custom-jd" || recommendation.job?.jobUrl?.startsWith("custom-jd:")) {
    return "Custom JD";
  }
  if (!sourceSlug) {
    return "Ashby";
  }
  const [source] = sourceSlug.split(":");
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function secondaryLine(recommendation: LiveRecommendation) {
  if (recommendation.compensationSummary) {
    return recommendation.compensationSummary;
  }

  return providerLabel(recommendation);
}

function applicationStatus(
  recommendation: LiveRecommendation,
  run: LiveRunSummary | null | undefined,
): Pick<LeaderboardRow, "statusLabel" | "statusTone" | "actionLabel"> {
  const rank = Number.isFinite(recommendation.rank) ? recommendation.rank : Number.MAX_SAFE_INTEGER;
  const tailoredCount = run?.tailoredCount ?? 0;
  const tailoringTargetCount = run?.tailoringTargetCount ?? (run?.tailoringInProgress ? Math.min(run.recommendedCount || 3, 3) : 0);

  if (run?.status === "failed") {
    return { statusLabel: "Needs review", statusTone: "warning", actionLabel: "Review" };
  }

  if (tailoredCount > 0 && rank <= tailoredCount) {
    return { statusLabel: "Ready", statusTone: "success", actionLabel: "View" };
  }

  if (run?.tailoringInProgress && rank <= Math.max(tailoringTargetCount, tailoredCount)) {
    return { statusLabel: "Tailoring", statusTone: "active", actionLabel: "Open" };
  }

  if (run?.status === "ranking") {
    return { statusLabel: "Sorting", statusTone: "active", actionLabel: "Open" };
  }

  if (run?.status === "fetching" || run?.status === "fetched") {
    return { statusLabel: "Queued", statusTone: "neutral", actionLabel: "Open" };
  }

  return { statusLabel: "Queued", statusTone: "neutral", actionLabel: "Open" };
}

function dashboardSummary(
  applicationCount: number,
  readyCount: number,
  needsReviewCount: number,
  refreshedAt: number | null,
) {
  if (applicationCount === 0) {
    return "Start a search to build the application list. Jobs stay unranked until the fit signals are ready.";
  }

  const parts = [
    `${applicationCount} ${applicationCount === 1 ? "application" : "applications"}`,
    `${readyCount} ready`,
  ];
  if (needsReviewCount > 0) {
    parts.push(`${needsReviewCount} need review`);
  }
  if (refreshedAt) {
    parts.push(`updated ${formatTime(refreshedAt)}`);
  }

  return parts.join(" · ");
}

function SummaryPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-[var(--color-fg-muted)] shadow-[0_10px_24px_-20px_rgba(16,32,22,0.3)]">
      {children}
    </span>
  );
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(run: LiveRunSummary) {
  if (run.status === "fetching") return "Searching";
  if (run.status === "fetched") return "Staging";
  if (run.status === "ranking") return "Sorting";
  if (run.status === "completed" && run.tailoringInProgress) return "Tailoring";
  if (run.status === "completed") return "Ready";
  return "Needs review";
}

function artifactOf(
  artifacts: JobDetail["artifacts"],
  kind: NonNullable<JobDetail["artifacts"]>[number]["kind"],
) {
  return artifacts?.find((artifact) => artifact.kind === kind);
}

function canStartRun(run: LiveRunSummary | null | undefined) {
  if (!run) return true;
  if (run.tailoringInProgress) return false;
  return !["fetching", "fetched", "ranking", "failed"].includes(run.status);
}

function runButtonLabel(run: LiveRunSummary | null | undefined) {
  if (!run) return "Run first 3";
  if (run.tailoringInProgress) return "Tailoring active";
  if (["fetching", "fetched", "ranking"].includes(run.status)) return "Run active";
  if (run.status === "failed") return "Reset required";
  return "Run first 3";
}

function runGuardMessage(run: LiveRunSummary | null | undefined) {
  if (!run) return undefined;
  if (run.tailoringInProgress) {
    return "Top matches are being tailored in the background. You can keep inspecting the board.";
  }
  if (["fetching", "fetched", "ranking"].includes(run.status)) {
    return "A live ingestion run is already active. Wait for it to finish before starting another.";
  }
  if (run.status === "failed") {
    return "Latest run failed. Review the board state before starting another ingestion.";
  }
  return undefined;
}

export function RecruitDashboard({ seed }: { seed?: DashboardSeed }) {
  void seed;
  return <ConnectedRecruitDashboard />;
}
