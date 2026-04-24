"use client";

import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { JobPrompt } from "@/components/landing/job-prompt";
import { AgentPipeline } from "@/components/landing/agent-pipeline";
import { HeroBg } from "@/components/landing/hero-bg";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  const [logoRevealed, setLogoRevealed] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--color-bg)]">
      {/* nav — seamless, no border, sits on top of the hero */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-20 max-w-6xl items-center px-6">
          <Link
            href="/"
            aria-label="Recruit"
            className="transition-opacity duration-[240ms] ease-out"
            style={{ opacity: logoRevealed ? 1 : 0 }}
          >
            <Wordmark size="lg" />
          </Link>
          <nav className="ml-12 hidden items-center gap-7 md:flex">
            <Link href="/pricing" className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
              Pricing
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
      <section className="relative flex flex-1 items-center justify-center overflow-hidden">
        <HeroBg />

        <div className="relative mx-auto w-full max-w-6xl px-6 pt-36 pb-24 md:pt-44 md:pb-32">
          <div className="flex flex-col items-center text-center">
            <div className="mb-10 w-full flex justify-center">
              <AgentPipeline onComplete={() => setLogoRevealed(true)} />
            </div>

            <h1 className="font-serif text-[clamp(48px,8vw,88px)] leading-[1.02] tracking-[-0.02em] text-[var(--color-fg)] max-w-4xl">
              Apply to jobs.
              <br />
              <span className="text-[var(--color-fg-subtle)] italic">Without applying.</span>
            </h1>

            <div className="mt-10 w-full flex justify-center">
              <JobPrompt />
            </div>
          </div>
        </div>
      </section>

      {/* minimal footer */}
      <footer className="relative z-10 border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
              v0.1.0
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/pricing" className="text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)] transition-colors">
              Pricing
            </Link>
            <a href="#" className="text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)] transition-colors">
              Privacy
            </a>
            <a href="#" className="text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)] transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
