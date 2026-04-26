"use client";

import type * as React from "react";
import { motion } from "motion/react";
import { AgentCharacter } from "@/components/onboarding/characters";

export function ScoutMessage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      <div className="flex w-8 shrink-0 justify-center">
        <AgentCharacter id="scout" awake size={38} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 text-[13px] font-medium tracking-tight text-sky-700">
          Scout
        </div>
        <div className="text-[15px] leading-snug text-slate-950">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
