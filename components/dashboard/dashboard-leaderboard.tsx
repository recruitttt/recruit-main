"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
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
  if (rows.length === 0) {
    return (
      <section className="rounded-[30px] border border-white/60 bg-white/72 p-6 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.3)] backdrop-blur-xl">
        <div className="max-w-xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ranked jobs
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            No live recommendations yet
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Start the first run and this board will fill with ranked jobs, score movement, and inspector details.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[30px] border border-white/60 bg-white/72 p-4 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.3)] backdrop-blur-xl md:p-5">
      <div className="mb-4 flex items-end justify-between gap-3 px-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ranked jobs
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            Kinetic recommendation board
          </h2>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>{rows.length} roles on the board</div>
          <div>Tap any row to inspect fit</div>
        </div>
      </div>

      <div className="hidden md:grid md:gap-3">
        {displayRows.map((row, index) => (
          <DesktopRow
            key={row.jobId}
            row={row}
            visualRank={index + 1}
            active={selectedJobId === row.jobId}
            loading={loadingJobId === row.jobId}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => {
          const active = selectedJobId === row.jobId;
          return (
            <div key={row.jobId} className="space-y-2">
              <MobileRow
                row={row}
                active={active}
                loading={loadingJobId === row.jobId}
                onSelect={onSelect}
              />
              {active ? mobileInlineDetail : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DesktopRow({
  row,
  visualRank,
  active,
  loading,
  onSelect,
}: {
  row: LeaderboardRow;
  visualRank: number;
  active: boolean;
  loading: boolean;
  onSelect: (recommendation: LiveRecommendation) => void;
}) {
  return (
    <motion.button
      layout
      type="button"
      onClick={() => onSelect(row.recommendation)}
      className={cn(
        "group relative grid w-full grid-cols-[64px_minmax(0,1fr)_110px] items-center gap-4 overflow-hidden rounded-[24px] border px-4 py-4 text-left transition",
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.45)]"
          : "border-white/70 bg-white/85 text-slate-950 hover:border-sky-200 hover:bg-white",
      )}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          visualRank <= 3 ? "bg-amber-400" : active ? "bg-sky-300" : "bg-slate-200",
        )}
      />
      <div className="relative pl-3">
        <div className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", active ? "text-white/60" : "text-slate-400")}>
          Rank
        </div>
        <div className="mt-1 text-4xl font-semibold tracking-[-0.07em] tabular-nums">
          {visualRank}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(
            "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
            active
              ? "border-white/20 bg-white/10 text-white/80"
              : "border-slate-200 bg-slate-50 text-slate-500",
          )}>
            {row.providerLabel}
          </span>
          {loading ? (
            <span className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", active ? "text-white/60" : "text-sky-600")}>
              Loading
            </span>
          ) : null}
        </div>
        <h3 className="mt-3 truncate text-lg font-semibold tracking-[-0.03em]">{row.title}</h3>
        <div className={cn("mt-1 truncate text-sm", active ? "text-white/72" : "text-slate-600")}>{row.company}</div>
        <div className={cn("mt-3 flex flex-wrap items-center gap-4 text-xs", active ? "text-white/65" : "text-slate-500")}>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {row.locationLabel}
          </span>
          <span className="truncate">{row.secondaryLine}</span>
        </div>
      </div>

      <div className="justify-self-end text-right">
        <div className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", active ? "text-white/60" : "text-slate-400")}>
          Score
        </div>
        <div className="mt-1 text-3xl font-semibold tracking-[-0.06em] tabular-nums">
          {Math.round(row.score)}
        </div>
        <div className={cn("mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em]", active ? "text-white/70" : "text-slate-500")}>
          Inspect
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </motion.button>
  );
}

function MobileRow({
  row,
  active,
  loading,
  onSelect,
}: {
  row: LeaderboardRow;
  active: boolean;
  loading: boolean;
  onSelect: (recommendation: LiveRecommendation) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.recommendation)}
      className={cn(
        "w-full rounded-[24px] border px-4 py-4 text-left transition",
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.45)]"
          : "border-white/70 bg-white/85 text-slate-950",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div>
            <div className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", active ? "text-white/60" : "text-slate-400")}>
              Rank
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-[-0.06em] tabular-nums">{row.rank}</div>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                active
                  ? "border-white/20 bg-white/10 text-white/80"
                  : "border-slate-200 bg-slate-50 text-slate-500",
              )}>
                {row.providerLabel}
              </span>
              {loading ? (
                <span className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", active ? "text-white/60" : "text-sky-600")}>
                  Loading
                </span>
              ) : null}
            </div>
            <h3 className="mt-3 text-base font-semibold tracking-[-0.03em]">{row.title}</h3>
            <div className={cn("mt-1 text-sm", active ? "text-white/72" : "text-slate-600")}>{row.company}</div>
            <div className={cn("mt-3 flex items-center gap-1.5 text-xs", active ? "text-white/65" : "text-slate-500")}>
              <MapPin className="h-3.5 w-3.5" />
              {row.locationLabel}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", active ? "text-white/60" : "text-slate-400")}>
            Score
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-[-0.06em] tabular-nums">{Math.round(row.score)}</div>
        </div>
      </div>

      <div className={cn("mt-3 text-xs", active ? "text-white/68" : "text-slate-500")}>
        {row.secondaryLine}
      </div>
    </button>
  );
}
