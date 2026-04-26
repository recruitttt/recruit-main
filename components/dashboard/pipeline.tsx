"use client";

import { motion, useReducedMotion } from "motion/react";
import { mockApplications, stageOrder, stageLabels, type Stage } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion-presets";

const stageColors: Record<Stage, string> = {
  queued: "bg-zinc-400",
  tailoring: "bg-amber-500",
  reviewing: "bg-violet-500",
  submitting: "bg-[var(--color-accent)]",
  submitted: "bg-emerald-500",
  blocked: "bg-red-500",
};

export function Pipeline() {
  const reduceMotion = useReducedMotion();
  const counts = stageOrder.reduce<Record<Stage, number>>(
    (acc, s) => {
      acc[s] = mockApplications.filter((a) => a.stage === s).length;
      return acc;
    },
    { queued: 0, tailoring: 0, reviewing: 0, submitting: 0, submitted: 0, blocked: 0 }
  );

  const total = stageOrder.reduce((s, st) => s + counts[st], 0);

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={fadeUp}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
          Pipeline
        </h3>
        <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
          {total} active
        </span>
      </div>

      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
        {stageOrder.map((s) => {
          const w = total > 0 ? (counts[s] / total) * 100 : 0;
          if (w === 0) return null;
          if (reduceMotion) {
            return (
              <div
                key={s}
                className={cn("h-full transition-all", stageColors[s])}
                style={{ width: `${w}%` }}
              />
            );
          }
          return (
            <motion.div
              key={s}
              initial={{ width: 0 }}
              animate={{ width: `${w}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className={cn("h-full", stageColors[s])}
            />
          );
        })}
      </div>

      <motion.div
        variants={staggerContainer(0.06)}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="mt-4 grid grid-cols-5 gap-2"
      >
        {stageOrder.map((s) => (
          <motion.div key={s} variants={reduceMotion ? undefined : staggerItem}>
            <div className="flex items-center gap-1.5">
              <div className={cn("h-1.5 w-1.5 rounded-full", stageColors[s])} />
              <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-[var(--color-fg-subtle)]">
                {stageLabels[s]}
              </div>
            </div>
            <div className="mt-1 text-[18px] font-serif tracking-tight text-[var(--color-fg)] tabular-nums">
              {counts[s]}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
