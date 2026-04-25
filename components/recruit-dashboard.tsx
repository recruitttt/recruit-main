"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  Check,
  CircleStop,
  FileText,
  LayoutDashboard,
  Loader2,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Power,
  Reply,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  ActionButton as Button,
  ArtifactCard,
  EventLog,
  GlassCard,
  Panel,
  RunStatusIndicator,
  StatusBadge as Pill,
  cx,
  getStatusColor,
  mistClasses,
  mistColors,
  type StatusTone,
} from "@/components/design-system";
import type {
  ActiveRun,
  ApplicationRow,
  ArtifactSummary,
  DashboardMetric,
  DashboardSeed,
  ProviderCoverage,
} from "@/lib/dashboard-seed";
import { readProfile } from "@/lib/profile";
import { isProfileUsable } from "@/lib/demo-profile";
import { downloadPdf } from "@/lib/tailor/client";
import type { JobResearch, TailoredApplication } from "@/lib/tailor/types";

type LiveRunSummary = {
  _id: string;
  status: "fetching" | "fetched" | "ranking" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  sourceCount: number;
  fetchedCount: number;
  rawJobCount: number;
  filteredCount: number;
  survivorCount: number;
  llmScoredCount: number;
  recommendedCount: number;
  errorCount: number;
  scoringMode?: string;
  tailoredCount?: number;
  hasCompletedTailoring?: boolean;
  recommendations?: LiveRecommendation[];
};

type LiveRecommendation = {
  _id?: string;
  jobId?: string;
  company: string;
  title: string;
  location?: string;
  score: number;
  rank: number;
  jobUrl: string;
  compensationSummary?: string;
  rationale?: string;
  strengths?: string[];
  risks?: string[];
  job?: {
    _id?: string;
    company?: string;
    title?: string;
    location?: string;
    jobUrl?: string;
    sourceSlug?: string;
    descriptionPlain?: string;
    compensationSummary?: string;
  } | null;
};

type FollowUpApplication = {
  _id: string;
  jobId?: string;
  company: string;
  title: string;
  provider: string;
  jobUrl?: string;
  status:
    | "draft"
    | "ready_to_apply"
    | "applied"
    | "follow_up_due"
    | "followed_up"
    | "responded"
    | "interview"
    | "rejected"
    | "offer"
    | "closed"
    | "blocked";
  appliedAt?: string;
  nextFollowUpAt?: string;
  responseAt?: string;
  responseSummary?: string;
  metadata?: Record<string, unknown>;
};

type OutreachDraft = {
  _id: string;
  channel: "email" | "linkedin" | "manual";
  subject?: string;
  body: string;
  recipient?: string;
  tone?: string;
  approvedAt?: string;
};

type FollowUpTask = {
  _id: string;
  applicationId: string;
  channel: "email" | "linkedin" | "manual";
  state: "scheduled" | "draft_ready" | "sent_manually" | "skipped" | "blocked";
  scheduledFor: string;
  completedAt?: string;
  draftId?: string;
  sequence?: number;
  application?: FollowUpApplication | null;
  draft?: OutreachDraft | null;
};

type FollowUpSummary = {
  applications: FollowUpApplication[];
  dueTasks: FollowUpTask[];
  scheduledTasks: FollowUpTask[];
  counts: {
    applications: number;
    applied: number;
    due: number;
    responses: number;
    interviews: number;
    rejectedClosed: number;
  };
};

type JobDetail = {
  job?: {
    _id: string;
    runId?: string;
    company: string;
    title: string;
    location?: string;
    jobUrl: string;
    descriptionPlain?: string;
    compensationSummary?: string;
    department?: string;
    team?: string;
  };
  decision?: {
    status: "kept" | "rejected";
    reasons?: string[];
    ruleScore?: number;
  };
  score?: {
    totalScore: number;
    llmScore?: number;
    rationale?: string;
    strengths?: string[];
    risks?: string[];
    scoringMode?: string;
  };
  recommendation?: LiveRecommendation;
  tailoredApplication?: {
    status: "tailoring" | "completed" | "failed";
    tailoredResume?: TailoredApplication["tailoredResume"];
    research?: JobResearch;
    tailoringScore?: number;
    keywordCoverage?: number;
    pdfReady: boolean;
    pdfFilename?: string;
    pdfByteLength?: number;
    pdfBase64?: string;
    error?: string;
  };
  artifacts?: Array<{
    _id: string;
    kind: "ingested_description" | "ranking_score" | "research_snapshot" | "tailored_resume" | "cover_letter" | "pdf_ready" | "pdf_file";
    title: string;
    content?: string;
    payload?: unknown;
    createdAt: string;
  }>;
};

type TailorState = {
  running: boolean;
  message: string;
  error?: string;
  downloadable?: TailoredApplication;
};

type PipelineControls = {
  canRun: boolean;
  busy: boolean;
  label: string;
  message?: string;
  error?: string;
  logs?: PipelineLog[];
  onRunFirst3?: () => void;
};

type TailoringControls = {
  recommendations: LiveRecommendation[];
  selected: LiveRecommendation | null;
  detail: JobDetail | null | undefined;
  state: TailorState;
  followUps?: FollowUpControls;
  onSelect: (recommendation: LiveRecommendation) => void;
  onTailor: () => void;
  onDownload: () => void;
};

type CustomJdRequest = {
  company: string;
  role: string;
  location?: string;
  jobUrl?: string;
  descriptionPlain: string;
};

type CustomJdControls = {
  busy: boolean;
  message?: string;
  error?: string;
  onCreate: (request: CustomJdRequest) => void;
};

type FollowUpControls = {
  summary?: FollowUpSummary;
  busy: boolean;
  message?: string;
  error?: string;
  onMarkApplied: (recommendation: LiveRecommendation, detail: JobDetail | null | undefined) => void;
  onGenerateDraft: (applicationId: string, channel: FollowUpTask["channel"], taskId?: string) => void;
  onUpdateDraft: (draftId: string, fields: Partial<Pick<OutreachDraft, "subject" | "body" | "recipient" | "tone">>) => void;
  onApproveDraft: (draftId: string) => void;
  onManualSend: (taskId: string) => void;
  onSkipTask: (taskId: string) => void;
  onRecordResponse: (applicationId: string, status: FollowUpApplication["status"], responseSummary: string) => void;
};

type PipelineRunState = "idle" | "syncing" | "ingesting" | "ranking" | "done" | "error";

type PipelineLog = {
  _id?: string;
  stage: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  createdAt: string;
  payload?: unknown;
};

type LiveDashboardPayload = {
  run: LiveRunSummary | null;
  recommendations: LiveRecommendation[];
  logs?: PipelineLog[];
  followUps?: FollowUpSummary;
};

