"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion-presets";
import type { LeaderboardRow, LiveRecommendation } from "./dashboard-types";

type DashboardLeaderboardProps = {
  rows: LeaderboardRow[];
  displayRows: LeaderboardRow[];
  selectedJobId?: string | null;
  loadingJobId?: string | null;
  mobileInlineDetail?: ReactNode;
  onSelect: (recommendation: LiveRecommendation) => void;
};

export function DashboardLeaderboard({
  rows,
  displayRows,
  selectedJobId,
  loadingJobId,
  mobileInlineDetail,
  onSelect,
}: DashboardLeaderboardProps) {
  const reduceMotion = useReducedMotion();

  if (rows.length === 0) {
    return (
      <motion.section
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={fadeUp}
        className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[0_20px_50px_-42px_rgba(16,32,22,0.28)]"
      >
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
            No applications yet
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-fg-muted)]">
            Start a search and the dashboard will fill with a simple list of jobs in motion.
          </p>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={fadeUp}
      className="overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_50px_-42px_rgba(16,32,22,0.28)]"
    >
      <div className="flex flex-col gap-2 border-b border-[var(--color-border)] px-5 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--color-fg)]">
            Applications
          </h2>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Randomized for now. Fit ranking can take over once backend signals are useful.
          </p>
        </div>
        <div className="text-sm text-[var(--color-fg-muted)]">
          {rows.length} {rows.length === 1 ? "role" : "roles"}
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(160px,0.9fr)_minmax(220px,1.25fr)_minmax(150px,0.75fr)_126px_88px] border-b border-[var(--color-border)] bg-[var(--color-surface-1)] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-subtle)] md:grid">
        <div>Company</div>
        <div>Role</div>
        <div>Location</div>
        <div>Status</div>
        <div className="text-right">Action</div>
      </div>

      <motion.div
        variants={staggerContainer(0.07)}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="divide-y divide-[var(--color-border)]"
      >
        <AnimatePresence initial={false}>
          {displayRows.map((row) => {
            const active = selectedJobId === row.jobId;
            const loading = loadingJobId === row.jobId;
            return (
              <motion.div
                key={row.jobId}
                layout={!reduceMotion}
                variants={reduceMotion ? undefined : staggerItem}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(row.recommendation)}
                  className={cn(
                    "grid w-full gap-3 border-l-4 px-5 py-4 text-left transition md:grid-cols-[minmax(160px,0.9fr)_minmax(220px,1.25fr)_minmax(150px,0.75fr)_126px_88px] md:items-center",
                    active
                      ? "border-l-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-fg)]"
                      : "border-l-transparent bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-1)]",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--color-fg)]">
                      {row.company}
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-fg-subtle)] md:hidden">
                      {row.providerLabel}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{row.title}</div>
                    <div className="mt-1 truncate text-xs text-[var(--color-fg-subtle)]">
                      {row.secondaryLine}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)]">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{row.locationLabel}</span>
                  </div>

                  <div>
                    <span className={statusClasses(row.statusTone, active)}>
                      {loading ? "Loading" : row.statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm font-semibold text-[var(--color-accent)] md:justify-end">
                    <span className="md:hidden">{row.actionLabel}</span>
                    <span className="hidden md:inline">{row.actionLabel}</span>
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </button>
                {active && mobileInlineDetail ? (
                  <div className="bg-[var(--color-surface-1)] px-3 py-3 md:hidden">{mobileInlineDetail}</div>
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}

function statusClasses(tone: LeaderboardRow["statusTone"], active: boolean) {
  if (active) {
    return "inline-flex min-h-7 items-center rounded-full border border-[var(--color-accent)] bg-[var(--color-surface)] px-2.5 text-xs font-semibold text-[var(--color-accent)]";
  }

  const toneClass = {
    neutral: "border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)]",
    active: "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
    success: "border-[var(--color-success)] bg-[var(--color-accent-soft)] text-[var(--color-success)]",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  }[tone];

  return cn("inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold", toneClass);
}
