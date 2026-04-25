import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  BriefcaseBusiness,
  Check,
  CircleStop,
  FileText,
  LayoutDashboard,
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
import { DevPipelineWorkspace } from "@/components/dashboard/dev-pipeline-workspace";
import type { DashboardMetric, DashboardSeed } from "@/lib/dashboard-seed";

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

function DashboardShell({ seed }: { seed: DashboardSeed }) {
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

          <DashboardMain seed={seed} />
        </section>
      </div>
    </main>
  );
}

function ActiveRunPanel({ seed }: { seed: DashboardSeed }) {
  const run = seed.activeRun;

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
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" variant="success"><Play className="h-3.5 w-3.5" /> Start</Button>
            <Button size="sm" variant="secondary"><Pause className="h-3.5 w-3.5" /> Pause</Button>
            <Button size="sm" variant="danger"><CircleStop className="h-3.5 w-3.5" /> Stop</Button>
          </div>
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

function DashboardMain({ seed }: { seed: DashboardSeed }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-5">
        {seed.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <ActiveRunPanel seed={seed} />
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

      <DevPipelineWorkspace />

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
                {seed.applications.map((application) => (
                  <tr key={`${application.company}-${application.role}`} className="border-b border-white/35 transition hover:bg-white/22 last:border-0">
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
            {seed.dlq.map((item) => (
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
            {seed.artifacts.map((artifact) => (
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

export function RecruitDashboard({ seed }: { seed: DashboardSeed }) {
  return <DashboardShell seed={seed} />;
}
