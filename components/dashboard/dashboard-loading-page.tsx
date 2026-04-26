"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Radio, Sparkles } from "lucide-react";
import {
  DashboardLoadingGlobe,
  type DashboardLoadingPhase,
} from "@/components/dashboard/dashboard-loading-globe";
import {
  AnimatedNumber,
  AnimatedProgressBar,
} from "@/components/dashboard/metric-animation";
import { markDashboardLoadingSeen } from "@/components/dashboard/dashboard-entry-gate";
import { StarClusterField } from "@/components/visual/star-cluster-field";
import { ThemeParticleFall } from "@/components/visual/theme-particle-fall";
import { cn } from "@/lib/utils";
import type { LiveDashboardPayload } from "./dashboard-types";

const MINIMUM_LOADING_MS = 5400;

const STAGES = [
  {
    phase: "loading",
    label: "loading jobs...",
    detail: "Fetching sources and normalizing role metadata.",
    progress: 28,
  },
  {
    phase: "scoring",
    label: "scoring jobs...",
    detail: "Reading fit signals across each company and role.",
    progress: 64,
  },
  {
    phase: "ranking",
    label: "settling rankings...",
    detail: "Animating the shortlist into its final board order.",
    progress: 88,
  },
] satisfies Array<{
  phase: DashboardLoadingPhase;
  label: string;
  detail: string;
  progress: number;
}>;

export function DashboardLoadingPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const [payload, setPayload] = useState<LiveDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stage = STAGES[stageIndex] ?? STAGES[0];

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
    }, 2100);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setProgress((current) => Math.min(current + 2, stage.progress));
    }, 260);
    return () => window.clearInterval(id);
  }, [reduceMotion, stage.progress]);

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    const startedAt = Date.now();

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard/live", { cache: "no-store" });
        if (!response.ok) throw new Error(`dashboard_live_${response.status}`);
        const nextPayload = (await response.json()) as LiveDashboardPayload;
        if (cancelled) return;
        setPayload(nextPayload);
        setProgress(96);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : String(nextError));
        setProgress(92);
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(1200, MINIMUM_LOADING_MS - elapsed);
        timeout = window.setTimeout(() => {
          if (cancelled) return;
          setProgress(100);
          markDashboardLoadingSeen();
          router.replace("/dashboard");
        }, remaining);
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [router]);

  const stats = useMemo(() => {
    const run = payload?.run;
    return [
      {
        label: "Sources",
        value: run?.fetchedCount ?? 7,
        suffix: `/${run?.sourceCount ?? 7}`,
        detail: "ready",
      },
      {
        label: "Jobs",
        value: run?.rawJobCount ?? 1240,
        detail: "captured",
      },
      {
        label: "Ranked",
        value: run?.recommendedCount ?? payload?.recommendations.length ?? 100,
        detail: "on board",
      },
    ];
  }, [payload]);

  return (
    <main className="relative isolate min-h-[calc(100dvh-72px)] overflow-hidden bg-[var(--dashboard-bg)] px-4 py-6 text-[var(--color-fg)] [background-image:var(--dashboard-bg-gradient)] md:px-7 md:py-10">
      <LoadingAtmosphere reduceMotion={Boolean(reduceMotion)} />

      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-140px)] w-full max-w-6xl content-center gap-6">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.82, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dashboard-kicker)]">
              <Radio className="h-3.5 w-3.5 text-[var(--dashboard-kicker-icon)]" />
              Dashboard launch
            </div>
            <h1 className="mt-3 text-4xl font-semibold text-[var(--dashboard-header-fg)] md:text-5xl">
              Preparing applications
            </h1>
          </div>
          <div className="inline-flex max-w-fit items-center gap-2 rounded-full border border-[var(--dashboard-card-border)] bg-[var(--dashboard-control-bg)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-panel-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            {stage.label}
          </div>
        </motion.div>

        <DashboardLoadingGlobe phase={stage.phase} size="hero" />

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.82, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]"
        >
          <div className="rounded-[20px] border border-[var(--dashboard-panel-border)] bg-[var(--dashboard-panel-bg)] p-4 shadow-[var(--dashboard-panel-shadow)] backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dashboard-panel-kicker)]">
                  {stage.label}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--dashboard-panel-muted)]">
                  {error ? "Dashboard data is taking longer than expected. Opening the board now." : stage.detail}
                </p>
              </div>
              <div className="text-2xl font-semibold tabular-nums text-[var(--dashboard-panel-fg)]">
                <AnimatedNumber value={progress} format={(value) => `${Math.round(value)}%`} />
              </div>
            </div>
            <AnimatedProgressBar value={progress} className="mt-4" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "rounded-[18px] border border-[var(--dashboard-card-border)] bg-[var(--dashboard-card-bg)] px-3 py-3 shadow-[var(--dashboard-card-shadow)]",
                  "min-w-0",
                )}
              >
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dashboard-panel-kicker)]">
                  {stat.label}
                </div>
                <div className="mt-2 text-xl font-semibold tabular-nums text-[var(--dashboard-panel-fg)]">
                  <AnimatedNumber value={stat.value} />
                  {stat.suffix ? <span>{stat.suffix}</span> : null}
                </div>
                <div className="mt-1 truncate text-xs text-[var(--dashboard-panel-subtle)]">
                  {stat.detail}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function LoadingAtmosphere({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
