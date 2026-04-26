"use client";

import { motion, useReducedMotion } from "motion/react";
import { mockProviderCoverage } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion-presets";

const statusStyles = {
  live: "border-emerald-500/40 bg-emerald-500/10",
  preview: "border-amber-500/40 bg-amber-500/10",
  "coming-soon": "border-[var(--color-border)] bg-[var(--color-surface-1)] opacity-70",
};

const statusLabels = {
  live: "Live",
  preview: "Preview",
  "coming-soon": "Soon",
};

const statusColor = {
  live: "text-emerald-700",
  preview: "text-amber-700",
  "coming-soon": "text-[var(--color-fg-subtle)]",
};

export function ProviderCoverage() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={fadeUp}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
          Provider coverage
        </h3>
        <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
          1 of 4 live
        </span>
      </div>
      <motion.div
        variants={staggerContainer(0.06)}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        className="grid grid-cols-2 gap-2"
      >
        {mockProviderCoverage.map((p) => (
          <motion.div
            key={p.name}
            variants={reduceMotion ? undefined : staggerItem}
            className={cn(
              "rounded-md border px-3 py-2.5",
              statusStyles[p.status]
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-medium text-[var(--color-fg)]">
                {p.name}
              </div>
              <div className={cn("text-[10px] uppercase tracking-[0.12em] font-mono", statusColor[p.status])}>
                {p.status === "live" ? (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                      style={reduceMotion ? undefined : { animation: "pulse-soft 2s ease-in-out infinite" }}
                    />
                    {statusLabels[p.status]}
                  </span>
                ) : (
                  statusLabels[p.status]
                )}
              </div>
            </div>
            {p.successRate !== undefined && (
              <div className="mt-1 text-[10px] font-mono text-[var(--color-fg-muted)]">
                {p.successRate}% success
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
