"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import {
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Loader2,
  MapPin,
  Radio,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { isProfileUsable } from "@/lib/demo-profile";
import { resolveCompanyLogoAsset } from "@/lib/company-logos";
import type { DashboardSeed } from "@/lib/dashboard-seed";
import { readProfile } from "@/lib/profile";
import { downloadPdf } from "@/lib/tailor/client";
import type { JobResearch, TailoredApplication } from "@/lib/tailor/types";
import { TailoredPdfViewer } from "@/components/tailored-pdf-viewer";
import {
  normalizeLeaderboardRecommendations,
  preserveLeaderboardSelection,
} from "@/components/dashboard/leaderboard-helpers";
import { IntakeProgressBanner } from "@/components/dashboard/intake-progress-banner";
import { DashboardStatusStrip } from "@/components/dashboard/dashboard-status-strip";
import { AnimatedNumber, AnimatedProgressBar } from "@/components/dashboard/metric-animation";
import { useRankedListMotion } from "@/components/dashboard/ranked-list-motion";
import {
  DashboardCommandBar,
  type DashboardCommandResult,
  type DashboardCommandStatus,
} from "@/components/dashboard/dashboard-command-bar";
import {
  DashboardLoadingGlobe,
  type DashboardLoadingPhase,
} from "@/components/dashboard/dashboard-loading-globe";
import { StarClusterField } from "@/components/visual/star-cluster-field";
import { ThemeParticleFall } from "@/components/visual/theme-particle-fall";
import { cn } from "@/lib/utils";
import type {
  DashboardCommandJob,
  DashboardCommandResponse,
} from "@/lib/dashboard-command/types";
import type {
  DashboardRunControls,
  JobDetail,
  LeaderboardRow,
  LiveDashboardPayload,
  LivePipelineLog,
  LiveRecommendation,
  LiveRunSummary,
  OrganizationLogo,
  TailorState,
} from "@/components/dashboard/dashboard-types";

type PipelineRunState = "idle" | "syncing" | "ingesting" | "ranking" | "done" | "error";
type TemplateId = "minimalist" | "classic" | "compact";

const FAST_INTERVAL_MS = 2500;
const SLOW_INTERVAL_MS = 8000;
const AUTO_SCORE_SORT_DELAY_MS = 2800;

type DashboardCommandApiResponse =
  | {
      ok: true;
      command: DashboardCommandResponse;
      model: { provider: string; modelId: string; fallbackUsed: boolean };
      sponsor: { name: string; provider: string; placement: string; active: boolean };
    }
  | {
      ok: false;
      reason: string;
    };

type DashboardCommandHistory = {
  past: Array<DashboardCommandResponse | null>;
  present: DashboardCommandResponse | null;
  future: Array<DashboardCommandResponse | null>;
};

const EMPTY_COMMAND_HISTORY: DashboardCommandHistory = {
  past: [],
  present: null,
  future: [],
};

const MAX_COMMAND_HISTORY = 30;

