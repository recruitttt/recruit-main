"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/ui/logo";
import { onboardingMatches } from "@/lib/mock-data";
import { Check, Sparkles } from "lucide-react";

const phases = [
  { id: "p1", text: "Spinning up your agent", duration: 900 },
  { id: "p2", text: "Scanning Ashby for live roles", duration: 1200 },
  { id: "p3", text: "Ranking matches against your preferences", duration: 1200 },
  { id: "p4", text: "Queuing your first 5 applications", duration: 1100 },
  { id: "p5", text: "Agent is live", duration: 800 },
];

export function StepActivating() {
  const router = useRouter();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [matchesShown, setMatchesShown] = useState(0);

  useEffect(() => {
    if (phaseIndex >= phases.length) {
      const t = setTimeout(() => router.push("/dashboard"), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhaseIndex((p) => p + 1), phases[phaseIndex].duration);
    return () => clearTimeout(t);
  }, [phaseIndex, router]);

  useEffect(() => {
    if (phaseIndex < 3) return;
    if (matchesShown >= onboardingMatches.length) return;
    const t = setTimeout(() => setMatchesShown((m) => m + 1), 220);
    return () => clearTimeout(t);
  }, [phaseIndex, matchesShown]);

  const currentPhase = phases[Math.min(phaseIndex, phases.length - 1)];
  const done = phaseIndex >= phases.length;

  return (
    <div className="relative">
      {/* halo */}
      <motion.div
        className="absolute left-1/2 top-32 -translate-x-1/2 h-[400px] w-[400px] rounded-full pointer-events-none"
        animate={{
          background: [
            "radial-gradient(circle, rgba(34,211,238,0.15), transparent 60%)",
            "radial-gradient(circle, rgba(34,211,238,0.25), transparent 60%)",
            "radial-gradient(circle, rgba(34,211,238,0.15), transparent 60%)",
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* orb */}
      <div className="relative flex flex-col items-center pt-24">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border border-[var(--color-accent)]"
            animate={{ scale: [1, 1.5, 2], opacity: [0.6, 0.2, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border border-[var(--color-accent)]"
            animate={{ scale: [1, 1.5, 2], opacity: [0.6, 0.2, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
          />
          <motion.div
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-fg)]"
            animate={done ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={done ? { duration: 0.5 } : {}}
          >
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", duration: 0.6 }}
                >
                  <Check className="h-7 w-7 text-[var(--color-bg)]" strokeWidth={3} />
                </motion.div>
              ) : (
                <motion.div
                  key="spark"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-6 w-6 text-[var(--color-bg)]" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <h1 className="mt-12 font-serif text-[44px] leading-[1.05] tracking-tight text-[var(--color-fg)] text-center">
          {done ? "You're live." : "Activating your agent."}
        </h1>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPhase.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="mt-4 flex items-center gap-2 text-[14px] font-mono text-[var(--color-fg-muted)]"
          >
            {!done && (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" style={{animation: "pulse-soft 1.4s ease-in-out infinite"}} />
            )}
            <span>{currentPhase.text}</span>
            {!done && <span className="text-[var(--color-fg-subtle)]">…</span>}
          </motion.div>
        </AnimatePresence>

        {/* phase progress */}
        <div className="mt-8 flex items-center gap-1.5">
          {phases.map((p, i) => (
            <div
              key={p.id}
              className={`h-1 transition-all duration-500 rounded-full ${
                i < phaseIndex ? "w-6 bg-[var(--color-accent)]" : i === phaseIndex ? "w-10 bg-[var(--color-accent)]" : "w-6 bg-[var(--color-border)]"
              }`}
            />
          ))}
        </div>

        {/* matches found */}
        {phaseIndex >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-12 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-3 text-[11px] uppercase tracking-[0.15em] font-mono">
              <span className="text-[var(--color-fg-subtle)]">First applications queued</span>
              <span className="text-[var(--color-accent)]">{matchesShown} of 5</span>
            </div>
            <div className="space-y-1.5">
              {onboardingMatches.slice(0, matchesShown).map((m, i) => (
                <motion.div
                  key={m.company}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CompanyLogo bg={m.logoBg} text={m.logoText} size={28} className="rounded-[6px]" />
                    <div className="min-w-0">
                      <div className="text-[13px] text-[var(--color-fg)] truncate">
                        {m.company}
                      </div>
                      <div className="text-[11px] text-[var(--color-fg-subtle)] font-mono truncate">
                        {m.role}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-[12px] font-mono text-[var(--color-accent)] tabular-nums">
                      {m.matchScore}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {done && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-10 text-[13px] text-[var(--color-fg-subtle)] font-mono"
          >
            Redirecting to dashboard…
          </motion.div>
        )}
      </div>
    </div>
  );
}
