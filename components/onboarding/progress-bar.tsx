"use client";

import { motion } from "motion/react";
import { ChevronLeft, Clock3 } from "lucide-react";
import { ActionButton } from "@/components/design-system";
import { STEP_LABEL, type Step } from "@/app/onboarding/_data";

export function ProgressBar({
  stepIndex,
  totalSteps,
  currentStep,
  canGoBack,
  onBack,
}: {
  stepIndex: number;
  totalSteps: number;
  currentStep: Step;
  canGoBack: boolean;
  onBack: () => void;
}) {
  const stepNumber = stepIndex + 1;
  const progress = Math.max(
    0,
    Math.min(1, stepIndex / Math.max(1, totalSteps - 1)),
  );

  return (
    <div className="flex items-center gap-3 border-t border-white/40 px-5 py-2.5 md:px-8">
      <ActionButton
        variant="ghost"
        size="icon"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Go back to the previous step"
        title={canGoBack ? "Go back" : "Already at the first step"}
      >
        <ChevronLeft className="h-4 w-4" />
      </ActionButton>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Step {stepNumber} of {totalSteps}
        </span>
        <span className="hidden truncate text-[12px] font-medium text-slate-700 sm:inline">
          {STEP_LABEL[currentStep]}
        </span>
        <div
          className="relative ml-2 hidden h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/55 sm:block"
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-sky-500/80"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/55 bg-white/45 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500"
        title="Approximate time remaining"
      >
        <Clock3 className="h-3 w-3" />
        ~3 min
      </span>
    </div>
  );
}