function ConnectedRecruitDashboard() {
  const reduceMotion = useReducedMotion();
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
  const [commandStatus, setCommandStatus] = useState<DashboardCommandStatus>("idle");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [commandResult, setCommandResult] = useState<DashboardCommandResult | null>(null);
  const [commandHistory, setCommandHistory] = useState<DashboardCommandHistory>(EMPTY_COMMAND_HISTORY);
  const [templateId] = useState<TemplateId>("minimalist");
  const [tailorState, setTailorState] = useState<TailorState>({
    running: false,
    message: "Select an application to inspect and tailor.",
  });
  const commandPatch = commandHistory.present;

  const normalizedRecommendations = useMemo(
    () => normalizeLeaderboardRecommendations(liveData?.recommendations ?? []),
    [liveData?.recommendations],
  );
  const scoreSortedRecommendations = useMemo(
    () => [...normalizedRecommendations].sort(compareRecommendationsByScore),
    [normalizedRecommendations],
  );
  const sourceOrderedJobIds = useMemo(
    () => normalizedRecommendations.map((recommendation) => recommendation.jobId),
    [normalizedRecommendations],
  );
  const boardRows: LeaderboardRow[] = useMemo(
    () => scoreSortedRecommendations.map((recommendation, index) => {
      const scoreRank = index + 1;
      const scoreRankedRecommendation = {
        ...recommendation,
        rank: scoreRank,
        trueRank: scoreRank,
      };
      return {
        key: recommendation.jobId,
        jobId: recommendation.jobId,
        rank: scoreRank,
        title: recommendation.title,
        company: recommendation.company,
        locationLabel: recommendation.location?.trim() || "Location pending",
        providerLabel: providerLabel(recommendation),
        score: recommendation.score,
        secondaryLine: secondaryLine(recommendation),
        ...applicationStatus(scoreRankedRecommendation, liveData?.run),
        recommendation: scoreRankedRecommendation,
      };
    }),
    [liveData?.run, scoreSortedRecommendations],
  );
  const selection = preserveLeaderboardSelection(boardRows, selectedJobId, {
    fallbackToFirst: false,
  });
  const selectedRow = selection.selected;
  const selected = selectedRow?.recommendation ?? null;

  const busy = runState === "syncing" ||
    runState === "ingesting" ||
    runState === "ranking" ||
    Boolean(liveData?.run?.tailoringInProgress) ||
    Boolean(liveData?.run && ["fetching", "fetched", "ranking"].includes(liveData.run.status));

  const applyCommandPatch = useCallback((next: DashboardCommandResponse | null) => {
    setCommandHistory((current) => {
      if (dashboardCommandsEqual(current.present, next)) return current;
      return {
        past: [...current.past, current.present].slice(-MAX_COMMAND_HISTORY),
        present: next,
        future: [],
      };
    });
  }, []);

  const announceCommandHistory = useCallback((title: string, patch: DashboardCommandResponse | null) => {
    setCommandStatus("success");
    setCommandError(null);
    setCommandResult({
      title,
      body: patch ? <CommandResultBody command={patch} /> : "Restored the unfiltered board.",
      meta: "Keyboard shortcut",
    });
  }, []);

  const undoCommandPatch = useCallback(() => {
    if (commandHistory.past.length === 0) return;

    const previous = commandHistory.past[commandHistory.past.length - 1] ?? null;
    setCommandHistory({
      past: commandHistory.past.slice(0, -1),
      present: previous,
      future: [commandHistory.present, ...commandHistory.future].slice(0, MAX_COMMAND_HISTORY),
    });
    announceCommandHistory(previous ? "Restored previous K2 command" : "Undid K2 command", previous);
  }, [announceCommandHistory, commandHistory]);

  const redoCommandPatch = useCallback(() => {
    if (commandHistory.future.length === 0) return;

    const next = commandHistory.future[0] ?? null;
    setCommandHistory({
      past: [...commandHistory.past, commandHistory.present].slice(-MAX_COMMAND_HISTORY),
      present: next,
      future: commandHistory.future.slice(1),
    });
    announceCommandHistory(next ? "Redid K2 command" : "Redid cleared board", next);
  }, [announceCommandHistory, commandHistory]);

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
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const modifier = event.metaKey || event.ctrlKey;
      const redo = modifier && (event.shiftKey && key === "z");
      const undo = modifier && !event.shiftKey && key === "z";
      if ((!undo && !redo) || isEditableShortcutTarget(event.target)) return;

      if (undo && commandHistory.past.length > 0) {
        event.preventDefault();
        undoCommandPatch();
      } else if (redo && commandHistory.future.length > 0) {
        event.preventDefault();
        redoCommandPatch();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandHistory.future.length, commandHistory.past.length, redoCommandPatch, undoCommandPatch]);

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

  async function runDashboardCommand(command: string) {
    const normalized = command.toLowerCase();
    setCommandStatus("loading");
    setCommandError(null);
    setCommandResult(null);

    try {
      if (normalized.includes("search") || normalized.includes("source") || normalized.includes("ingest")) {
        if (!controls.canRun || controls.busy) {
          throw new Error(controls.message ?? "A dashboard run is already active.");
        }

        await runFirstThreeSources();
        applyCommandPatch(null);
        setCommandResult({
          title: "Search started",
          body: "Recruit is fetching the first three sources and will refresh the board as live results arrive.",
          meta: "Dashboard action",
        });
        setCommandStatus("success");
        return;
      }

      if (normalized.includes("top") || normalized.includes("best") || normalized.includes("first")) {
        const topRow = boardRows[0];
        if (!topRow) {
          throw new Error("No ranked jobs are available yet.");
        }

        selectRecommendation(topRow.recommendation);
        applyCommandPatch({
          intent: "explain",
          answer: `${topRow.company} / ${topRow.title} is selected with a fit score of ${Math.round(topRow.score)}.`,
          filters: [],
          reorder: {
            jobIds: boardRows.map((row) => row.jobId),
            reason: "Opened the current top-ranked role.",
          },
          explanations: [{
            jobId: topRow.jobId,
            summary: topRow.recommendation.rationale ?? "Top-ranked role by current fit score.",
            evidence: [`Fit score ${Math.round(topRow.score)}`],
          }],
          suggestedChips: ["Explain top fit", "Compare risk", "Tailor selected"],
        });
        setCommandResult({
          title: "Opened top match",
          body: `${topRow.company} / ${topRow.title} is selected with a fit score of ${Math.round(topRow.score)}.`,
          meta: "Board navigation",
        });
        setCommandStatus("success");
        return;
      }

      if (normalized.includes("tailor") || normalized.includes("pdf") || normalized.includes("resume")) {
        if (!selected) {
          throw new Error("Select an application before tailoring.");
        }
        if (tailorState.running) {
          throw new Error("Tailoring is already running for the selected application.");
        }

        await tailorSelectedJob();
        setCommandResult({
          title: "Tailoring requested",
          body: `Recruit is preparing the tailored package for ${selected.company}.`,
          meta: "Application workflow",
        });
        setCommandStatus("success");
        return;
      }

      const response = await fetch("/api/dashboard/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: command,
          context: {
            jobs: commandJobs(boardRows),
            selectedJobId: selection.selectedJobId,
            visibleJobIds: displayRows.map((row) => row.jobId),
            run: liveData?.run ?? null,
          },
        }),
      });
      const json = await response.json().catch(() => null) as DashboardCommandApiResponse | null;
      if (!response.ok || !json?.ok) {
        throw new Error(json && !json.ok ? json.reason : `dashboard_command_${response.status}`);
      }

      if (json.command.intent === "clear") {
        applyCommandPatch(null);
      } else {
        applyCommandPatch(json.command);
      }

      setCommandResult({
        title: commandResultTitle(json.command),
        body: <CommandResultBody command={json.command} />,
        meta: commandModelMeta(json),
      });
      setCommandStatus("success");
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : String(error));
      setCommandStatus("error");
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
        body: JSON.stringify({ jobId: selected.jobId, profile, templateId }),
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
  const hasPersistedPdf = Boolean(persistedPdfBase64);
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
    onRunPipeline: () => void runFirstThreeSources(),
  };
  const readyCount = boardRows.filter((row) => row.statusLabel === "Ready").length;
  const needsReviewCount = boardRows.filter((row) => row.statusLabel === "Needs review").length;
  const ruledOutCount = boardRows.filter(isRuledOutRow).length;
  const averageScore = average(boardRows.map((row) => row.score));
  const topScore = Math.max(0, ...boardRows.map((row) => row.score));
  const topCompanies = companyBreakdown(boardRows);
  const latestLogs = liveData?.logs ?? [];
  const listSorting = isListSorting(liveData?.run, runState);
  const baseDisplayRows = useMemo(
    () => listSorting && !reduceMotion
      ? sortingPreviewRows(boardRows, liveData?.run, refreshedAt)
      : boardRows,
    [boardRows, listSorting, liveData?.run, reduceMotion, refreshedAt],
  );
  const displayRows = promoteViableRows(applyDashboardCommandRows(baseDisplayRows, commandPatch));
  const scoreSortPreviewRows = orderRowsByJobIds(displayRows, sourceOrderedJobIds);
  const {
    displayRows: animatedDisplayRows,
    isSettling: listSettling,
  } = useRankedListMotion(displayRows, {
    enabled: !listSorting && !commandPatch,
    preRankRows: scoreSortPreviewRows,
    settleDelayMs: AUTO_SCORE_SORT_DELAY_MS,
    seed: liveData?.run?._id ?? refreshedAt ?? "ranked-jobs",
  });
  const highlightedJobIds = useMemo(
    () => new Set(commandPatch?.explanations.map((item) => item.jobId) ?? []),
    [commandPatch],
  );
  const loadingPhase = dashboardLoadingPhase(liveData?.run, runState);
  const showLoadingGlobe = isListSorting(liveData?.run, runState);
  const calmTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const };
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--dashboard-bg)] text-[var(--color-fg)] [background-image:var(--dashboard-bg-gradient)]">
      <DashboardAtmosphere reduceMotion={Boolean(reduceMotion)} />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 pb-28 pt-4 sm:pb-28 md:px-7 md:pb-32 md:pt-6 lg:pb-28">
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={calmTransition}
          className="mb-4 flex flex-col gap-4 border-b border-[var(--dashboard-border)] pb-4 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dashboard-kicker)]">
              <Radio className="h-3.5 w-3.5 text-[var(--dashboard-kicker-icon)]" />
              {liveData?.run ? statusLabel(liveData.run) : "Idle"} run
              <span className="text-[var(--color-fg-subtle)]">/</span>
              {refreshedAt ? `Updated ${formatTime(refreshedAt)}` : "Awaiting sync"}
            </div>
            <h1 className="text-4xl font-semibold text-[var(--dashboard-header-fg)] md:text-5xl">
              Applications
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--dashboard-header-muted)]">
              {dashboardSummary(boardRows.length, readyCount, needsReviewCount, ruledOutCount, refreshedAt)}
            </p>
          </div>

          <ThinAction
            disabled={!controls.canRun || controls.busy}
            onClick={controls.onRunPipeline}
            className="self-start border-[var(--dashboard-action-border)] text-[var(--dashboard-action-fg)] hover:border-[var(--color-fg)] hover:text-[var(--color-fg)] lg:self-end"
          >
            {controls.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {controls.busy ? "Running" : "Start search"}
          </ThinAction>
        </motion.header>

        <div className="mb-3">
          <IntakeProgressBanner />
        </div>

        <div className="mb-6 flex flex-col gap-6">
          <div className="order-2 md:order-1">
            <DashboardStatusStrip
              run={liveData?.run}
              recommendationCount={boardRows.length}
              refreshedAt={refreshedAt}
              controls={controls}
            />
          </div>

          <AnimatePresence initial={false}>
            {showLoadingGlobe ? (
              <DashboardLoadingGlobe
                key="dashboard-loading-globe"
                phase={loadingPhase}
                className="order-1 md:order-2"
              />
            ) : null}
          </AnimatePresence>
        </div>

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.16fr)_minmax(360px,0.84fr)] lg:items-start">
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <JobList
              rows={animatedDisplayRows}
              selectedJobId={selection.selectedJobId}
              loadingJobId={selected?.jobId && jobDetail === undefined ? selected.jobId : null}
              reduceMotion={Boolean(reduceMotion)}
              sorting={listSorting || listSettling}
              commandLabel={commandPatch ? commandResultTitle(commandPatch) : undefined}
              highlightedJobIds={highlightedJobIds}
              onSelect={selectRecommendation}
            />
          </div>

          <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              {selected ? (
                <JobStatsPanel
                  key={selected.jobId}
                  selected={selected}
                  detail={jobDetail}
                  detailError={detailError}
                  tailorState={tailorState}
                  pdf={pdfState}
                  transition={calmTransition}
                  onTailor={() => void tailorSelectedJob()}
                  onOpenPdf={() => setPdfViewerOpen(true)}
                  onDownload={downloadTailoredPdf}
                  onClear={() => setSelectedJobId(null)}
                />
              ) : (
                <OverviewPanel
                  key="overview"
                  run={liveData?.run}
                  rows={boardRows}
                  readyCount={readyCount}
                  averageScore={averageScore}
                  topScore={topScore}
                  topCompanies={topCompanies}
                  logs={latestLogs}
                  transition={calmTransition}
                />
              )}
            </AnimatePresence>
          </aside>
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
      <DashboardCommandBar
        status={commandStatus}
        error={commandError}
        result={commandResult}
        pinned
        onSubmit={runDashboardCommand}
        onClearResult={() => {
          setCommandStatus("idle");
          setCommandError(null);
          setCommandResult(null);
          applyCommandPatch(null);
        }}
      />
    </main>
  );
}

