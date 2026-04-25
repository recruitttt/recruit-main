import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { AgentTicker } from "@/components/landing/agent-ticker";
import { JobPrompt } from "@/components/landing/job-prompt";
import { ArrowRight, Database, Layers, Workflow, Shield } from "lucide-react";

const trustedBy = ["Anthropic", "Linear", "Vercel", "Perplexity", "Supabase", "Notion"];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <Link href="/">
            <Wordmark />
          </Link>
          <nav className="ml-10 hidden items-center gap-6 md:flex">
            <Link href="#how-it-works" className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
              How it works
            </Link>
            <Link href="#features" className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
              Pricing
            </Link>
            <Link href="/dashboard" className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
              Dashboard
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/dashboard" className="hidden sm:block">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/onboarding">
              <Button variant="primary" size="sm">
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg grid-bg-fade" />
        <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-b from-cyan-500/[0.04] via-transparent to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-24">
          <div className="flex flex-col items-center text-center">
            <h1 className="font-serif text-[clamp(48px,8vw,88px)] leading-[1.02] tracking-[-0.02em] text-[var(--color-fg)] max-w-4xl">
              Apply to jobs.
              <br />
              <span className="text-[var(--color-fg-subtle)] italic">Without applying.</span>
            </h1>

            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-[var(--color-fg-muted)]">
              Tell the agent what you want. It applies.
            </p>

            <div className="mt-8 w-full flex justify-center">
              <JobPrompt />
            </div>

            <div className="mt-10 flex items-center gap-3">
              <AgentTicker />
              <Link
                href="/dashboard"
                className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)] font-mono transition-colors"
              >
                or see dashboard
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* mock dashboard preview */}
          <div className="relative mt-20">
            <div className="absolute inset-x-12 -top-8 -bottom-8 rounded-3xl bg-gradient-to-b from-cyan-500/10 to-transparent blur-3xl pointer-events-none" />
            <div className="relative rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-surface-2)]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-surface-2)]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-surface-2)]" />
                <div className="ml-3 flex h-6 items-center gap-2 rounded-md bg-[var(--color-bg)] px-2.5 text-[11px] text-[var(--color-fg-subtle)] font-mono">
                  recruit.ai/dashboard
                </div>
              </div>
              <div className="grid grid-cols-1 gap-px bg-[var(--color-border)] sm:grid-cols-3">
                {[
                  { label: "Submitted", value: "128", delta: "+24" },
                  { label: "Live agents", value: "3", delta: "now" },
                  { label: "Time saved", value: "23.4h", delta: "≈14m / app" },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-[var(--color-surface)] p-5">
                    <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-mono">
                      {kpi.label}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <div className="text-3xl font-serif tracking-tight text-[var(--color-fg)]">
                        {kpi.value}
                      </div>
                      <div className="text-[11px] text-[var(--color-fg-muted)] font-mono">
                        {kpi.delta}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-px bg-[var(--color-border)] md:grid-cols-3">
                <div className="bg-[var(--color-surface)] p-5 md:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-mono">
                      Active runs
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)] font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{animation: "pulse-soft 2s ease-in-out infinite"}} />
                      3 live
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { co: "Linear", role: "Design Engineer", stage: "Submitting", color: "text-cyan-300" },
                      { co: "Vercel", role: "Product Engineer", stage: "Reviewing", color: "text-violet-300" },
                      { co: "Perplexity", role: "Senior Frontend Engineer", stage: "Tailoring", color: "text-amber-300" },
                    ].map((r) => (
                      <div key={r.co} className="flex items-center justify-between rounded-md bg-[var(--color-surface-1)] px-3 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[13px] text-[var(--color-fg)]">{r.co}</span>
                          <span className="text-[12px] text-[var(--color-fg-subtle)] truncate">{r.role}</span>
                        </div>
                        <span className={`text-[10px] uppercase tracking-wider font-mono ${r.color}`}>
                          {r.stage}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[var(--color-surface)] p-5">
                  <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-mono mb-3">
                    Memory wedge
                  </div>
                  <div className="text-3xl font-serif tracking-tight text-[var(--color-fg)]">312</div>
                  <div className="text-[11px] text-[var(--color-fg-muted)] mt-1">cached answers reused</div>
                  <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-1)]">
                    <div className="h-full w-[98.7%] bg-gradient-to-r from-cyan-500 to-emerald-400" />
                  </div>
                  <div className="mt-1.5 text-[10px] text-[var(--color-fg-subtle)] font-mono">98.7% hit rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* coverage strip */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:gap-10">
            <div className="flex items-center gap-2 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" style={{animation: "pulse-soft 2s ease-in-out infinite"}} />
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-mono">
                Sourcing roles at
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-x-1 gap-y-2">
              {trustedBy.map((co, i) => (
                <div key={co} className="flex items-center gap-1">
                  <span className="font-medium text-[15px] tracking-tight text-[var(--color-fg)]">
                    {co}
                  </span>
                  {i < trustedBy.length - 1 && (
                    <span className="ml-3 text-[var(--color-border-strong)]">·</span>
                  )}
                </div>
              ))}
            </div>
            <div className="text-[11px] font-mono text-[var(--color-fg-subtle)] shrink-0">
              + 2,400 more
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how-it-works" className="relative">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <div className="mb-16 max-w-2xl">
            <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)] font-mono">
              How it works
            </div>
            <h2 className="font-serif text-[44px] leading-[1.05] tracking-tight text-[var(--color-fg)]">
              Three steps. Then it{" "}
              <span className="text-[var(--color-fg-subtle)] italic">runs.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-xl overflow-hidden md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Tell us about you",
                body: "Resume, links, work authorization, what you want next. One-time intake — never asked twice.",
                detail: "≈ 4 minutes",
              },
              {
                num: "02",
                title: "We tailor and apply",
                body: "Agent sources Ashby roles, tailors a resume per JD, fills the form in a real browser session, and submits.",
                detail: "≈ 90 seconds / app",
              },
              {
                num: "03",
                title: "Memory compounds",
                body: "Every approved answer is cached. By application 20, the agent rarely asks you anything new.",
                detail: "98.7% cache hit rate",
              },
            ].map((step) => (
              <div key={step.num} className="bg-[var(--color-surface)] p-7">
                <div className="flex items-baseline justify-between">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                    Step {step.num}
                  </div>
                  <div className="font-mono text-[11px] text-[var(--color-accent)]">
                    {step.detail}
                  </div>
                </div>
                <h3 className="mt-6 font-serif text-[26px] leading-tight tracking-tight text-[var(--color-fg)]">
                  {step.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section id="features" className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <div className="mb-16 max-w-2xl">
            <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)] font-mono">
              Built for compounding
            </div>
            <h2 className="font-serif text-[44px] leading-[1.05] tracking-tight text-[var(--color-fg)]">
              Every application makes the
              <br />
              <span className="text-[var(--color-fg-subtle)] italic">next one</span> better.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                icon: Workflow,
                title: "Real browser, real submits",
                body: "Browserbase sessions on every run. We don't reverse-engineer APIs — we drive the actual form, deterministically.",
                metric: "96%",
                metricLabel: "Ashby success rate",
              },
              {
                icon: Database,
                title: "Answer cache that learns",
                body: "Every answered question — your sponsorship status, your essay about why your last project mattered — is reused on every future application.",
                metric: "312",
                metricLabel: "cached answers, last 7 days",
              },
              {
                icon: Layers,
                title: "Three-persona review",
                body: "Hiring Manager, Senior Engineer, and Recruiter personas review every tailored resume before submit. You see the verdict per persona.",
                metric: "92",
                metricLabel: "median tailoring score",
              },
              {
                icon: Shield,
                title: "Conservative by default",
                body: "We never guess sensitive facts. Sponsorship, start date, comp expectations — those route to your DLQ for one approval, then auto-fill forever.",
                metric: "0",
                metricLabel: "wrong work-auth answers, ever",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 transition-colors hover:border-[var(--color-border-strong)]"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <f.icon className="h-5 w-5 text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                    <h3 className="mt-5 text-[18px] font-medium tracking-tight text-[var(--color-fg)]">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-fg-muted)]">
                      {f.body}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-serif text-[44px] leading-none tracking-tight text-[var(--color-fg)]">
                      {f.metric}
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-mono max-w-[120px]">
                      {f.metricLabel}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative border-t border-[var(--color-border)]">
        <div className="absolute inset-0 grid-bg grid-bg-fade opacity-50" />
        <div className="relative mx-auto max-w-4xl px-6 py-32 text-center">
          <h2 className="font-serif text-[clamp(40px,6vw,72px)] leading-[1.05] tracking-tight text-[var(--color-fg)]">
            Stop applying.
            <br />
            <span className="text-[var(--color-fg-subtle)] italic">Start getting offers.</span>
          </h2>
          <p className="mt-6 text-[16px] text-[var(--color-fg-muted)] max-w-md mx-auto">
            Your first 5 applications are free. The agent activates the moment you finish onboarding.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Link href="/onboarding">
              <Button variant="accent" size="xl">
                Start your agent
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="ghost" size="xl">
                See pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <Wordmark />
              <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
                v0.1.0 · mockup
              </span>
            </div>
            <div className="flex items-center gap-6">
              {["Privacy", "Terms", "Security", "Contact"].map((x) => (
                <a key={x} href="#" className="text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)] transition-colors">
                  {x}
                </a>
              ))}
            </div>
          </div>
          <div className="mt-8 text-[11px] text-[var(--color-fg-subtle)] font-mono">
            © 2026 Recruit. Built for the hackathon.
          </div>
        </div>
      </footer>
    </div>
  );
}
