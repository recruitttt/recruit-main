import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Command,
  Download,
  FileText,
  Loader2,
  Lock,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Mark, Wordmark } from "@/components/ui/logo";

const liveRuns = [
  { company: "Linear", role: "Design Engineer", state: "Submitting", score: 94 },
  { company: "Anthropic", role: "Product Engineer", state: "Tailoring", score: 91 },
  { company: "Vercel", role: "Frontend Engineer", state: "Reviewing", score: 88 },
];

const proof = [
  ["3", "agents active"],
  ["14", "fields mapped"],
  ["91", "tailor score"],
];

const steps = [
  {
    title: "Find roles",
    detail: "Scans Ashby boards and ranks openings against your profile.",
    icon: Search,
  },
  {
    title: "Tailor docs",
    detail: "Researches the role, rewrites your resume, and generates a PDF.",
    icon: FileText,
  },
  {
    title: "Ask before guessing",
    detail: "Sensitive questions stop in the queue until you approve them.",
    icon: ShieldCheck,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#EEF3F7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/45 bg-[#EEF3F7]/78 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <Link
            href="/"
            aria-label="Recruit"
            className="flex h-10 items-center gap-2 rounded-full border border-white/70 bg-white/55 px-2.5 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_30px_rgba(15,23,42,0.06)]"
          >
            <Mark size="sm" className="text-sky-600" />
            <span className="font-serif text-[19px] leading-none tracking-tight text-sky-700">
              recruit
            </span>
          </Link>

          <nav className="ml-8 hidden items-center gap-6 text-[13px] font-medium text-slate-500 md:flex">
            <Link href="/dashboard" className="transition hover:text-slate-950">
              Dashboard
            </Link>
            <Link href="/pricing" className="transition hover:text-slate-950">
              Pricing
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/dashboard" className="hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-slate-600 hover:bg-white/45 hover:text-slate-950"
              >
                Sign in
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button size="sm" className="rounded-full bg-slate-950 px-4 text-white hover:bg-slate-800">
                Start applying
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative border-b border-white/50">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.72),rgba(255,255,255,0.18)_42%,rgba(238,243,247,0))]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:64px_64px] opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />

        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col px-4 pb-8 pt-16 sm:px-6 sm:pt-20 lg:pt-24">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/62 px-3 py-1.5 text-[12px] font-semibold text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_40px_rgba(15,23,42,0.06)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white">
                <Sparkles className="h-3 w-3" />
              </span>
              AI agents for the job hunt
            </div>

            <h1 className="mx-auto mt-7 max-w-5xl text-balance font-serif text-[clamp(48px,9vw,112px)] leading-[0.91] tracking-tight text-slate-950">
              Apply to jobs without applying.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-[16px] leading-7 text-slate-600 sm:text-[18px]">
              Recruit finds roles, researches each company, tailors your resume, and pauses only when it needs your truth.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/onboarding">
                <Button size="lg" className="h-12 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800">
                  Spin up my agents
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-12 rounded-full border-white/70 bg-white/58 px-6 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_34px_rgba(15,23,42,0.06)] hover:bg-white/75"
                >
                  View live dashboard
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative mx-auto mt-12 w-full max-w-6xl flex-1">
            <ProductMockup />
          </div>
        </div>
      </section>

      <section className="bg-[#F7FAFC] px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="rounded-[28px] border border-white/70 bg-white/68 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur-xl"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/78 text-sky-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <step.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200/70 bg-[#F7FAFC] px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          <div className="flex gap-5">
            <Link href="/pricing" className="transition hover:text-slate-950">Pricing</Link>
            <Link href="/dashboard" className="transition hover:text-slate-950">Dashboard</Link>
            <Link href="/onboarding" className="transition hover:text-slate-950">Start</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ProductMockup() {
  return (
    <div className="relative">
      <div className="absolute left-1/2 top-8 h-[86%] w-[88%] -translate-x-1/2 rounded-[42px] bg-slate-950/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[34px] border border-white/70 bg-white/66 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_32px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
        <div className="flex items-center gap-2 border-b border-white/55 bg-white/55 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="mx-auto hidden h-8 w-[360px] items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 text-[12px] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] md:flex">
            <Lock className="h-3.5 w-3.5" />
            recruit.app/dashboard/live-run
          </div>
          <div className="flex h-8 items-center gap-1.5 rounded-full border border-white/75 bg-white/65 px-3 text-[12px] font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            live
          </div>
        </div>

        <div className="grid min-h-[520px] gap-px bg-white/45 md:grid-cols-[220px_1fr_330px]">
          <aside className="hidden bg-white/45 p-4 md:block">
            <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/65 p-2">
              <Mark size="sm" className="text-sky-600" />
              <div>
                <div className="text-[13px] font-semibold text-slate-950">Recruit</div>
                <div className="text-[11px] text-slate-500">command center</div>
              </div>
            </div>
            <div className="mt-5 space-y-2 text-[13px]">
              {["Dashboard", "Applications", "Artifacts", "DLQ"].map((item, index) => (
                <div
                  key={item}
                  className={`flex items-center justify-between rounded-2xl px-3 py-2.5 ${
                    index === 0
                      ? "border border-white/80 bg-white/76 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
                      : "text-slate-500"
                  }`}
                >
                  <span>{item}</span>
                  {index === 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
                </div>
              ))}
            </div>
          </aside>

          <section className="bg-white/35 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Live run
                </div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  5 agents applying for Mo
                </h2>
              </div>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-[13px] font-semibold text-white">
                <Command className="h-3.5 w-3.5" />
                Assist
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {proof.map(([value, label]) => (
                <div key={label} className="rounded-[22px] border border-white/70 bg-white/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="font-mono text-3xl text-slate-950">{value}</div>
                  <div className="mt-1 text-[12px] text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-[26px] border border-white/70 bg-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <div className="flex items-center justify-between border-b border-white/65 px-4 py-3">
                <div className="text-[13px] font-semibold text-slate-950">Application pipeline</div>
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
                  syncing
                </div>
              </div>
              <div className="divide-y divide-white/65">
                {liveRuns.map((run) => (
                  <div key={run.company} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-4 sm:grid-cols-[1fr_130px_70px] sm:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-slate-950">{run.company}</div>
                      <div className="mt-1 truncate text-[12px] text-slate-500">{run.role}</div>
                    </div>
                    <div className="hidden rounded-full border border-white/75 bg-white/64 px-3 py-1 text-center text-[12px] font-semibold text-sky-700 sm:block">
                      {run.state}
                    </div>
                    <div className="font-mono text-[18px] text-slate-950">{run.score}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="bg-white/48 p-4 sm:p-5">
            <div className="rounded-[26px] border border-white/75 bg-slate-950 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold">Scout</div>
                <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  active
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-6 text-white/88">
                I found three strong roles. Linear is ready to submit after your work authorization answer.
              </p>
              <div className="mt-4 rounded-[18px] border border-white/10 bg-white/8 p-3">
                <div className="flex items-center gap-2 text-[12px] text-white/64">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Human gate
                </div>
                <div className="mt-2 text-[13px] leading-5 text-white/86">
                  Are you legally authorized to work in the United States?
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <MiniArtifact icon={FileText} title="Resume tailored" detail="PDF ready for Anthropic" />
              <MiniArtifact icon={Check} title="Answers cached" detail="12 fields reused safely" />
              <MiniArtifact icon={Download} title="Artifact saved" detail="Ranking proof attached" />
            </div>

            <div className="mt-4 rounded-[24px] border border-white/70 bg-white/64 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Next action
              </div>
              <div className="mt-2 text-[14px] font-semibold text-slate-950">
                Approve one answer, then Scout submits.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MiniArtifact({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof FileText;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/64 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-slate-950">{title}</div>
        <div className="mt-0.5 truncate text-[12px] text-slate-500">{detail}</div>
      </div>
    </div>
  );
}