function DashboardAtmosphere({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "var(--dashboard-atmosphere-overlay)" }}
      />
      <motion.div
        className="theme-light-glow absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.10) 22%, rgba(232,244,226,0.16) 38%, transparent 58%), linear-gradient(245deg, transparent 4%, rgba(244,194,107,0.045) 30%, transparent 54%)",
          backgroundSize: "220% 220%, 180% 180%",
          backgroundPosition: "0% 24%, 100% 12%",
        }}
        animate={reduceMotion ? undefined : {
          backgroundPosition: ["0% 24%, 100% 12%", "90% 58%, 20% 42%", "0% 24%, 100% 12%"],
        }}
        transition={reduceMotion ? undefined : { duration: 82, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: "var(--dashboard-grid-opacity)",
          backgroundImage:
            "linear-gradient(var(--dashboard-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--dashboard-grid-cross-line) 1px, transparent 1px)",
          backgroundPosition: "0 0",
          backgroundSize: "72px 72px",
        }}
        animate={reduceMotion ? undefined : { backgroundPosition: ["0px 0px", "72px 144px"] }}
        transition={reduceMotion ? undefined : { duration: 150, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
      />
      <StarClusterField variant="dashboard" />
      <ThemeParticleFall />
    </div>
  );
}

function JobList({
  rows,
  selectedJobId,
  loadingJobId,
  reduceMotion,
  sorting,
  commandLabel,
  highlightedJobIds,
  onSelect,
}: {
  rows: LeaderboardRow[];
  selectedJobId: string | null;
  loadingJobId: string | null;
  reduceMotion: boolean;
  sorting: boolean;
  commandLabel?: string;
  highlightedJobIds: Set<string>;
  onSelect: (recommendation: LiveRecommendation) => void;
}) {
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-[620px] text-[var(--dashboard-panel-fg)] lg:pr-1"
    >
      <div className="flex items-end justify-between gap-3 border-b border-[var(--dashboard-panel-divider)] pb-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--dashboard-panel-fg)]">Ranked jobs</h2>
          <p className="mt-1 text-sm text-[var(--dashboard-panel-muted)]">
            {commandLabel ? `${rows.length} roles in ${commandLabel.toLowerCase()}.` : `${rows.length} roles from frontier AI and automation teams.`}
          </p>
        </div>
        <div className="hidden text-right text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-panel-kicker)] sm:block">
          {sorting ? "Sorting by score" : "Fit score"}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
          <div>
            <BriefcaseBusiness className="mx-auto h-8 w-8 text-[var(--dashboard-panel-subtle)]" />
            <div className="mt-3 text-lg font-semibold text-[var(--dashboard-panel-fg)]">No jobs yet</div>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--dashboard-panel-muted)]">
              Start a search to populate the ranked list.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[var(--dashboard-panel-divider)] border-b border-[var(--dashboard-panel-divider)]">
          {rows.map((row, index) => (
            <JobListRow
              key={row.jobId}
              row={row}
              active={selectedJobId === row.jobId}
              loading={loadingJobId === row.jobId}
              highlighted={highlightedJobIds.has(row.jobId)}
              index={index}
              reduceMotion={reduceMotion}
              sorting={sorting}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
}

function JobListRow({
  row,
  active,
  loading,
  highlighted,
  index,
  reduceMotion,
  sorting,
  onSelect,
}: {
  row: LeaderboardRow;
  active: boolean;
  loading: boolean;
  highlighted: boolean;
  index: number;
  reduceMotion: boolean;
  sorting: boolean;
  onSelect: (recommendation: LiveRecommendation) => void;
}) {
  const organization = row.recommendation.organization ?? row.recommendation.job?.organization;
  const brand = companyBrand(row.company, organization);
  const ruledOut = isRuledOutRow(row);
  const float = rowMotion(row, index);
  const rowAnimate = reduceMotion || sorting
    ? { opacity: ruledOut ? 0.56 : 1, x: 0, y: 0 }
    : {
        opacity: ruledOut ? 0.54 : 1,
        x: active ? 0 : [0, ruledOut ? float.floatX : float.floatX * 0.35, 0],
        y: active ? 0 : [0, float.floatY, 0],
      };

  return (
    <motion.button
      type="button"
      layout="position"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={rowAnimate}
      transition={
        reduceMotion
          ? { duration: 0 }
          : sorting
          ? {
              layout: { type: "spring", stiffness: 360, damping: 34, mass: 0.9 },
              opacity: { duration: 0.46, ease: [0.22, 1, 0.36, 1] },
              x: { duration: 0.38 },
              y: { duration: 0.38 },
            }
          : {
              layout: { type: "spring", stiffness: 520, damping: 32, mass: 0.72 },
              opacity: { duration: 0.6, delay: Math.min(index, 10) * 0.035, ease: [0.22, 1, 0.36, 1] },
              x: { duration: float.duration, delay: float.delay, ease: "easeInOut", repeat: Infinity },
              y: { duration: float.duration + 1.8, delay: float.delay * 0.8, ease: "easeInOut", repeat: Infinity },
            }
      }
      onClick={() => onSelect(row.recommendation)}
      className={cn(
        "group relative grid w-full grid-cols-[40px_36px_minmax(0,1fr)_68px] items-center gap-3 px-1 py-3.5 text-left transition duration-500 ease-out sm:grid-cols-[42px_40px_minmax(0,1fr)_74px] sm:px-3",
        highlighted
          ? "bg-[var(--dashboard-row-highlight)] ring-1 ring-[var(--dashboard-row-highlight-border)]"
          : active
          ? "bg-[var(--dashboard-row-active)]"
          : "bg-transparent hover:bg-[var(--dashboard-row-hover)]",
        ruledOut && "text-[var(--dashboard-panel-subtle)]",
      )}
    >
      {ruledOut ? (
        <span className="pointer-events-none absolute inset-x-3 top-1/2 h-px bg-[var(--dashboard-panel-divider)]" aria-hidden="true" />
      ) : null}
      <span
        className={cn(
          "font-mono text-[11px] font-semibold tabular-nums tracking-[0.14em]",
          sorting ? "text-[var(--dashboard-score-fg)]" : "text-[var(--dashboard-panel-subtle)]",
        )}
      >
        {formatListIndex(index)}
      </span>
      <CompanyLogo company={row.company} organization={organization} size="sm" />

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-[var(--dashboard-panel-fg)]">{row.company}</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-panel-kicker)]">
            {brand.tag}
          </span>
        </div>
        <div className={cn("mt-0.5 truncate text-[14px] font-medium text-[var(--dashboard-panel-fg)]", ruledOut && "text-[var(--dashboard-panel-subtle)]")}>{row.title}</div>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--dashboard-panel-subtle)]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{row.locationLabel}</span>
          </span>
          <span>{row.providerLabel}</span>
        </div>
      </div>

      <div className="flex min-h-11 flex-col items-end justify-between">
        <span className={cn("text-base font-semibold tabular-nums", ruledOut ? "text-[var(--dashboard-panel-subtle)]" : "text-[var(--dashboard-score-fg)]")}>{row.score}</span>
        <span className={cn("text-[11px] font-semibold", statusClasses(row.statusTone, active))}>
          {loading ? "Loading" : row.statusLabel}
        </span>
      </div>
    </motion.button>
  );
}