const emptyDashboardSeed: DashboardSeed = {
  generatedAt: "live",
  mode: "live",
  metrics: [
    { label: "Applications", value: "0", detail: "no live runs yet", tone: "neutral", progress: 0 },
    { label: "Active runs", value: "0", detail: "idle", tone: "neutral", progress: 0 },
    { label: "DLQ pending", value: "0", detail: "no blockers", tone: "success", progress: 0 },
    { label: "Cache reuse", value: "0%", detail: "awaiting data", tone: "neutral", progress: 0 },
    { label: "Time saved", value: "0h", detail: "awaiting data", tone: "neutral", progress: 0 },
  ],
  activeRun: null,
  providers: [
    { provider: "Ashby", status: "ready", tone: "neutral", detail: "waiting for first live ingestion" },
    { provider: "Greenhouse", status: "not run", tone: "neutral", detail: "validation pending" },
    { provider: "Lever", status: "not run", tone: "neutral", detail: "validation pending" },
    { provider: "Workday", status: "not run", tone: "neutral", detail: "validation pending" },
  ],
  applications: [],
  dlq: [],
  activity: [
    {
      time: "now",
      type: "seen",
      title: "Live dashboard ready",
      detail: "Run ingestion to populate recommendations, artifacts, and tailoring state.",
      evidence: "empty",
    },
  ],
  artifacts: [],
};

const navItems = [
  ["Dashboard", LayoutDashboard, true],
  ["Applications", BriefcaseBusiness, false],
  ["DLQ", AlertTriangle, false],
  ["Artifacts", FileText, false],
  ["Settings", Settings, false],
] as const;

function ProgressBar({ value, tone }: { value: number; tone: StatusTone }) {
  const color = getStatusColor(tone);

  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/10">
      <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <GlassCard density="compact">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-500">{metric.label}</div>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(metric.tone) }} />
      </div>
      <div className="mt-2 font-mono text-2xl text-slate-950">{metric.value}</div>
      <div className="mt-1 text-xs text-slate-500">{metric.detail}</div>
      <ProgressBar value={metric.progress} tone={metric.tone} />
    </GlassCard>
  );
}

function DashboardShell({
  seed,
  controls,
  tailoring,
  customJd,
}: {
  seed: DashboardSeed;
  controls?: PipelineControls;
  tailoring?: TailoringControls;
  customJd?: CustomJdControls;
}) {
  return (
    <main className={cx("min-h-screen overflow-x-hidden px-5 py-5 md:px-6 md:py-7", mistClasses.page)}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[6%] top-[9%] h-72 w-72 rounded-full bg-white/32 blur-3xl" />
        <div className="absolute right-[8%] top-[16%] h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: `${mistColors.accent}16` }} />
        <div className="absolute bottom-[4%] left-[36%] h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: `${mistColors.neutral}12` }} />
      </div>
      <div className="relative mx-auto grid min-w-0 max-w-[1520px] gap-5 lg:grid-cols-[220px_1fr]">
        <aside className={cx("hidden border p-3 lg:block", mistClasses.panel)}>
          <Link href="/dashboard" className="flex items-center gap-3 px-2 py-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-[20px] border border-sky-400/40 text-2xl font-serif text-sky-500">r</span>
            <span>
              <span className="block text-sm font-semibold text-slate-950">recruit</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">agent console</span>
            </span>
          </Link>
          <nav className="mt-6 space-y-1">
            {navItems.map(([label, Icon, active]) => (
              <button
                key={label}
                className={cx(
                  "flex h-10 w-full items-center gap-3 rounded-full px-3 text-sm font-semibold transition",
                  active ? "bg-white/58 text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.07)]" : "text-slate-600 hover:bg-white/28",
                )}
              >
                <Icon className={cx("h-4 w-4", active ? "text-sky-500" : "text-slate-500")} />
                {label}
              </button>
            ))}
          </nav>
          <GlassCard density="compact" className="mt-6">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">mode</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Pill tone="neutral">{seed.mode}</Pill>
              <span className="font-mono text-[10px] text-slate-500">{seed.generatedAt}</span>
            </div>
          </GlassCard>
        </aside>

        <section className="min-w-0 space-y-5">
          <header className={cx("flex flex-col gap-4 border px-4 py-3 md:flex-row md:items-center md:justify-between", mistClasses.panel)}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="active">agent active</Pill>
                <Pill tone="neutral">{seed.mode}</Pill>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-4xl">Recruit command center</h1>
              <p className="mt-2 max-w-[calc(100vw-4.5rem)] text-sm leading-6 text-slate-600 [overflow-wrap:anywhere] md:max-w-2xl">Autonomous applications, human approval stops, provider proof, and fallback-safe status in one operating surface.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary"><Pause className="h-4 w-4" /> Pause</Button>
              <Button variant="secondary"><Sparkles className="h-4 w-4" /> Review queue</Button>
              <Button variant="dangerStrong"><Power className="h-4 w-4" /> Kill switch</Button>
            </div>
          </header>

          <DashboardMain seed={seed} controls={controls} tailoring={tailoring} customJd={customJd} />
        </section>
      </div>
    </main>
  );
}

