"use client";

import { motion } from "motion/react";
import {
  GlassCard,
  cx,
  mistClasses,
  mistRadii,
} from "@/components/design-system";
import { CompanyLogo } from "@/components/ui/logo";
import { AgentCharacter } from "@/components/onboarding/characters";
import { onboardingMatches } from "@/lib/mock-data";

export function ActivationReveal() {
  const match = onboardingMatches[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pl-11"
    >
      <GlassCard variant="selected" density="normal">
        <div className="mb-3 flex items-center justify-between">
          <div className={cx(mistClasses.sectionLabel, "text-sky-600")}>
            Starting application
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }}
            />
            LIVE
          </span>
        </div>
        <div
          className={cx(
            "flex items-center gap-3 border border-white/55 bg-white/30 px-3 py-2",
            mistRadii.nested,
          )}
        >
          <AgentCharacter id="scout" awake size={30} />
          <span className="w-[54px] text-[13px] font-medium text-slate-900">
            Scout
          </span>
          <span className="text-slate-400">→</span>
          <div className="flex min-w-0 items-center gap-2">
            <CompanyLogo
              bg={match.logoBg}
              text={match.logoText}
              size={22}
              className="rounded-[5px]"
            />
            <span className="text-[13px] text-slate-900">{match.company}</span>
            <span className="truncate text-[12px] text-slate-500">
              {match.role}
            </span>
          </div>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-sky-600">
            applying
          </span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