function OverviewPanel({
  run,
  rows,
  readyCount,
  averageScore,
  topScore,
  topCompanies,
  logs,
  transition,
}: {
  run: LiveRunSummary | null | undefined;
  rows: LeaderboardRow[];
  readyCount: number;
  averageScore: number;
  topScore: number;
  topCompanies: CompanySummary[];
  logs: LivePipelineLog[];
  transition: Transition;
}) {
  const scanned = run?.rawJobCount ?? 0;
  const ranked = run?.recommendedCount ?? rows.length;
  const tailored = run?.tailoredCount ?? readyCount;

  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={transition}
      className="overflow-hidden rounded-[24px] border border-[var(--dashboard-panel-border)] bg-[var(--dashboard-panel-bg)] text-[var(--dashboard-panel-fg)] shadow-[var(--dashboard-panel-shadow)] backdrop-blur-2xl"
    >
      <div className="border-b border-[var(--dashboard-panel-divider)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--dashboard-row-active)] text-[var(--dashboard-score-fg)]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--dashboard-panel-fg)]">Portfolio view</h2>
            <p className="mt-0.5 text-sm text-[var(--dashboard-panel-muted)]">Current OM demo run.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-x-5 gap-y-1">
          <StatTile icon={BriefcaseBusiness} label="Jobs scanned" value={<CountUpValue value={scanned} />} detail={`${run?.fetchedCount ?? 0}/${run?.sourceCount ?? 0} sources`} />
          <StatTile icon={Target} label="Matches" value={<CountUpValue value={ranked} />} detail={`${topScore} top score`} />
          <StatTile icon={Gauge} label="Average fit" value={<CountUpValue value={Math.round(averageScore)} />} detail="Across ranked roles" />
          <StatTile icon={CheckCircle2} label="Tailored" value={<CountUpValue value={tailored} />} detail={`${readyCount} ready now`} />
        </div>

        <section className="border-t border-[var(--dashboard-panel-divider)] pt-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-panel-kicker)]">Company mix</h3>
            <span className="text-sm font-semibold text-[var(--dashboard-score-fg)]">{topCompanies.length} companies</span>
          </div>
          <div className="space-y-2.5">
            {topCompanies.map((company) => (
              <div key={company.company} className="grid grid-cols-[32px_minmax(0,1fr)_46px] items-center gap-2.5">
                <CompanyLogo company={company.company} organization={company.organization} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-[var(--dashboard-panel-fg)]">{company.company}</span>
                    <span className="text-xs text-[var(--dashboard-panel-subtle)]">{company.count} roles</span>
                  </div>
                  <Meter value={company.averageScore} />
                </div>
                <div className="text-right text-sm font-semibold text-[var(--dashboard-score-fg)]">{Math.round(company.averageScore)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--dashboard-panel-divider)] pt-3">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-panel-kicker)]">Recent run signals</h3>
          </div>
          <div className="space-y-2.5">
            {logs.slice(-5).reverse().map((log) => (
              <div key={log._id ?? `${log.createdAt}-${log.message}`} className="grid grid-cols-[8px_minmax(0,1fr)] gap-3">
                <span className={cn("mt-2 h-2 w-2 rounded-full", logDotClass(log.level))} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--dashboard-panel-fg)]">{log.message}</div>
                  <div className="mt-0.5 text-xs uppercase tracking-[0.12em] text-[var(--dashboard-panel-subtle)]">
                    {log.stage} / {formatTime(Date.parse(log.createdAt))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function JobStatsPanel({
  selected,
  detail,
  detailError,
  tailorState,
  pdf,
  transition,
  onTailor,
  onOpenPdf,
  onDownload,
  onClear,
}: {
  selected: LiveRecommendation;
  detail: JobDetail | null | undefined;
  detailError?: string;
  tailorState: TailorState;
  pdf: { canView: boolean; canDownload: boolean; filename?: string; sizeKb?: number; ready: boolean };
  transition: Transition;
  onTailor: () => void;
  onOpenPdf: () => void;
  onDownload: () => void;
  onClear: () => void;
}) {
  const loading = detail === undefined;
  const job = detail?.job ?? selected.job ?? null;
  const score = detail?.score;
  const tailored = detail?.tailoredApplication;
  const resolvedTitle = job?.title ?? selected.title;
  const resolvedCompany = job?.company ?? selected.company;
  const resolvedOrganization = job?.organization ?? selected.job?.organization ?? selected.organization;
  const resolvedLocation = job?.location ?? selected.location;
  const resolvedUrl = job?.jobUrl ?? selected.jobUrl;
  const research = readResearch(detail);
  const fitScore = score?.totalScore ?? selected.score;
  const llmScore = score?.llmScore ?? fitScore;
  const tailoringScore = tailored?.tailoringScore ?? 0;
  const keywordCoverage = tailored?.keywordCoverage ?? 0;
  const strengths = score?.strengths ?? selected.strengths ?? [];
  const risks = score?.risks ?? selected.risks ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={transition}
      className="overflow-hidden rounded-[24px] border border-[var(--dashboard-panel-border)] bg-[var(--dashboard-panel-bg)] text-[var(--dashboard-panel-fg)] shadow-[var(--dashboard-panel-shadow)] backdrop-blur-2xl"
    >
      <div className="border-b border-[var(--dashboard-panel-divider)] px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <CompanyLogo company={resolvedCompany} organization={resolvedOrganization} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-panel-kicker)]">
                  Rank {selected.rank}
                </span>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent)]" /> : null}
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-[var(--dashboard-panel-fg)]">{resolvedCompany}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--dashboard-panel-muted)]">{resolvedTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-md bg-[var(--dashboard-control-bg)] px-3 py-2 text-xs font-semibold text-[var(--dashboard-panel-muted)] transition hover:bg-[var(--dashboard-control-hover)] hover:text-[var(--dashboard-panel-fg)]"
          >
            All jobs
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {detailError ? (
          <div className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {detailError}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-x-5 gap-y-1">
          <StatTile icon={Gauge} label="Fit" value={<CountUpValue value={Math.round(fitScore)} />} detail={score?.scoringMode ?? "ranked"} />
          <StatTile icon={Sparkles} label="Model score" value={<CountUpValue value={Math.round(llmScore)} />} detail="Fit read" />
          <StatTile icon={Target} label="Tailoring" value={tailoringScore ? <CountUpValue value={Math.round(tailoringScore)} /> : "Ready"} detail={tailored?.status ?? "open"} />
          <StatTile icon={CheckCircle2} label="Keywords" value={keywordCoverage ? <><CountUpValue value={Math.round(keywordCoverage)} />%</> : "n/a"} detail={pdf.ready ? "PDF-ready metadata" : "Awaiting PDF"} />
        </div>

        <section className="border-t border-[var(--dashboard-panel-divider)] pt-3">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <Fact label="Location" value={resolvedLocation} />
            <Fact label="Compensation" value={job?.compensationSummary ?? selected.compensationSummary} />
            <Fact label="Source" value={sourceLabel(selected, detail)} />
            <Fact label="Team" value={detail?.job?.team ?? detail?.job?.department} />
          </div>

          <div className="space-y-3">
            <ScoreLine label="Fit score" value={fitScore} />
            <ScoreLine label="Model confidence" value={llmScore} />
            {tailoringScore ? <ScoreLine label="Tailoring score" value={tailoringScore} /> : null}
            {keywordCoverage ? <ScoreLine label="Keyword coverage" value={keywordCoverage} /> : null}
          </div>
        </section>

        <section className="border-t border-[var(--dashboard-panel-divider)] pt-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-panel-kicker)]">Fit read</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--dashboard-panel-muted)]">
            {score?.rationale ?? selected.rationale ?? "No rationale captured yet."}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <SignalList title="Strengths" items={strengths} tone="good" />
            <SignalList title="Risks" items={risks} tone="warn" />
          </div>
        </section>

        {research ? (
          <section className="border-t border-[var(--dashboard-panel-divider)] pt-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-panel-kicker)]">Research notes</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--dashboard-panel-muted)]">{research.jdSummary}</p>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
              {research.techStack.slice(0, 8).map((item) => (
                <span key={item} className="border-b border-[var(--dashboard-panel-divider)] pb-0.5 text-xs font-semibold text-[var(--dashboard-score-fg)]">
                  {item}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="border-t border-[var(--dashboard-panel-divider)] pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ThinAction onClick={onTailor} disabled={loading || tailorState.running}>
              {tailorState.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Tailor
            </ThinAction>
            <ThinAction tone="secondary" onClick={onOpenPdf} disabled={!pdf.canView}>
              View PDF
            </ThinAction>
            <ThinAction tone="secondary" onClick={onDownload} disabled={!pdf.canDownload}>
              Download
            </ThinAction>
            <ThinAction
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
            >
              Original
              <ExternalLink className="h-3.5 w-3.5" />
            </ThinAction>
          </div>
          <div
            className={cn(
              "mt-4 rounded-lg px-4 py-3 text-sm leading-6",
              tailorState.error
                ? "border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                : "bg-[var(--dashboard-card-bg)] text-[var(--dashboard-panel-muted)]",
            )}
          >
            {tailorState.error ?? tailorState.message}
            {pdf.filename ? (
              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-panel-subtle)]">
                {pdf.filename}
                {pdf.sizeKb ? ` / ${pdf.sizeKb} KB` : ""}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function ThinAction({
  children,
  disabled = false,
  href,
  target,
  rel,
  tone = "primary",
  className,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  tone?: "primary" | "secondary";
  className?: string;
  onClick?: () => void;
}) {
  const classes = cn(
    "inline-flex h-8 items-center gap-1.5 border-b pb-0.5 text-sm font-semibold transition duration-300",
    tone === "primary"
      ? "border-[var(--dashboard-action-border)] text-[var(--dashboard-score-fg)] hover:border-[var(--dashboard-score-fg)] hover:text-[var(--dashboard-panel-fg)]"
      : "border-[var(--dashboard-panel-divider)] text-[var(--dashboard-panel-muted)] hover:border-[var(--dashboard-action-border)] hover:text-[var(--dashboard-panel-fg)]",
    disabled && "pointer-events-none border-[var(--dashboard-panel-divider)] text-[var(--dashboard-panel-subtle)] opacity-60",
    className,
  );

  if (href) {
    return (
      <a
        href={disabled ? undefined : href}
        target={target}
        rel={rel}
        className={classes}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          onClick?.();
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-panel-kicker)]">{label}</div>
        <Icon className="h-4 w-4 text-[var(--color-accent)]" />
      </div>
      <div className="mt-1.5 text-2xl font-semibold text-[var(--dashboard-panel-fg)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--dashboard-panel-subtle)]">{detail}</div>
    </div>
  );
}

function CountUpValue({ value }: { value: number }) {
  return <AnimatedNumber value={value} format={(next) => formatCount(Math.round(next))} />;
}

function ScoreLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-panel-subtle)]">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <Meter value={value} />
    </div>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <AnimatedProgressBar
      value={value}
      trackClassName="bg-[var(--dashboard-card-bg)]"
      fillClassName="bg-[var(--color-accent)]"
    />
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dashboard-panel-subtle)]">{label}</div>
      <div className="mt-1 text-sm font-medium leading-5 text-[var(--dashboard-panel-fg)]">{value}</div>
    </div>
  );
}

function SignalList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "warn" }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[var(--dashboard-panel-fg)]">{title}</div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 4).map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-6 text-[var(--dashboard-panel-muted)]">
              <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", tone === "good" ? "bg-[var(--color-success)]" : "bg-[var(--color-warn)]")} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--dashboard-panel-subtle)]">No signals captured.</p>
      )}
    </div>
  );
}

