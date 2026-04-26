"use client";

import type * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { fadeUp } from "@/lib/motion-presets";
import { mistClasses } from "./mist-tokens";
import { cx } from "./utils";

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variantKey?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      variants={fadeUp}
      initial={reduce ? false : "hidden"}
      animate="visible"
      className={cx("min-w-0 border p-5", mistClasses.panel, className)}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className={mistClasses.sectionLabel}>{title}</div>
          {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </motion.section>
  );
}
