"use client";

import { motion, useReducedMotion } from "motion/react";
import { mockKPIs } from "@/lib/mock-data";
import { fadeUp, staggerContainer } from "@/lib/motion-presets";

export function KPIStrip() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={staggerContainer(0.07)}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="grid grid-cols-2 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden md:grid-cols-3 lg:grid-cols-6"
    >
      {mockKPIs.map((kpi) => (
        <motion.div
          key={kpi.label}
          variants={reduceMotion ? undefined : fadeUp}
          className="bg-[var(--color-surface)] p-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
              {kpi.label}
            </div>
            {kpi.hint && (
              <div className="text-[10px] text-[var(--color-fg-subtle)] font-mono">
                {kpi.hint}
              </div>
            )}
          </div>
          <div className="mt-3 text-[28px] font-serif tracking-tight text-[var(--color-fg)] leading-none tabular-nums">
            {kpi.value}
          </div>
          {kpi.delta && (
            <div className="mt-2 text-[11px] text-[var(--color-fg-muted)] font-mono">
              {kpi.delta}
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