function CompanyLogo({
  company,
  organization,
  size = "md",
}: {
  company: string;
  organization?: OrganizationLogo | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const brand = companyBrand(company, organization);
  const boxClass = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  }[size];
  const textClass = size === "lg" ? "text-lg" : "text-sm";
  const logoFailed = Boolean(brand.logoUrl && failedLogoUrl === brand.logoUrl);

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--dashboard-card-bg)] ring-1 ring-[var(--dashboard-card-border)]", boxClass)}
      style={{ backgroundColor: logoFailed ? brand.bg : undefined }}
    >
      {brand.logoUrl && !logoFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt={brand.logoAlt ?? `${company} logo`}
          className="h-[72%] w-[72%] object-contain"
          onError={() => setFailedLogoUrl(brand.logoUrl ?? null)}
        />
      ) : (
        <span className={cn("font-semibold", textClass)} style={{ color: brand.color }}>
          {brand.initials}
        </span>
      )}
    </div>
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

function compareRecommendationsByScore(
  left: { score: number; trueRank: number; originalIndex: number },
  right: { score: number; trueRank: number; originalIndex: number },
) {
  return right.score - left.score || left.trueRank - right.trueRank || left.originalIndex - right.originalIndex;
}

function isListSorting(run: LiveRunSummary | null | undefined, runState: PipelineRunState) {
  if (runState === "syncing" || runState === "ingesting" || runState === "ranking") return true;
  return Boolean(run && ["fetching", "fetched", "ranking"].includes(run.status));
}

