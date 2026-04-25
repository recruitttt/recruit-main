"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Wordmark } from "@/components/ui/logo";
import { StepProgress } from "@/components/onboarding/progress";
import { StepAccount } from "@/components/onboarding/step-account";
import { StepResume } from "@/components/onboarding/step-resume";
import { StepLinks } from "@/components/onboarding/step-links";
import { StepQuestionnaire } from "@/components/onboarding/step-questionnaire";
import { StepActivating } from "@/components/onboarding/step-activating";

const steps = [
  { label: "Account" },
  { label: "Resume" },
  { label: "Links" },
  { label: "Preferences" },
  { label: "Activate" },
];

type State = {
  account: { name?: string; email?: string };
  resume: { resumeFilename?: string };
  links: Record<string, string>;
  prefs: Record<string, string[]>;
};

const initial: State = {
  account: {},
  resume: {},
  links: {},
  prefs: {},
};

const STORAGE_KEY = "recruit:onboarding";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<State>(initial);

  // hydrate from localStorage once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
    } catch {}
  }, []);

  // persist on every state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6">
      {/* top bar */}
      <header className="flex items-center justify-between py-6">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="text-[11px] font-mono text-[var(--color-fg-subtle)]">
          {step < steps.length - 1 ? `Step ${step + 1} of ${steps.length}` : "Last step"}
        </div>
      </header>

      {/* progress */}
      {step < steps.length - 1 && (
        <div className="py-4">
          <StepProgress current={step} steps={steps} />
        </div>
      )}

      {/* content */}
      <main className="flex-1 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {step === 0 && (
              <StepAccount
                defaults={state.account}
                onNext={(d) => {
                  setState((s) => ({ ...s, account: d }));
                  setStep(1);
                }}
              />
            )}
            {step === 1 && (
              <StepResume
                onBack={() => setStep(0)}
                onNext={(d) => {
                  setState((s) => ({ ...s, resume: d }));
                  setStep(2);
                }}
              />
            )}
            {step === 2 && (
              <StepLinks
                defaults={state.links}
                onBack={() => setStep(1)}
                onNext={(d) => {
                  setState((s) => ({ ...s, links: d }));
                  setStep(3);
                }}
              />
            )}
            {step === 3 && (
              <StepQuestionnaire
                defaults={state.prefs}
                onBack={() => setStep(2)}
                onNext={(d) => {
                  setState((s) => ({ ...s, prefs: d }));
                  setStep(4);
                }}
              />
            )}
            {step === 4 && <StepActivating />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="py-6 text-center text-[11px] text-[var(--color-fg-subtle)] font-mono">
        Your data stays on this device until you launch the agent.
      </footer>
    </div>
  );
}
