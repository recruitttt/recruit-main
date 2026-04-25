"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  BriefcaseBusiness,
  Check,
  CircleStop,
  FileText,
  LayoutDashboard,
  Loader2,
  Pause,
  Play,
  Power,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  ActionButton as Button,
  ArtifactCard,
  EventLog,
  FilterChip,
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
  recommendations?: LiveRecommendation[];
};

type LiveRecommendation = {
  company: string;
  title: string;
  location?: string;
  score: number;
  rank: number;
  jobUrl: string;
  rationale?: string;
};

type PipelineControls = {
  canRun: boolean;
  busy: boolean;
  label: string;
  message?: string;
  error?: string;
  onRunFirst3?: () => void;
};

type PipelineRunState = "idle" | "syncing" | "ingesting" | "ranking" | "done" | "error";

type LiveDashboardPayload = {
  run: LiveRunSummary | null;
  recommendations: LiveRecommendation[];
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

function DashboardShell({ seed, controls }: { seed: DashboardSeed; controls?: PipelineControls }) {
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

          <DashboardMain seed={seed} controls={controls} />
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

function DashboardMain({ seed, controls }: { seed: DashboardSeed; controls?: PipelineControls }) {
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

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Application Pipeline">
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
                {seed.applications.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                      No live recommendations yet. Start ingestion to fill this table.
                    </td>
                  </tr>
                ) : seed.applications.map((application) => (
                  <tr key={`${application.company}-${application.role}-${application.status}`} className="border-b border-white/35 transition hover:bg-white/22 last:border-0">
                    <td className="px-4 py-3 font-semibold text-slate-950">{application.company}</td>
                    <td className="px-4 py-3 text-slate-600">{application.role}</td>
                    <td className="px-4 py-3 text-slate-500">{application.provider}</td>
                    <td className="px-4 py-3 font-mono text-slate-950">{application.match}</td>
                    <td className="px-4 py-3"><Pill tone={application.tone}>{application.status}</Pill></td>
                    <td className="px-4 py-3 text-slate-600">{application.artifact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="DLQ & Cache">
          <div className="space-y-3">
            {seed.dlq.length === 0 ? (
              <GlassCard>
                <div className="text-sm font-semibold text-slate-950">No blockers</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">Live DLQ items will appear here when a run needs human input.</p>
              </GlassCard>
            ) : seed.dlq.map((item) => (
              <GlassCard key={item.title} variant={item.tone === "warning" ? "selected" : "default"}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Pill tone={item.tone}>{item.answerability}</Pill>
                    <div className="mt-3 font-semibold text-slate-950">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.question}</p>
                    <div className="mt-3 text-xs text-slate-500">{item.impact}</div>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
              </GlassCard>
            ))}
            <GlassCard>
              <div className="text-sm font-semibold text-slate-950">Answer cache impact</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <FilterChip label="portfolio URL" tone="success" />
                <FilterChip label="demo link" tone="neutral" />
                <FilterChip label="source question" tone="accent" />
              </div>
            </GlassCard>
          </div>
        </Panel>
      </div>

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

function buildDashboardSeed(run: LiveRunSummary | null | undefined, recommendations: LiveRecommendation[] | undefined): DashboardSeed {
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

  if (!run) return emptyDashboardSeed;

  const sortedRecommendations = [...(recommendations ?? [])].sort((a, b) => a.rank - b.rank);
  const activeRun = mapRunToActiveRun(run);
  const progress = run.status === "completed" ? 100 : run.status === "ranking" ? 72 : run.status === "fetched" ? 52 : run.status === "fetching" ? 28 : 100;
  const hasErrors = run.errorCount > 0 || run.status === "failed";

  return {
    generatedAt: formatTime(run.completedAt ?? run.startedAt),
    mode: "live",
    metrics: [
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
      { label: "Tailor", status: "pending" },
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

function ConnectedRecruitDashboard() {
  const [runState, setRunState] = useState<PipelineRunState>("idle");
  const [runMessage, setRunMessage] = useState<string>();
  const [runError, setRunError] = useState<string>();
  const [liveData, setLiveData] = useState<LiveDashboardPayload>();

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
          setLiveData({ run: null, recommendations: [] });
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

  return (
    <DashboardShell
      seed={buildDashboardSeed(liveData?.run, liveData?.recommendations)}
      controls={{
        canRun: true,
        busy,
        label: busy ? runState : "Run first 3",
        message: runMessage,
        error: runError,
        onRunFirst3: () => void runFirstThreeSources(),
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