function dashboardLoadingPhase(
  run: LiveRunSummary | null | undefined,
  runState: PipelineRunState,
): DashboardLoadingPhase {
  if (!run && runState === "idle") return "loading";
  if (runState === "ranking" || run?.status === "ranking") return "scoring";
  if (runState === "ingesting" || run?.status === "fetching" || run?.status === "fetched") return "loading";
  return "ranking";
}

function sortingPreviewRows(
  rows: LeaderboardRow[],
  run: LiveRunSummary | null | undefined,
  refreshedAt: number | null,
) {
  const phase = sortingPhase(run, refreshedAt);
  return [...rows].sort((left, right) => {
    const leftPreview = left.score + sortingJitter(left, phase);
    const rightPreview = right.score + sortingJitter(right, phase);
    return rightPreview - leftPreview || left.rank - right.rank;
  });
}

function sortingPhase(run: LiveRunSummary | null | undefined, refreshedAt: number | null) {
  const value = Date.parse(run?.startedAt ?? "") || refreshedAt || 0;
  return Math.floor(value / 2200) % 9;
}

function sortingJitter(row: LeaderboardRow, phase: number) {
  const seed = motionSeed(`${row.jobId}:sort:${phase}`);
  return (seed - 0.5) * 18;
}

function formatListIndex(index: number) {
  return String(index).padStart(2, "0");
}

