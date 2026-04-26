"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type DashboardScoreCoreProps = {
  score: number;
  rank: number;
  tailoringScore?: number;
  keywordCoverage?: number;
};

export function DashboardScoreCore({
  score,
  rank,
  tailoringScore,
  keywordCoverage,
}: DashboardScoreCoreProps) {
  const reduceMotion = useReducedMotion();
  const ringDegrees = Math.max(0, Math.min(100, Math.round(score))) * 3.6;
  const orbitTransition = reduceMotion
    ? { duration: 0 }
    : {
        duration: 14,
        ease: "linear" as const,
        repeat: Number.POSITIVE_INFINITY,
      };

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-[radial-gradient(circle_at_top,#f8fbff,white_58%,#f5efe3_100%)] p-5 shadow-[0_30px_80px_-46px_rgba(15,23,42,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(63,122,86,0.12),transparent_38%,rgba(251,191,36,0.12))]" />
      <motion.div
        aria-hidden
        className="absolute -right-8 top-4 h-28 w-28 rounded-full border border-[var(--color-border)]"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={orbitTransition}
      />
      <motion.div
        aria-hidden
        className="absolute -left-6 bottom-0 h-20 w-20 rounded-full border border-amber-200/60"
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={orbitTransition}
      />

      <div className="relative grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
        <div className="flex justify-center lg:justify-start">
          <motion.div
            key={score}
            initial={reduceMotion ? false : { scale: 0.96, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative grid h-44 w-44 place-items-center rounded-full border border-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_28px_40px_-28px_rgba(15,23,42,0.32)]"
            style={{
              background: `conic-gradient(from 220deg, #0f172a 0deg ${ringDegrees}deg, rgba(15,23,42,0.09) ${ringDegrees}deg 360deg)`,
            }}
          >
            <div className="absolute inset-[12px] rounded-full bg-[radial-gradient(circle_at_top,white_0%,#f8fafc_62%,#eef2ff_100%)]" />
            <div className="relative text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Overall fit
              </div>
              <div className="mt-2 text-5xl font-semibold tracking-[-0.06em] text-slate-950">
                {Math.round(score)}
              </div>
              <div className="mt-1 text-xs text-slate-500">out of 100</div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Why this role surfaced
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              Ranked #{rank}
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              The board score blends the saved recommendation score with any persisted tailoring evidence for the selected job.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Leaderboard"
              value={`#${rank}`}
              accent="bg-slate-950"
            />
            <MetricCard
              label="Tailoring"
              value={tailoringScore == null ? "Not run" : `${Math.round(tailoringScore)}`}
              accent="bg-[var(--color-accent)]"
            />
            <MetricCard
              label="Coverage"
              value={keywordCoverage == null ? "Pending" : `${Math.round(keywordCoverage)}%`}
              accent="bg-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/75 bg-white/85 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        <span className={cn("h-2 w-2 rounded-full", accent)} />
        {label}
      </div>
      <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-950">
        {value}
      </div>
    </div>
  );
}
