"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { isProfileUsable } from "@/lib/demo-profile";
import type { DashboardSeed } from "@/lib/dashboard-seed";
import { readProfile } from "@/lib/profile";
import { downloadPdf } from "@/lib/tailor/client";
import type { TailoredApplication } from "@/lib/tailor/types";
import { TailoredPdfViewer } from "@/components/tailored-pdf-viewer";
import { DashboardJobInspector } from "@/components/dashboard/dashboard-job-inspector";
import { DashboardLeaderboard } from "@/components/dashboard/dashboard-leaderboard";
import {
  buildLeaderboardVisualOrder,
  normalizeLeaderboardRecommendations,
  preserveLeaderboardSelection,
  shouldTriggerCosmeticShuffle,
} from "@/components/dashboard/leaderboard-helpers";
import { DashboardStatusStrip } from "@/components/dashboard/dashboard-status-strip";
import { DashboardTour } from "@/components/dashboard/dashboard-tour";
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
const SHUFFLE_SETTLE_MS = 520;

function ConnectedRecruitDashboard() {
  const reduceMotion = useReducedMotion();
  const shuffleTimerRef = useRef<number | null>(null);
  const previousRowsRef = useRef<LeaderboardRow[]>([]);

  const [runState, setRunState] = useState<PipelineRunState>("idle");
  const [runMessage, setRunMessage] = useState<string>();
  const [runError, setRunError] = useState<string>();
  const [liveError, setLiveError] = useState<string>();
  const [liveData, setLiveData] = useState<LiveDashboardPayload>();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null | undefined>(undefined);
  const [detailError, setDetailError] = useState<string>();
  const [displayRows, setDisplayRows] = useState<{ key: string; rows: LeaderboardRow[] } | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [tailorState, setTailorState] = useState<TailorState>({
    running: false,
    message: "Select a ranked job to inspect and tailor.",
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
      recommendation,
    })),
    [normalizedRecommendations],
  );
  const boardSignature = boardRows.map((row) => `${row.jobId}:${row.rank}:${Math.round(row.score)}`).join("|");
  const selection = preserveLeaderboardSelection(boardRows, selectedJobId, {
    fallbackToFirst: false,
  });
  const selectedRow = selection.selected;
  const selected = selectedRow?.recommendation ?? null;
  const renderedRows = displayRows?.key === boardSignature
    ? displayRows.rows
    : boardRows;

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
        setRefreshedAt(Date.now());
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
    if (shuffleTimerRef.current) {
      window.clearTimeout(shuffleTimerRef.current);
      shuffleTimerRef.current = null;
    }

    if (boardRows.length === 0) {
      previousRowsRef.current = [];
      return;
    }

    const shouldShuffle = !reduceMotion &&
      shouldTriggerCosmeticShuffle(previousRowsRef.current, boardRows);

    if (!shouldShuffle) {
      previousRowsRef.current = boardRows;
      return;
    }

    const visualOrder = buildLeaderboardVisualOrder(boardRows, {
      seed: boardRows.map((row) => `${row.jobId}:${row.score}`).join("|"),
      pinnedJobId: selection.selectedJobId,
    });

    previousRowsRef.current = boardRows;
    const frame = window.requestAnimationFrame(() => {
      setDisplayRows({ key: boardSignature, rows: visualOrder.shuffled });
    });
    shuffleTimerRef.current = window.setTimeout(() => {
      setDisplayRows({ key: boardSignature, rows: visualOrder.settled });
      shuffleTimerRef.current = null;
    }, SHUFFLE_SETTLE_MS);

    return () => {
      window.cancelAnimationFrame(frame);
      if (shuffleTimerRef.current) {
        window.clearTimeout(shuffleTimerRef.current);
        shuffleTimerRef.current = null;
      }
    };
  }, [boardRows, boardSignature, reduceMotion, selection.selectedJobId]);

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

  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) {
        window.clearTimeout(shuffleTimerRef.current);
      }
    };
  }, []);

  async function refreshLiveDataOnce() {
    const response = await fetch("/api/dashboard/live", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`dashboard_live_${response.status}`);
    }
    const payload = await response.json() as LiveDashboardPayload;
    setLiveData(payload);
    setRefreshedAt(Date.now());
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
      message: "Inspect the fit summary, then tailor this job when ready.",
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

  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f8fbff_0%,transparent_42%),linear-gradient(180deg,#f6f3ec_0%,#f9f7f3_48%,#f2ede2_100%)]" />
        <div className="absolute left-[8%] top-[10%] h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute right-[10%] top-[18%] h-72 w-72 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="absolute bottom-[2%] left-[30%] h-80 w-80 rounded-full bg-slate-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1520px]">
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Dashboard
          </div>
          <h1 className="mt-3 max-w-3xl text-[clamp(2.4rem,5vw,4.6rem)] font-semibold tracking-[-0.08em] text-slate-950">
            Ranked jobs, moving in and out of conviction.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            The board keeps only what matters: live ranked roles, the reasoning behind each one, and the tailoring actions that turn a match into a PDF.
          </p>
        </div>

        <div className="space-y-6">
          <div data-tour="status-strip">
            <DashboardStatusStrip
              run={liveData?.run}
              recommendationCount={boardRows.length}
              refreshedAt={refreshedAt}
              controls={controls}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(380px,0.88fr)]">
            <div data-tour="leaderboard">
              <DashboardLeaderboard
                rows={boardRows}
                displayRows={renderedRows}
                selectedJobId={selection.selectedJobId}
                loadingJobId={selected?.jobId && jobDetail === undefined ? selected.jobId : null}
                onSelect={selectRecommendation}
                mobileInlineDetail={
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
                }
              />
            </div>

            <div data-tour="inspector" className="hidden xl:block">
              <DashboardJobInspector
                selected={selected}
                detail={jobDetail}
                detailError={detailError}
                state={tailorState}
                pdf={pdfState}
                onTailor={() => void tailorSelectedJob()}
                onOpenPdf={() => setPdfViewerOpen(true)}
                onDownload={downloadTailoredPdf}
              />
            </div>
          </div>
        </div>
      </div>

      <TailoredPdfViewer
        open={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        jobId={selected?.jobId ?? null}
        filename={pdfState.filename}
        sizeKb={pdfState.sizeKb}
        pdfBase64={viewerPdfBase64}
      />

      <DashboardTour />
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

  if (recommendation.rationale) {
    return compactSentence(recommendation.rationale, 88);
  }

  return "Ranking rationale available on inspection.";
}

function compactSentence(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
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