function applicationStatus(
  recommendation: LiveRecommendation,
  run: LiveRunSummary | null | undefined,
): Pick<LeaderboardRow, "statusLabel" | "statusTone" | "actionLabel"> {
  const rank = Number.isFinite(recommendation.rank) ? recommendation.rank : Number.MAX_SAFE_INTEGER;
  const score = Number.isFinite(recommendation.score) ? recommendation.score : 0;
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

  if (score < 64) {
    return { statusLabel: "Ruled out", statusTone: "danger", actionLabel: "Review" };
  }

  if (score < 72) {
    return { statusLabel: "Needs review", statusTone: "warning", actionLabel: "Review" };
  }

  return { statusLabel: "Queued", statusTone: "neutral", actionLabel: "Open" };
}

function dashboardSummary(
  applicationCount: number,
  readyCount: number,
  needsReviewCount: number,
  ruledOutCount: number,
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
  if (ruledOutCount > 0) {
    parts.push(`${ruledOutCount} ruled out`);
  }
  if (refreshedAt) {
    parts.push(`updated ${formatTime(refreshedAt)}`);
  }

  return parts.join(" · ");
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

type CompanySummary = {
  company: string;
  count: number;
  averageScore: number;
  organization?: OrganizationLogo;
};

function companyBreakdown(rows: LeaderboardRow[]): CompanySummary[] {
  const byCompany = new Map<string, { total: number; count: number; organization?: OrganizationLogo }>();
  for (const row of rows) {
    const current = byCompany.get(row.company) ?? { total: 0, count: 0 };
    current.total += row.score;
    current.count += 1;
    current.organization ??= row.recommendation.organization ?? row.recommendation.job?.organization;
    byCompany.set(row.company, current);
  }
  return [...byCompany.entries()]
    .map(([company, value]) => ({
      company,
      count: value.count,
      averageScore: value.count > 0 ? value.total / value.count : 0,
      organization: value.organization,
    }))
    .sort((left, right) => right.count - left.count || right.averageScore - left.averageScore);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function statusClasses(tone: LeaderboardRow["statusTone"], active: boolean) {
  if (active) {
    return "text-[var(--dashboard-score-fg)]";
  }

  const toneClass = {
    neutral: "text-[var(--dashboard-panel-subtle)]",
    active: "text-[var(--dashboard-score-fg)]",
    success: "text-[var(--color-success)]",
    warning: "text-[var(--color-warn)]",
    danger: "text-[var(--color-danger)]",
  }[tone];

  return toneClass;
}

function isRuledOutRow(row: LeaderboardRow) {
  return row.statusLabel === "Ruled out" || row.statusTone === "danger";
}

function promoteViableRows(rows: LeaderboardRow[]) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const statusOrder = Number(isRuledOutRow(left.row)) - Number(isRuledOutRow(right.row));
      return statusOrder || left.index - right.index;
    })
    .map(({ row }) => row);
}

function orderRowsByJobIds(rows: LeaderboardRow[], jobIds: readonly string[]) {
  const rowById = new Map(rows.map((row) => [row.jobId, row]));
  const ordered: LeaderboardRow[] = [];

  for (const jobId of jobIds) {
    const row = rowById.get(jobId);
    if (!row) continue;
    ordered.push(row);
    rowById.delete(jobId);
  }

  return [...ordered, ...rowById.values()];
}

function motionSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function rowMotion(row: LeaderboardRow, index: number) {
  const seed = motionSeed(`${row.jobId}:${row.company}:${index}`);
  const direction = seed > 0.5 ? 1 : -1;
  return {
    floatX: direction * (2.4 + seed * 3.6),
    floatY: -1.5 - ((index % 5) * 0.55) - seed,
    duration: 18 + seed * 11,
    delay: (index % 9) * 0.24 + seed,
  };
}

function logDotClass(level: LivePipelineLog["level"]) {
  if (level === "success") return "bg-[var(--color-success)]";
  if (level === "warning") return "bg-[var(--color-warn)]";
  if (level === "error") return "bg-[var(--color-danger)]";
  return "bg-[var(--color-accent)]";
}

function readResearch(detail: JobDetail | null | undefined): JobResearch | null {
  if (detail?.tailoredApplication?.research) {
    return detail.tailoredApplication.research;
  }

  const artifact = detail?.artifacts?.find((item) => item.kind === "research_snapshot");
  if (!artifact?.payload || typeof artifact.payload !== "object") {
    return null;
  }

  const payload = artifact.payload as Partial<JobResearch>;
  return {
    company: payload.company ?? detail?.job?.company ?? "",
    cultureSignals: Array.isArray(payload.cultureSignals) ? payload.cultureSignals : [],
    companyMission: payload.companyMission ?? "",
    companyProducts: Array.isArray(payload.companyProducts) ? payload.companyProducts : [],
    jdSummary: payload.jdSummary ?? "",
    jobUrl: payload.jobUrl ?? detail?.job?.jobUrl ?? "",
    modelDurationMs: payload.modelDurationMs ?? 0,
    niceToHaves: Array.isArray(payload.niceToHaves) ? payload.niceToHaves : [],
    recentNews: Array.isArray(payload.recentNews) ? payload.recentNews : [],
    requirements: Array.isArray(payload.requirements) ? payload.requirements : [],
    responsibilities: Array.isArray(payload.responsibilities) ? payload.responsibilities : [],
    role: payload.role ?? detail?.job?.title ?? "",
    source: payload.source ?? "ingested-description",
    techStack: Array.isArray(payload.techStack) ? payload.techStack : [],
  };
}

