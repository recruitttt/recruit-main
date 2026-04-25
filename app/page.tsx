"use client";

import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "@/components/ui/logo";
import { JobPrompt } from "@/components/landing/job-prompt";
import { AgentPipeline } from "@/components/landing/agent-pipeline";
import { HeroBg } from "@/components/landing/hero-bg";
import { ArrowRight, Bot, CheckCircle2, Gauge } from "lucide-react";
import { GlassCard, StatusBadge, cx, mistClasses, mistColors } from "@/components/design-system";

export default function LandingPage() {
  const [logoRevealed, setLogoRevealed] = useState(false);

  return (
    <main className={cx("relative flex min-h-screen flex-col overflow-hidden", mistClasses.page)}>
      <HeroBg />

      <header className="fixed inset-x-0 top-0 z-30 px-4 pt-4 md:px-6">
        <div className={cx("mx-auto flex min-h-14 max-w-[1500px] items-center gap-2 border px-2 py-2 md:gap-3 md:px-3", mistClasses.panel)}>
          <Link
            href="/"
            aria-label="Recruit"
            className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/60 bg-white/44 px-2.5 pr-3 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_10px_28px_rgba(15,23,42,0.06)] transition duration-[240ms] ease-out hover:bg-white/58"
            style={{ opacity: logoRevealed ? 1 : 0 }}
          >
            <Wordmark size="lg" />
          </Link>

          <nav className="no-scrollbar hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full border border-white/45 bg-white/24 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:flex">
            <Link href="/pricing" className="rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white/34 hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/dashboard" className="rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white/34 hover:text-slate-900">
              Dashboard
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden h-10 items-center justify-center rounded-full border border-white/55 bg-white/24 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white/42 sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-950 bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 flex flex-1 items-center justify-center px-5 pb-10 pt-28 md:px-6 md:pb-12 md:pt-32">
        <div className="mx-auto grid w-full max-w-[1520px] gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-8 flex w-full justify-center lg:justify-start">
              <AgentPipeline onComplete={() => setLogoRevealed(true)} />
            </div>

            <div className="mb-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              <StatusBadge tone="active">5 agents</StatusBadge>
              <StatusBadge tone="success">glass command center</StatusBadge>
              <StatusBadge tone="neutral">human gates</StatusBadge>
            </div>

            <h1 className="max-w-5xl text-[clamp(46px,8vw,100px)] font-semibold leading-[0.96] tracking-[-0.04em] text-slate-950">
              Apply to jobs.
              <br />
              <span className="text-slate-500">Without applying.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Tell Recruit what you want once. The agent pipeline finds roles, tailors the resume, handles provider forms, and stops where your approval matters.
            </p>

            <div className="mt-9 flex w-full justify-center lg:justify-start">
              <JobPrompt />
            </div>
          </div>

          <GlassCard className="hidden lg:block">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={mistClasses.sectionLabel}>Live Run Preview</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Ready queue</div>
              </div>
              <StatusBadge tone="active" variant="solid">live</StatusBadge>
            </div>
            <div className="mt-6 space-y-3">
              {[
                { icon: Bot, label: "Agents online", value: "5 / 5", tone: mistColors.accent },
                { icon: Gauge, label: "Provider coverage", value: "Ashby + Greenhouse", tone: mistColors.success },
                { icon: CheckCircle2, label: "Approval policy", value: "Submit gate on", tone: mistColors.warning },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-[18px] border border-white/45 bg-white/28 px-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-white/60 bg-white/42" style={{ color: item.tone }}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                    <div className="truncate text-xs text-slate-500">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      <footer className="relative z-10 px-5 pb-5 md:px-6">
        <div className={cx("mx-auto flex max-w-[1500px] flex-col gap-3 border px-4 py-4 sm:flex-row sm:items-center sm:justify-between", mistClasses.panel)}>
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="font-mono text-[11px] text-slate-500">
              v0.1.0
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/pricing" className="text-[12px] text-slate-500 transition-colors hover:text-slate-800">
              Pricing
            </Link>
            <a href="#" className="text-[12px] text-slate-500 transition-colors hover:text-slate-800">
              Privacy
            </a>
            <a href="#" className="text-[12px] text-slate-500 transition-colors hover:text-slate-800">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