function ActiveRunPanel({ seed, controls }: { seed: DashboardSeed; controls?: PipelineControls }) {
  const run = seed.activeRun;
  if (!run) {
    return (
      <Panel title="Active Run" actions={<Pill tone="neutral">idle</Pill>}>
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Pill tone="neutral">no live run</Pill>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Ready for ingestion</h2>
              <p className="mt-1 text-sm text-slate-600">Run the Ashby ingestion flow to populate this dashboard in real time.</p>
            </div>
            <RunStatusIndicator state="paused" label="Provider run" meta="idle" />
          </div>
          <PipelineControlsBar controls={controls} className="mt-5" />
        </GlassCard>
      </Panel>
    );
  }

  return (
    <Panel title="Active Run" actions={<Pill tone="active">{run.id}</Pill>}>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard variant="selected">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Pill tone="success">{run.provider} {run.mode}</Pill>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-slate-950">{run.company}</h2>
              <p className="mt-1 text-sm text-slate-600">{run.role}</p>
            </div>
            <RunStatusIndicator state={run.state} label="Provider run" meta={run.currentStep} />
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-600">{run.summary}</p>
          <PipelineControlsBar controls={controls} className="mt-5" />
        </GlassCard>
        <GlassCard>
          <div className="mb-3 text-sm font-semibold text-slate-950">Run step progress</div>
          <div className="space-y-2">
            {run.steps.map((step, index) => {
              const tone: StatusTone = step.status === "complete" ? "success" : step.status === "active" ? "active" : step.status === "blocked" ? "danger" : "neutral";
              return (
                <div key={step.label} className="grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-[16px] border border-white/45 bg-white/24 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-slate-400">0{index + 1}</span>
                  <span className="font-semibold text-slate-800">{step.label}</span>
                  <Pill tone={tone}>{step.status}</Pill>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </Panel>
  );
}

function PipelineControlsBar({
  controls,
  className,
}: {
  controls?: PipelineControls;
  className?: string;
}) {
  if (!controls) {
    return null;
  }

  return (
    <div className={cx("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="success"
          disabled={!controls.canRun || controls.busy}
          onClick={controls.onRunFirst3}
        >
          {controls.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {controls.label}
        </Button>
        <Button size="sm" variant="secondary" disabled>
          <Pause className="h-3.5 w-3.5" /> Pause
        </Button>
        <Button size="sm" variant="danger" disabled>
          <CircleStop className="h-3.5 w-3.5" /> Stop
        </Button>
      </div>
      {(controls.message || controls.error) && (
        <div className={cx(
          "rounded-[16px] border px-3 py-2 text-xs leading-5",
          controls.error
            ? "border-red-300/55 bg-red-50/45 text-red-700"
            : "border-white/45 bg-white/26 text-slate-600"
        )}>
          {controls.error ?? controls.message}
        </div>
      )}
    </div>
  );
}

function LiveLogStream({ logs = [], busy }: { logs?: PipelineLog[]; busy?: boolean }) {
  const orderedLogs = [...logs].reverse();

  return (
    <Panel
      title="Live Logs"
      actions={<Pill tone={busy ? "active" : "neutral"}>{logs.length} entries</Pill>}
    >
      <div className="max-h-[420px] overflow-y-auto rounded-[24px] border border-white/45 bg-slate-950/70 p-3 text-xs text-slate-100 shadow-inner">
        {orderedLogs.length === 0 ? (
          <div className="rounded-[18px] border border-white/10 bg-white/5 px-3 py-4 text-slate-300">
            Logs will stream here while ingestion, filtering, ranking, scoring, and artifact writes run.
          </div>
        ) : (
          <div className="space-y-2">
            {orderedLogs.map((log) => (
              <div
                key={log._id ?? `${log.createdAt}-${log.stage}-${log.message}`}
                className="grid gap-2 rounded-[18px] border border-white/10 bg-white/[0.06] px-3 py-2 md:grid-cols-[86px_92px_1fr]"
              >
                <span className="font-mono text-[11px] text-slate-400">{formatLogTime(log.createdAt)}</span>
                <span className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: getStatusColor(logTone(log.level)) }} />
                  <span className="font-mono text-[11px] uppercase text-slate-300">{log.stage}</span>
                </span>
                <span className="min-w-0">
                  <span className={cx("font-medium", log.level === "error" ? "text-red-200" : log.level === "warning" ? "text-amber-200" : log.level === "success" ? "text-emerald-200" : "text-slate-100")}>
                    {log.message}
                  </span>
                  {log.payload ? (
                    <span className="mt-1 block truncate font-mono text-[11px] text-slate-500">
                      {compactPayload(log.payload)}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function DashboardMain({
  seed,
  controls,
  tailoring,
  customJd,
}: {
  seed: DashboardSeed;
  controls?: PipelineControls;
  tailoring?: TailoringControls;
  customJd?: CustomJdControls;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-5">
        {seed.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <ActiveRunPanel seed={seed} controls={controls} />
        <Panel title="Provider Coverage">
          <div className="space-y-2">
            {seed.providers.map((provider) => (
              <GlassCard key={provider.provider} density="compact" className="rounded-[18px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{provider.provider}</div>
                    <div className="mt-1 text-xs text-slate-500">{provider.detail}</div>
                  </div>
                  <Pill tone={provider.tone}>{provider.status}</Pill>
                </div>
              </GlassCard>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <ApplicationPipelinePanel seed={seed} tailoring={tailoring} customJd={customJd} />
        <SelectedJobPanel tailoring={tailoring} />
      </div>

      <FollowUpsPanel controls={tailoring?.followUps} />

      <LiveLogStream logs={controls?.logs} busy={controls?.busy} />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Activity & Proof Feed">
          <EventLog events={seed.activity} />
        </Panel>
        <Panel title="Artifacts">
          <div className="grid gap-3 md:grid-cols-3">
            {seed.artifacts.length === 0 ? (
              <GlassCard>
                <div className="text-sm font-semibold text-slate-950">No artifacts yet</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">Job descriptions, ranking scores, tailored resumes, and PDF metadata will appear after live runs.</p>
              </GlassCard>
            ) : seed.artifacts.map((artifact) => (
              <ArtifactCard key={artifact.title} title={artifact.title} meta={artifact.meta} type={artifact.type} />
            ))}
          </div>
          <GlassCard className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Claim safety</div>
                <div className="mt-1 text-sm text-slate-600">Ashby is live/proven. Other providers stay labeled seeded, stretch, or replay until evidence exists.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="success"><Check className="h-3 w-3" /> proof</Pill>
                <Pill tone="neutral"><ShieldCheck className="h-3 w-3" /> honest labels</Pill>
                <Button size="sm" variant="secondary"><Ban className="h-3.5 w-3.5" /> Freeze claims</Button>
              </div>
            </div>
          </GlassCard>
        </Panel>
      </div>
    </>
  );
}

function ApplicationPipelinePanel({
  seed,
  tailoring,
  customJd,
}: {
  seed: DashboardSeed;
  tailoring?: TailoringControls;
  customJd?: CustomJdControls;
}) {
  const liveRows = tailoring?.recommendations ?? [];

  return (
    <Panel title="Application Pipeline">
      <CustomJobDescriptionPanel controls={customJd} />
      <div className="overflow-x-auto rounded-[24px] border border-white/45 bg-white/20">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-white/45 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Match</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Artifact</th>
            </tr>
          </thead>
          <tbody>
            {liveRows.length > 0 ? (
              liveRows.map((recommendation) => {
                const selected = tailoring?.selected?.jobId === recommendation.jobId;
                const tracked = applicationForRecommendation(tailoring?.followUps?.summary, recommendation);
                return (
                  <tr
                    key={recommendation._id ?? recommendation.jobId ?? `${recommendation.company}-${recommendation.title}-${recommendation.rank}`}
                    className={cx(
                      "cursor-pointer border-b border-white/35 transition last:border-0",
                      selected ? "bg-white/45" : "hover:bg-white/22"
                    )}
                    onClick={() => tailoring?.onSelect(recommendation)}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-950">{recommendation.company}</td>
                    <td className="px-4 py-3 text-slate-600">{recommendation.title}</td>
                    <td className="px-4 py-3 text-slate-500">{recommendation.job?.sourceSlug === "custom-jd" || recommendation.job?.jobUrl?.startsWith("custom-jd:") ? "Custom JD" : "Ashby"}</td>
                    <td className="px-4 py-3 font-mono text-slate-950">{Math.round(recommendation.score)}%</td>
                    <td className="px-4 py-3">
                      <Pill tone={tracked ? statusTone(tracked.status) : recommendation.rank <= 3 ? "success" : "neutral"}>
                        {tracked ? statusLabel(tracked.status) : `rank #${recommendation.rank}`}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {tracked?.nextFollowUpAt
                        ? `follow-up ${formatDateShort(tracked.nextFollowUpAt)}`
                        : recommendation.rationale ? "ranking rationale" : "job description"}
                    </td>
                  </tr>
                );
              })
            ) : seed.applications.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                  No live recommendations yet. Start ingestion to fill this table.
                </td>
              </tr>
            ) : (
              seed.applications.map((application) => (
                <tr key={`${application.company}-${application.role}-${application.status}`} className="border-b border-white/35 transition hover:bg-white/22 last:border-0">
                  <td className="px-4 py-3 font-semibold text-slate-950">{application.company}</td>
                  <td className="px-4 py-3 text-slate-600">{application.role}</td>
                  <td className="px-4 py-3 text-slate-500">{application.provider}</td>
                  <td className="px-4 py-3 font-mono text-slate-950">{application.match}</td>
                  <td className="px-4 py-3"><Pill tone={application.tone}>{application.status}</Pill></td>
                  <td className="px-4 py-3 text-slate-600">{application.artifact}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SelectedJobPanel({ tailoring }: { tailoring?: TailoringControls }) {
  const selected = tailoring?.selected;
  const detail = tailoring?.detail;
  const job = detail?.job ?? selected?.job ?? null;
  const tailored = detail?.tailoredApplication;
  const artifacts = detail?.artifacts ?? [];
  const hasPersistedPdf = Boolean(tailored?.pdfBase64 || artifactOf(artifacts, "pdf_file"));
  const loading = selected && detail === undefined;
  const followUps = tailoring?.followUps;
  const trackedApplication = selected
    ? applicationForRecommendation(followUps?.summary, selected)
    : undefined;
  const trackedTasks = trackedApplication
    ? tasksForApplication(followUps?.summary, trackedApplication._id)
    : [];

  if (!tailoring) {
    return (
      <Panel title="Selected Job">
        <GlassCard className="min-h-[420px]">
          <div className="text-sm font-semibold text-slate-950">Live tailoring unavailable</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Connect the dashboard to Convex to inspect jobs and run tailoring.</p>
        </GlassCard>
      </Panel>
    );
  }

  if (!selected) {
    return (
      <Panel title="Selected Job">
        <GlassCard className="flex min-h-[420px] items-center justify-center text-center">
          <div>
            <FileText className="mx-auto h-8 w-8 text-slate-400" />
            <div className="mt-3 text-sm font-semibold text-slate-950">No job selected</div>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
              Click a ranked recommendation to inspect the description, ranking artifacts, tailoring output, and PDF state.
            </p>
          </div>
        </GlassCard>
      </Panel>
    );
  }

  return (
    <Panel title="Selected Job" actions={<Pill tone={tailored?.status === "completed" ? "success" : tailoring.state.running ? "active" : "neutral"}>{tailored?.status ?? "ready"}</Pill>}>
      <GlassCard className="min-h-[420px] p-0">
        <div className="flex items-start justify-between gap-4 border-b border-white/45 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="active">selected</Pill>
              <Pill tone="success">score {Math.round(detail?.score?.totalScore ?? selected.score)}</Pill>
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">
              {job?.title ?? selected.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{job?.company ?? selected.company}</p>
            <a
              href={job?.jobUrl ?? selected.jobUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-slate-500 hover:text-sky-600"
            >
              original job <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={tailoring.onTailor} disabled={Boolean(loading) || tailoring.state.running}>
              {tailoring.state.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Tailor selected job
            </Button>
            {selected.jobId && (
              <Link
                href={`/applications/${selected.jobId}`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-white/55 bg-white/24 px-3 text-xs font-semibold text-slate-700 transition hover:bg-white/40"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open detail
              </Link>
            )}
            {(tailoring.state.downloadable || tailored?.pdfReady) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={tailoring.onDownload}
                disabled={!tailoring.state.downloadable && !hasPersistedPdf}
                title={!tailoring.state.downloadable && tailored?.pdfReady && !hasPersistedPdf ? "PDF metadata is persisted, but the PDF bytes are not available for this older run." : undefined}
              >
                <Download className="h-3.5 w-3.5" />
                {tailoring.state.downloadable || hasPersistedPdf ? "Download PDF" : "PDF metadata stored"}
              </Button>
            )}
          </div>

          <div className={cx(
            "rounded-[18px] border px-4 py-3 text-sm leading-6",
            tailoring.state.error
              ? "border-red-300/55 bg-red-50/45 text-red-700"
              : "border-white/45 bg-white/28 text-slate-600"
          )}>
            {tailoring.state.error ?? tailoring.state.message}
          </div>

          {followUps && selected ? (
            <div className="rounded-[18px] border border-white/45 bg-white/24 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <CalendarClock className="h-4 w-4 text-sky-600" />
                    Follow-up state
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {trackedApplication
                      ? `${statusLabel(trackedApplication.status)}${trackedApplication.appliedAt ? ` · applied ${formatDateShort(trackedApplication.appliedAt)}` : ""}`
                      : "Not tracked as applied yet."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!trackedApplication ? (
                    <Button
                      size="sm"
                      onClick={() => followUps.onMarkApplied(selected, detail)}
                      disabled={followUps.busy}
                    >
                      {followUps.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Mark applied
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => followUps.onRecordResponse(trackedApplication._id, "responded", "Company replied to the application.")}
                        disabled={followUps.busy}
                      >
                        <Reply className="h-3.5 w-3.5" />
                        Record response
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => followUps.onRecordResponse(trackedApplication._id, "interview", "Interview request received.")}
                        disabled={followUps.busy}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Interview
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {(followUps.message || followUps.error) && (
                <div className={cx(
                  "mb-3 rounded-[14px] border px-3 py-2 text-xs",
                  followUps.error
                    ? "border-red-300/55 bg-red-50/45 text-red-700"
                    : "border-white/45 bg-white/35 text-slate-600"
                )}>
                  {followUps.error ?? followUps.message}
                </div>
              )}

              {trackedApplication ? (
                <div className="space-y-3">
                  {trackedApplication.nextFollowUpAt ? (
                    <div className="text-xs text-slate-500">
                      Next follow-up: <span className="font-semibold text-slate-700">{formatDateShort(trackedApplication.nextFollowUpAt)}</span>
                    </div>
                  ) : null}
                  {trackedApplication.responseSummary ? (
                    <div className="rounded-[14px] border border-emerald-300/45 bg-emerald-50/45 px-3 py-2 text-sm text-emerald-800">
                      {trackedApplication.responseSummary}
                    </div>
                  ) : null}
                  {trackedTasks.length === 0 ? (
                    <div className="text-sm text-slate-500">No open follow-up tasks.</div>
                  ) : (
                    trackedTasks.map((task) => (
                      <FollowUpTaskCard key={task._id} task={task} controls={followUps} />
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-[18px] border border-white/45 bg-white/24 p-4 text-sm text-slate-500">
              Loading job artifacts...
            </div>
          ) : (
            <div className="space-y-3">
              <TimelineItem title="Ingested job description" complete={Boolean(job?.descriptionPlain)}>
                <ArtifactText text={job?.descriptionPlain ?? "No captured description for this job yet."} />
              </TimelineItem>
              <TimelineItem title="Ranking and recommendation" complete={Boolean(detail?.score || selected.rationale)}>
                <ArtifactText text={rankingText(detail, selected)} />
              </TimelineItem>
              <TimelineItem title="Research snapshot" complete={Boolean(tailored?.research || artifactOf(artifacts, "research_snapshot"))}>
                <ArtifactText text={researchText(tailored?.research ?? artifactOf(artifacts, "research_snapshot")?.payload)} />
              </TimelineItem>
              <TimelineItem title="Tailored resume" complete={Boolean(tailored?.tailoredResume || artifactOf(artifacts, "tailored_resume"))}>
                <ArtifactText text={resumeText(tailored?.tailoredResume ?? artifactOf(artifacts, "tailored_resume")?.payload)} />
              </TimelineItem>
              <TimelineItem title="Cover letter" complete={Boolean(tailored?.tailoredResume?.coverLetterBlurb || artifactOf(artifacts, "cover_letter"))}>
                <ArtifactText text={coverLetterText(tailored?.tailoredResume?.coverLetterBlurb ?? artifactOf(artifacts, "cover_letter")?.content ?? artifactOf(artifacts, "cover_letter")?.payload)} />
              </TimelineItem>
              <TimelineItem title="PDF output" complete={Boolean(tailored?.pdfReady)}>
                <p className="text-sm leading-6 text-slate-600">
                  {tailored?.pdfReady
                    ? `${tailored.pdfFilename ?? "Tailored resume PDF"}${tailored.pdfByteLength ? ` · ${Math.round(tailored.pdfByteLength / 1024)} KB` : ""}`
                    : "Run tailoring to generate a downloadable PDF for this session."}
                </p>
              </TimelineItem>
            </div>
          )}
        </div>
      </GlassCard>
    </Panel>
  );
}

function CustomJobDescriptionPanel({ controls }: { controls?: CustomJdControls }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [descriptionPlain, setDescriptionPlain] = useState("");

  if (!controls) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    controls?.onCreate({ company, role, location, jobUrl, descriptionPlain });
  }

  const disabled = controls.busy || !company.trim() || !role.trim() || !descriptionPlain.trim();

  return (
    <form onSubmit={submit} className="mb-4 rounded-[24px] border border-white/45 bg-white/24 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-950">Custom job description</div>
          <div className="mt-1 text-xs text-slate-500">Persist a pasted JD as a first-class Custom JD source.</div>
        </div>
        <Pill tone="active">Custom JD</Pill>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <input className="h-10 rounded-[14px] border border-white/55 bg-white/45 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company" />
        <input className="h-10 rounded-[14px] border border-white/55 bg-white/45 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" value={role} onChange={(event) => setRole(event.target.value)} placeholder="Role" />
        <input className="h-10 rounded-[14px] border border-white/55 bg-white/45 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location optional" />
        <input className="h-10 rounded-[14px] border border-white/55 bg-white/45 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} placeholder="Job URL optional" />
      </div>
      <textarea className="mt-2 min-h-32 w-full rounded-[14px] border border-white/55 bg-white/45 px-3 py-2 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400" value={descriptionPlain} onChange={(event) => setDescriptionPlain(event.target.value)} placeholder="Paste the full job description" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="success" disabled={disabled}>
          {controls.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Add Custom JD
        </Button>
        {(controls.message || controls.error) && (
          <span className={cx("text-xs", controls.error ? "text-red-700" : "text-slate-600")}>{controls.error ?? controls.message}</span>
        )}
      </div>
    </form>
  );
}

function FollowUpsPanel({ controls }: { controls?: FollowUpControls }) {
  const summary = controls?.summary;
  if (!controls || !summary) {
    return (
      <Panel title="Follow-ups" actions={<Pill tone="neutral">draft-only</Pill>}>
        <GlassCard>
          <div className="text-sm font-semibold text-slate-950">Follow-up tracker unavailable</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">Connect Convex to track applied jobs, schedule reminders, and generate outreach drafts.</p>
        </GlassCard>
      </Panel>
    );
  }

  const rows = summary.dueTasks.length > 0 ? summary.dueTasks : summary.scheduledTasks.slice(0, 6);

  return (
    <Panel
      title="Follow-ups"
      actions={<Pill tone={summary.counts.due > 0 ? "warning" : "success"}>{summary.counts.due} due</Pill>}
    >
      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <GlassCard>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <FollowUpStat label="Tracked" value={summary.counts.applications} />
            <FollowUpStat label="Responses" value={summary.counts.responses} />
            <FollowUpStat label="Interviews" value={summary.counts.interviews} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Outreach is draft-only. Email and LinkedIn actions create editable copy and require a manual send confirmation.
          </p>
        </GlassCard>
        <div className="space-y-3">
          {rows.length === 0 ? (
            <GlassCard>
              <div className="text-sm font-semibold text-slate-950">No follow-ups scheduled</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">Mark an application as applied to create the default 5-business-day and 7-business-day reminders.</p>
            </GlassCard>
          ) : (
            rows.map((task) => <FollowUpTaskCard key={task._id} task={task} controls={controls} />)
          )}
        </div>
      </div>
    </Panel>
  );
}

function FollowUpStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] border border-white/45 bg-white/28 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-2xl text-slate-950">{value}</div>
    </div>
  );
}

function FollowUpTaskCard({ task, controls }: { task: FollowUpTask; controls: FollowUpControls }) {
  const application = task.application;
  const draft = task.draft;
  const due = task.scheduledFor <= new Date().toISOString();
  return (
    <div className="rounded-[18px] border border-white/45 bg-white/24 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={due ? "warning" : "neutral"}>{due ? "due" : "scheduled"}</Pill>
            <Pill tone={task.state === "draft_ready" ? "active" : "neutral"}>{task.channel}</Pill>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950">
            {application ? `${application.company} - ${application.title}` : "Application follow-up"}
          </div>
          <div className="mt-1 text-xs text-slate-500">Scheduled {formatDateShort(task.scheduledFor)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => controls.onGenerateDraft(task.applicationId, task.channel, task._id)}
            disabled={controls.busy}
          >
            {task.channel === "email" ? <Mail className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
            {draft ? "Regenerate" : "Draft"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => controls.onManualSend(task._id)}
            disabled={controls.busy}
          >
            <Check className="h-3.5 w-3.5" />
            Sent manually
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => controls.onSkipTask(task._id)}
            disabled={controls.busy}
          >
            Skip
          </Button>
        </div>
      </div>
      {draft ? (
        <DraftEditor draft={draft} controls={controls} />
      ) : null}
    </div>
  );
}

function DraftEditor({ draft, controls }: { draft: OutreachDraft; controls: FollowUpControls }) {
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [recipient, setRecipient] = useState(draft.recipient ?? "");
  const [body, setBody] = useState(draft.body);

  return (
    <div className="mt-4 space-y-3 rounded-[16px] border border-white/45 bg-white/32 p-3">
      {draft.channel === "email" ? (
        <input
          className="w-full rounded-[12px] border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-300"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Subject"
        />
      ) : null}
      <input
        className="w-full rounded-[12px] border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-300"
        value={recipient}
        onChange={(event) => setRecipient(event.target.value)}
        placeholder="Recipient"
      />
      <textarea
        className="min-h-40 w-full resize-y rounded-[12px] border border-white/60 bg-white/70 px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-sky-300"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => controls.onUpdateDraft(draft._id, {
            subject: draft.channel === "email" ? subject : undefined,
            recipient,
            body,
          })}
          disabled={controls.busy}
        >
          Save draft
        </Button>
        <Button
          size="sm"
          onClick={() => controls.onApproveDraft(draft._id)}
          disabled={controls.busy || Boolean(draft.approvedAt)}
        >
          <Check className="h-3.5 w-3.5" />
          {draft.approvedAt ? "Approved" : "Approve"}
        </Button>
      </div>
    </div>
  );
}

function TimelineItem({
  title,
  complete,
  children,
}: {
  title: string;
  complete: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-white/45 bg-white/24 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className={complete ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-slate-400"} />
        <div className="text-sm font-semibold text-slate-950">{title}</div>
      </div>
      {children}
    </div>
  );
}

function ArtifactText({ text }: { text: string }) {
  return (
    <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-[14px] border border-white/45 bg-white/35 p-3 text-xs leading-5 text-slate-700">
      {text}
    </pre>
  );
}

function artifactOf(artifacts: JobDetail["artifacts"], kind: NonNullable<JobDetail["artifacts"]>[number]["kind"]) {
  return artifacts?.find((artifact) => artifact.kind === kind);
}

function rankingText(detail: JobDetail | null | undefined, selected: LiveRecommendation): string {
  const score = detail?.score;
  return [
    score?.rationale ?? selected.rationale ?? "No ranking rationale recorded.",
    score ? `Total: ${Math.round(score.totalScore)}${score.llmScore ? `\nLLM: ${score.llmScore}` : ""}${score.scoringMode ? `\nMode: ${score.scoringMode}` : ""}` : "",
    score?.strengths?.length ? `Strengths:\n- ${score.strengths.join("\n- ")}` : "",
    score?.risks?.length ? `Risks:\n- ${score.risks.join("\n- ")}` : "",
  ].filter(Boolean).join("\n\n");
}

function researchText(value: unknown): string {
  if (!value || typeof value !== "object") return "No research snapshot yet.";
  const research = value as Partial<JobResearch>;
  return [
    research.jdSummary,
    research.requirements?.length ? `Requirements:\n- ${research.requirements.join("\n- ")}` : "",
    research.techStack?.length ? `Tech stack:\n- ${research.techStack.join("\n- ")}` : "",
    research.cultureSignals?.length ? `Signals:\n- ${research.cultureSignals.join("\n- ")}` : "",
  ].filter(Boolean).join("\n\n");
}

function resumeText(value: unknown): string {
  if (!value || typeof value !== "object") return "No tailored resume yet.";
  const resume = value as TailoredApplication["tailoredResume"];
  return [
    resume.experience?.length
      ? `Experience:\n${resume.experience
          .map((item) => `${item.title} · ${item.company}\n- ${item.bullets.join("\n- ")}`)
          .join("\n\n")}`
      : "",
    resume.education?.length
      ? `Education:\n${resume.education
          .map((item) => [item.school, item.degree, item.field].filter(Boolean).join(" · "))
          .join("\n")}`
      : "",
    resume.skills?.length ? `Skills: ${resume.skills.join(", ")}` : "",
    resume.projects?.length
      ? `Projects:\n${resume.projects
          .map((item) => `${item.name}\n- ${item.bullets.join("\n- ")}`)
          .join("\n\n")}`
      : "",
    resume.tailoringNotes?.qualityIssues?.length
      ? `Quality checks:\n- ${resume.tailoringNotes.qualityIssues.join("\n- ")}`
      : "",
  ].filter(Boolean).join("\n\n");
}

function coverLetterText(value: unknown): string {
  if (!value) return "No cover letter artifact yet.";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "text" in value) {
    const text = (value as { text?: unknown }).text;
    return typeof text === "string" ? text : "No cover letter artifact yet.";
  }
  return "No cover letter artifact yet.";
}

function buildDashboardSeed(
  run: LiveRunSummary | null | undefined,
  recommendations: LiveRecommendation[] | undefined,
  followUps?: FollowUpSummary
): DashboardSeed {
  if (run === undefined || recommendations === undefined) {
    return {
      ...emptyDashboardSeed,
      metrics: emptyDashboardSeed.metrics.map((metric) =>
        metric.label === "Active runs"
          ? { ...metric, detail: "connecting to Convex" }
          : metric
      ),
      activity: [
        {
          time: "now",
          type: "tool",
          title: "Connecting to live data",
          detail: "Waiting for Convex to return the latest ingestion run.",
          evidence: "convex",
        },
      ],
    };
  }

  if (!run && followUps && followUps.counts.applications > 0) {
    return {
      ...emptyDashboardSeed,
      metrics: followUpMetrics(followUps),
      activity: [
        {
          time: "now",
          type: followUps.counts.due > 0 ? "decision" : "success",
          title: "Follow-up tracker active",
          detail: `${followUps.counts.applications} applications tracked, ${followUps.counts.due} follow-ups due.`,
          evidence: "convex",
        },
      ],
    };
  }

  if (!run) return emptyDashboardSeed;

  const sortedRecommendations = [...(recommendations ?? [])].sort((a, b) => a.rank - b.rank);
  const activeRun = mapRunToActiveRun(run);
  const progress = run.status === "completed" ? 100 : run.status === "ranking" ? 72 : run.status === "fetched" ? 52 : run.status === "fetching" ? 28 : 100;
  const hasErrors = run.errorCount > 0 || run.status === "failed";

  return {
    generatedAt: formatTime(run.completedAt ?? run.startedAt),
    mode: "live",
    metrics: followUps
      ? followUpMetrics(followUps, run, sortedRecommendations.length, progress, hasErrors)
      : [
          { label: "Applications", value: String(run.recommendedCount || sortedRecommendations.length), detail: `${run.rawJobCount} jobs scraped`, tone: "accent", progress: Math.min(100, sortedRecommendations.length * 12) },
          { label: "Active runs", value: run.status === "completed" || run.status === "failed" ? "0" : "1", detail: run.status, tone: run.status === "failed" ? "danger" : "active", progress },
          { label: "DLQ pending", value: String(run.errorCount), detail: hasErrors ? "run errors captured" : "no blockers", tone: hasErrors ? "warning" : "success", progress: hasErrors ? 35 : 0 },
          { label: "Cache reuse", value: "0%", detail: "live ingestion", tone: "neutral", progress: 0 },
          { label: "Time saved", value: "0h", detail: "tracking soon", tone: "neutral", progress: 0 },
        ],
    activeRun,
    providers: mapProviders(run),
    applications: mapApplications(sortedRecommendations),
    dlq: hasErrors
      ? [
          {
            title: "Ingestion errors",
            question: `${run.errorCount} source${run.errorCount === 1 ? "" : "s"} returned an error.`,
            answerability: "review needed",
            impact: "Open run logs before trusting recommendations.",
            tone: "warning",
          },
        ]
      : [],
    activity: [
      {
        time: formatTime(run.startedAt),
        type: run.status === "failed" ? "decision" : run.status === "completed" ? "success" : "tool",
        title: `Ashby ingestion ${run.status}`,
        detail: `${run.fetchedCount}/${run.sourceCount} sources fetched, ${run.rawJobCount} jobs scraped, ${run.recommendedCount} recommendations ranked.`,
        evidence: run.scoringMode ?? "live",
      },
    ],
    artifacts: mapArtifacts(run, sortedRecommendations),
  };
}

function followUpMetrics(
  followUps: FollowUpSummary,
  run?: LiveRunSummary,
  recommendationCount = 0,
  runProgress = 0,
  hasErrors = false
): DashboardMetric[] {
  return [
    {
      label: "Applications",
      value: String(Math.max(followUps.counts.applications, run?.recommendedCount ?? recommendationCount)),
      detail: `${followUps.counts.applied} applied`,
      tone: "accent",
      progress: Math.min(100, Math.max(followUps.counts.applications, recommendationCount) * 12),
    },
    {
      label: "Active runs",
      value: run && run.status !== "completed" && run.status !== "failed" ? "1" : "0",
      detail: run?.status ?? "follow-up mode",
      tone: run?.status === "failed" ? "danger" : "active",
      progress: run ? runProgress : 0,
    },
    {
      label: "Follow-ups due",
      value: String(followUps.counts.due),
      detail: followUps.counts.due > 0 ? "needs draft or manual send" : "none due",
      tone: followUps.counts.due > 0 ? "warning" : "success",
      progress: Math.min(100, followUps.counts.due * 20),
    },
    {
      label: "Responses",
      value: String(followUps.counts.responses),
      detail: hasErrors ? "run errors captured" : `${followUps.counts.interviews} interviews`,
      tone: followUps.counts.responses > 0 ? "success" : "neutral",
      progress: Math.min(100, followUps.counts.responses * 15),
    },
    {
      label: "Closed",
      value: String(followUps.counts.rejectedClosed),
      detail: "rejected or closed",
      tone: "neutral",
      progress: Math.min(100, followUps.counts.rejectedClosed * 12),
    },
  ];
}

function mapRunToActiveRun(run: LiveRunSummary): ActiveRun {
  return {
    id: shortId(run._id),
    company: "Ashby ingestion",
    role: `${run.sourceCount} source${run.sourceCount === 1 ? "" : "s"}`,
    provider: "Ashby",
    mode: "live",
    state: run.status === "failed" ? "blocked" : run.status === "completed" ? "completed" : "running",
    currentStep: run.status,
    summary: `${run.rawJobCount} jobs scraped, ${run.filteredCount} filtered, ${run.recommendedCount} recommendations ready.`,
    steps: [
      { label: "Fetch sources", status: stepStatus(run, ["fetching"]) },
      { label: "Store jobs", status: stepStatus(run, ["fetched"]) },
      { label: "Rank matches", status: stepStatus(run, ["ranking"]) },
      { label: "Recommend", status: run.status === "completed" ? "complete" : run.status === "failed" ? "blocked" : "pending" },
      { label: "Tailor", status: run.hasCompletedTailoring ? "complete" : "pending" },
    ],
  };
}

function stepStatus(run: LiveRunSummary, activeStatuses: LiveRunSummary["status"][]): ActiveRun["steps"][number]["status"] {
  if (run.status === "failed") return "blocked";
  if (activeStatuses.includes(run.status)) return "active";
  const order = ["fetching", "fetched", "ranking", "completed"];
  const statusIndex = order.indexOf(run.status);
  const activeIndex = Math.max(...activeStatuses.map((status) => order.indexOf(status)));
  return statusIndex > activeIndex || run.status === "completed" ? "complete" : "pending";
}

function mapProviders(run: LiveRunSummary): ProviderCoverage[] {
  return [
    {
      provider: "Ashby",
      status: run.status === "completed" ? "live data" : run.status,
      tone: run.status === "failed" ? "danger" : run.status === "completed" ? "success" : "active",
      detail: `${run.fetchedCount}/${run.sourceCount} sources fetched`,
    },
    { provider: "Greenhouse", status: "not run", tone: "neutral", detail: "validation pending" },
    { provider: "Lever", status: "not run", tone: "neutral", detail: "validation pending" },
    { provider: "Workday", status: "not run", tone: "neutral", detail: "validation pending" },
  ];
}

function mapApplications(recommendations: LiveRecommendation[]): ApplicationRow[] {
  return recommendations.map((recommendation) => ({
    company: recommendation.company,
    role: recommendation.title,
    provider: "Ashby",
    match: `${Math.round(recommendation.score)}%`,
    status: `rank #${recommendation.rank}`,
    tone: recommendation.rank <= 3 ? "success" : "neutral",
    artifact: recommendation.rationale ? "ranking rationale" : "job description",
  }));
}

function mapArtifacts(run: LiveRunSummary, recommendations: LiveRecommendation[]): ArtifactSummary[] {
  const artifacts: ArtifactSummary[] = [
    { title: "Ingestion run", meta: `${run.rawJobCount} scraped jobs`, type: "preview" },
  ];
  if (recommendations[0]) {
    artifacts.push({
      title: `${recommendations[0].company} recommendation`,
      meta: `${Math.round(recommendations[0].score)}% match`,
      type: "attachment",
    });
  }
  return artifacts;
}

function shortId(id: string) {
  return id.length > 8 ? id.slice(-8) : id;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "live";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function applicationForRecommendation(
  summary: FollowUpSummary | undefined,
  recommendation: LiveRecommendation
) {
  return summary?.applications.find((application) =>
    recommendation.jobId
      ? application.jobId === recommendation.jobId
      : application.company === recommendation.company && application.title === recommendation.title
  );
}

function tasksForApplication(summary: FollowUpSummary | undefined, applicationId: string) {
  return (summary?.scheduledTasks ?? []).filter((task) => task.applicationId === applicationId);
}

function statusLabel(status: FollowUpApplication["status"]) {
  return status.replace(/_/g, " ");
}

function statusTone(status: FollowUpApplication["status"]): StatusTone {
  if (["responded", "interview", "offer"].includes(status)) return "success";
  if (["follow_up_due", "blocked"].includes(status)) return "warning";
  if (["rejected", "closed"].includes(status)) return "danger";
  if (["applied", "followed_up"].includes(status)) return "active";
  return "neutral";
}

function formatLogTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function logTone(level: PipelineLog["level"]): StatusTone {
  if (level === "success") return "success";
  if (level === "warning") return "warning";
  if (level === "error") return "danger";
  return "active";
}

function compactPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function ConnectedRecruitDashboard() {
  const [runState, setRunState] = useState<PipelineRunState>("idle");
  const [runMessage, setRunMessage] = useState<string>();
  const [runError, setRunError] = useState<string>();
  const [liveData, setLiveData] = useState<LiveDashboardPayload>();
  const [selected, setSelected] = useState<LiveRecommendation | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null | undefined>(null);
  const [tailorState, setTailorState] = useState<TailorState>({
    running: false,
    message: "Select a ranked job to inspect and tailor.",
  });
  const [customJdState, setCustomJdState] = useState<{ busy: boolean; message?: string; error?: string }>({
    busy: false,
  });
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState<string>();
  const [followUpError, setFollowUpError] = useState<string>();

  const busy = runState === "syncing" || runState === "ingesting" || runState === "ranking";

  const refreshLiveData = useCallback(async () => {
    const response = await fetch("/api/dashboard/live", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`dashboard_live_${response.status}`);
    }
    setLiveData(await response.json() as LiveDashboardPayload);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/dashboard/live", { cache: "no-store" });
        if (!response.ok) throw new Error(`dashboard_live_${response.status}`);
        const payload = await response.json() as LiveDashboardPayload;
        if (!cancelled) setLiveData(payload);
      } catch (err) {
        if (!cancelled) {
          setRunError(err instanceof Error ? err.message : String(err));
          setLiveData({ run: null, recommendations: [], logs: [] });
        }
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), busy ? 2500 : 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [busy]);

  useEffect(() => {
    if (!selected?.jobId) {
      return;
    }
    const selectedJobId = selected.jobId;

    let cancelled = false;

    async function refreshJobDetail() {
      try {
        const response = await fetch(`/api/dashboard/job-detail?jobId=${encodeURIComponent(selectedJobId)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? `job_detail_${response.status}`);
        }
        const payload = await response.json() as { detail: JobDetail };
        if (!cancelled) setJobDetail(payload.detail);
      } catch (err) {
        if (!cancelled) {
          setJobDetail(null);
          setTailorState({
            running: false,
            message: "Could not load job detail.",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    void refreshJobDetail();
    return () => {
      cancelled = true;
    };
  }, [selected?.jobId]);

  async function runFirstThreeSources() {
    if (busy) return;

    try {
      setRunError(undefined);
      setRunMessage("Preparing Ashby sources...");
      setRunState("syncing");

      setRunMessage("Fetching jobs from the first 3 Ashby sources...");
      setRunState("ingesting");

      setRunMessage("Ranking scraped jobs...");
      setRunState("ranking");
      const response = await fetch("/api/dashboard/run-first-3", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `dashboard_run_${response.status}`);
      }

      setRunState("done");
      setRunMessage("Pipeline run complete. Live dashboard updated from Convex.");
      await refreshLiveData();
    } catch (err) {
      setRunState("error");
      setRunError(err instanceof Error ? err.message : String(err));
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
    setSelected(recommendation);
    setJobDetail(undefined);
    setTailorState({
      running: false,
      message: "Inspect the job description, then tailor this job.",
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
          ? "Using the sample profile from Convex, then tailoring the selected job..."
          : "Researching the selected job and tailoring the resume...",
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

      const detailResponse = await fetch(`/api/dashboard/job-detail?jobId=${encodeURIComponent(selected.jobId)}`, {
        cache: "no-store",
      });
      if (detailResponse.ok) {
        const payload = await detailResponse.json() as { detail: JobDetail };
        setJobDetail(payload.detail);
      }
      await refreshLiveData();
    } catch (err) {
      setTailorState({
        running: false,
        message: "Tailoring failed.",
        error: err instanceof Error ? err.message : String(err),
      });
      await refreshLiveData().catch(() => undefined);
    }
  }

  async function createCustomJd(request: CustomJdRequest) {
    if (customJdState.busy) return;
    try {
      setCustomJdState({ busy: true, message: "Persisting custom JD..." });
      const response = await fetch("/api/dashboard/custom-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await response.json().catch(() => null) as
        | { ok: true; jobId: string; detail?: JobDetail }
        | { ok: false; reason?: string }
        | null;
      if (!response.ok || !body || !body.ok) {
        throw new Error(body && !body.ok ? body.reason ?? `custom_jd_${response.status}` : `custom_jd_${response.status}`);
      }
      setCustomJdState({ busy: false, message: "Custom JD saved. Select it from the recommendation table to tailor." });
      await refreshLiveData();
      if (body.detail?.recommendation) {
        setSelected(body.detail.recommendation);
        setJobDetail(body.detail);
        setTailorState({ running: false, message: "Custom JD is ready. Inspect it, then tailor this job." });
      }
    } catch (err) {
      setCustomJdState({ busy: false, error: err instanceof Error ? err.message : String(err) });
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

  async function postFollowUpAction(payload: Record<string, unknown>, successMessage: string) {
    try {
      setFollowUpBusy(true);
      setFollowUpError(undefined);
      setFollowUpMessage(successMessage);
      const response = await fetch("/api/dashboard/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; reason?: string } | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.reason ?? `followups_${response.status}`);
      }
      await refreshLiveData();
      if (selected?.jobId) {
        const detailResponse = await fetch(`/api/dashboard/job-detail?jobId=${encodeURIComponent(selected.jobId)}`, {
          cache: "no-store",
        });
        if (detailResponse.ok) {
          const payload = await detailResponse.json() as { detail: JobDetail };
          setJobDetail(payload.detail);
        }
      }
    } catch (err) {
      setFollowUpError(err instanceof Error ? err.message : String(err));
    } finally {
      setFollowUpBusy(false);
    }
  }

  function markRecommendationApplied(recommendation: LiveRecommendation, detail: JobDetail | null | undefined) {
    const sourceJob = detail?.job ?? recommendation.job ?? null;
    void postFollowUpAction({
      action: "mark-applied",
      jobId: recommendation.jobId,
      company: sourceJob?.company ?? recommendation.company,
      title: sourceJob?.title ?? recommendation.title,
      provider: "Ashby",
      jobUrl: sourceJob?.jobUrl ?? recommendation.jobUrl,
      metadata: {
        rank: recommendation.rank,
        score: recommendation.score,
        compensationSummary: recommendation.compensationSummary,
      },
    }, "Application marked applied. Default follow-ups scheduled.");
  }

  function generateFollowUpDraft(applicationId: string, channel: FollowUpTask["channel"], taskId?: string) {
    void postFollowUpAction({
      action: "generate-draft",
      applicationId,
      taskId,
      channel,
      profile: readProfile(),
    }, "Draft generated. Review it before sending manually.");
  }

  function updateFollowUpDraft(
    draftId: string,
    fields: Partial<Pick<OutreachDraft, "subject" | "body" | "recipient" | "tone">>
  ) {
    void postFollowUpAction({
      action: "update-draft",
      draftId,
      ...fields,
    }, "Draft updated.");
  }

  function approveFollowUpDraft(draftId: string) {
    void postFollowUpAction({
      action: "approve-draft",
      draftId,
    }, "Draft approved. It still requires manual sending.");
  }

  function markFollowUpSent(taskId: string) {
    void postFollowUpAction({
      action: "manual-send",
      taskId,
    }, "Manual send recorded.");
  }

  function skipFollowUpTask(taskId: string) {
    void postFollowUpAction({
      action: "skip",
      taskId,
    }, "Follow-up skipped.");
  }

  function recordApplicationResponse(
    applicationId: string,
    status: FollowUpApplication["status"],
    responseSummary: string
  ) {
    void postFollowUpAction({
      action: "record-response",
      applicationId,
      status,
      responseSummary,
    }, "Application response recorded.");
  }

  return (
    <DashboardShell
      seed={buildDashboardSeed(liveData?.run, liveData?.recommendations, liveData?.followUps)}
      tailoring={{
        recommendations: liveData?.recommendations ?? [],
        selected,
        detail: jobDetail,
        state: tailorState,
        followUps: {
          summary: liveData?.followUps,
          busy: followUpBusy,
          message: followUpMessage,
          error: followUpError,
          onMarkApplied: markRecommendationApplied,
          onGenerateDraft: generateFollowUpDraft,
          onUpdateDraft: updateFollowUpDraft,
          onApproveDraft: approveFollowUpDraft,
          onManualSend: markFollowUpSent,
          onSkipTask: skipFollowUpTask,
          onRecordResponse: recordApplicationResponse,
        },
        onSelect: selectRecommendation,
        onTailor: () => void tailorSelectedJob(),
        onDownload: downloadTailoredPdf,
      }}
      controls={{
        canRun: true,
        busy,
        label: busy ? runState : "Run first 3",
        message: runMessage,
        error: runError,
        logs: liveData?.logs ?? [],
        onRunFirst3: () => void runFirstThreeSources(),
      }}
      customJd={{
        busy: customJdState.busy,
        message: customJdState.message,
        error: customJdState.error,
        onCreate: (request) => void createCustomJd(request),
      }}
    />
  );
}

export function RecruitDashboard({ seed }: { seed?: DashboardSeed }) {
  if (seed) return <DashboardShell seed={seed} />;
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return (
      <DashboardShell
        seed={emptyDashboardSeed}
        controls={{
          canRun: false,
          busy: false,
          label: "Run first 3",
          message: "Set NEXT_PUBLIC_CONVEX_URL before running the live pipeline.",
        }}
      />
    );
  }
  return <ConnectedRecruitDashboard />;
}