function sourceLabel(selected: LiveRecommendation, detail: JobDetail | null | undefined) {
  const sourceSlug = detail?.job?.sourceSlug ?? selected.job?.sourceSlug ?? "";
  if (sourceSlug === "custom-jd" || selected.job?.jobUrl?.startsWith("custom-jd:")) {
    return "Custom JD";
  }
  if (!sourceSlug) {
    return "Ashby";
  }
  const [source] = sourceSlug.split(":");
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function companyBrand(company: string, organization?: OrganizationLogo | null) {
  const registered = resolveCompanyLogoAsset(organization?.company ?? company);

  if (organization) {
    return {
      domain: organization.domain || registered?.domain || "",
      logoUrl: organization.logoUrl || registered?.logoUrl,
      logoAlt: organization.logoAlt || registered?.logoAlt,
      color: organization.brandColor ?? registered?.brandColor ?? "#234B32",
      bg: organization.backgroundColor ?? registered?.backgroundColor ?? "#E8F2E2",
      tag: organization.prestigeTag ?? registered?.prestigeTag ?? "Prestige",
      initials: companyInitials(organization.company || company),
    };
  }

  if (registered) {
    return {
      domain: registered.domain,
      logoUrl: registered.logoUrl,
      logoAlt: registered.logoAlt,
      color: registered.brandColor,
      bg: registered.backgroundColor,
      tag: registered.prestigeTag,
      initials: companyInitials(registered.company),
    };
  }

  return {
    domain: "",
    logoUrl: undefined,
    logoAlt: undefined,
    color: "#234B32",
    bg: "#E8F2E2",
    tag: "Priority",
    initials: companyInitials(company),
  };
}

function companyInitials(company: string) {
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "R";
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

function commandJobs(rows: LeaderboardRow[]): DashboardCommandJob[] {
  return rows.map((row) => ({
    jobId: row.jobId,
    title: row.title,
    company: row.company,
    location: row.locationLabel,
    score: row.score,
    rank: row.rank,
    statusLabel: row.statusLabel,
    providerLabel: row.providerLabel,
    compensationSummary: row.recommendation.compensationSummary ?? row.secondaryLine,
    rationale: row.recommendation.rationale,
    strengths: row.recommendation.strengths,
    risks: row.recommendation.risks,
    tags: [
      row.recommendation.organization?.prestigeTag,
      row.recommendation.job?.organization?.prestigeTag,
      row.recommendation.job?.sourceSlug,
      row.providerLabel,
    ].filter((item): item is string => Boolean(item)),
  }));
}

function applyDashboardCommandRows(
  rows: LeaderboardRow[],
  command: DashboardCommandResponse | null,
) {
  if (!command) return rows;
  if (command.intent === "clear") return rows;

  const filtered = command.filters.reduce(
    (current, filter) => current.filter((row) => rowPassesCommandFilter(row, filter)),
    rows,
  );

  if (!command.reorder?.jobIds.length) return filtered;

  const rowById = new Map(filtered.map((row) => [row.jobId, row]));
  const ordered: LeaderboardRow[] = [];
  for (const jobId of command.reorder.jobIds) {
    const row = rowById.get(jobId);
    if (!row) continue;
    ordered.push(row);
    rowById.delete(jobId);
  }
  return [...ordered, ...rowById.values()];
}

function rowPassesCommandFilter(
  row: LeaderboardRow,
  filter: DashboardCommandResponse["filters"][number],
) {
  const value = commandFieldValue(row, filter.field);
  const filterValue = filter.value;
  if (filter.op === "gte") return Number(value ?? 0) >= Number(filterValue);
  if (filter.op === "lte") return Number(value ?? 0) <= Number(filterValue);
  if (filter.op === "equals") return String(value ?? "").toLowerCase() === String(filterValue).toLowerCase();
  if (filter.op === "contains") return String(value ?? "").toLowerCase().includes(String(filterValue).toLowerCase());
  if (filter.op === "not_contains") return !String(value ?? "").toLowerCase().includes(String(filterValue).toLowerCase());
  if (filter.op === "in" && Array.isArray(filterValue)) {
    return filterValue.map((item) => item.toLowerCase()).includes(String(value ?? "").toLowerCase());
  }
  return true;
}

function commandFieldValue(row: LeaderboardRow, field: string) {
  const haystack = [
    row.title,
    row.company,
    row.locationLabel,
    row.providerLabel,
    row.secondaryLine,
    row.statusLabel,
    row.recommendation.rationale,
    ...(row.recommendation.strengths ?? []),
    ...(row.recommendation.risks ?? []),
  ].join(" ");

  if (field === "score") return row.score;
  if (field === "location") return row.locationLabel;
  if (field === "statusLabel") return row.statusLabel;
  if (field === "company") return row.company;
  if (field === "title") return `${row.title} ${haystack}`;
  return haystack;
}

function commandResultTitle(command: DashboardCommandResponse) {
  if (command.intent === "filter") return "Filtered shortlist";
  if (command.intent === "reorder") return "Reordered board";
  if (command.intent === "explain") return "Fit explanation";
  if (command.intent === "clear") return "Filters cleared";
  if (command.intent === "summarize") return "Board summary";
  return "Command result";
}

function commandModelMeta(response: Extract<DashboardCommandApiResponse, { ok: true }>) {
  const provider = response.model.provider === "k2"
    ? response.sponsor.name
    : response.model.provider === "demo"
      ? "Demo fallback"
      : `${response.model.provider} fallback`;
  return `${provider} / ${response.model.modelId}${response.model.fallbackUsed ? " / fallback" : ""}`;
}

function dashboardCommandsEqual(
  left: DashboardCommandResponse | null,
  right: DashboardCommandResponse | null,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable ||
    tag === "input" ||
    tag === "textarea" ||
    tag === "select";
}

function CommandResultBody({ command }: { command: DashboardCommandResponse }) {
  return (
    <div>
      <p>{command.answer}</p>
      {command.filters.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {command.filters.map((filter) => (
            <span
              key={`${filter.field}-${filter.op}-${String(filter.value)}`}
              className="rounded-full border border-[var(--dashboard-command-border)] bg-[var(--dashboard-control-bg)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ai)]"
            >
              {filter.label}
            </span>
          ))}
        </div>
      ) : null}
      {command.explanations.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {command.explanations.slice(0, 3).map((item) => (
            <li key={item.jobId} className="text-xs leading-5 text-[var(--dashboard-panel-muted)]">
              <span className="font-semibold text-[var(--dashboard-panel-fg)]">{item.summary}</span>
              {item.evidence.length > 0 ? ` / ${item.evidence[0]}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function RecruitDashboard({ seed }: { seed?: DashboardSeed }) {
  void seed;
  return <ConnectedRecruitDashboard />;
}
