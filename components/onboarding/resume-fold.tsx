"use client";

//
// Resume drop-fold reveal — plays the moment a resume file is dropped on
// the upload control. A paper icon folds 180°, then 4 fact-chip placeholders
// arc rightward toward the sidebar profile card. Real extracted fields land
// later via the live profile-growth machinery and animate in there.
//
// Pure visual feedback — does not block the upload pipeline. Replaces the
// FileUploadControl during `parsingResume === true`, then auto-fades.
//

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FileText } from "lucide-react";
import { cx, mistRadii } from "@/components/design-system";
import { AgentCharacter } from "@/components/onboarding/characters";
import { AGENTS } from "@/lib/agents";

interface ResumeFoldProps {
  filename?: string;
}

const CHIP_DRAFT: Array<{ key: string; label: string; sublabel?: string }> = [
  { key: "identity", label: "Identity", sublabel: "name + email" },
  { key: "experience", label: "Experience", sublabel: "roles + dates" },
  { key: "education", label: "Education", sublabel: "schools + degrees" },
  { key: "skills", label: "Skills", sublabel: "tech + tools" },
];

export function ResumeFold({ filename }: ResumeFoldProps) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"fold" | "chips" | "fly">("fold");
  const mimi = AGENTS.mimi.hue;

  useEffect(() => {
    if (reduce) {
      // Reduced-motion: skip the cascade and start in the resting state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("fly");
      return;
    }
    const id1 = window.setTimeout(() => setPhase("chips"), 480);
    const id2 = window.setTimeout(() => setPhase("fly"), 1100);
    return () => {
      window.clearTimeout(id1);
      window.clearTimeout(id2);
    };
  }, [reduce]);

  return (
    <div
      className={cx(
        "relative flex min-h-[140px] items-center gap-4 overflow-hidden border border-[var(--glass-border)] bg-[var(--theme-compat-bg-soft)] px-4 py-4",
        mistRadii.nested,
      )}
      role="status"
      aria-live="polite"
      aria-label={
        filename
          ? `Reading resume ${filename}`
          : "Reading your resume"
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 100% at 18% 50%, ${mimi}1c, transparent 65%)`,
        }}
      />

      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <motion.div
          initial={reduce ? false : { rotateY: 0, scale: 1 }}
          animate={
            reduce
              ? { rotateY: 180, scale: 0.9 }
              : { rotateY: phase === "fold" ? 0 : 180, scale: phase === "fold" ? 1 : 0.85 }
          }
          transition={{ duration: reduce ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative flex h-14 w-12 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--theme-compat-bg-strong)] shadow-[var(--theme-control-shadow)]"
        >
          <FileText className="h-6 w-6" style={{ color: mimi }} />
        </motion.div>
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: phase !== "fold" ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.4 }}
          className="absolute -bottom-1 -right-1"
        >
          <AgentCharacter id="mimi" awake size={28} />
        </motion.div>
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
          Mimi · reading
        </div>
        <div className="mt-0.5 truncate text-[14px] font-semibold text-[var(--color-fg)]">
          {filename ?? "Your resume"}
        </div>
        <p className="mt-1 text-[12px] leading-5 text-[var(--color-fg-muted)]">
          Pulling identity, experience, education, and skills.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {CHIP_DRAFT.map((chip, i) => (
            <motion.span
              key={chip.key}
              initial={reduce ? false : { opacity: 0, x: -6, scale: 0.9 }}
              animate={
                phase === "fold"
                  ? { opacity: 0, x: -6, scale: 0.9 }
                  : phase === "chips"
                    ? { opacity: 1, x: 0, scale: 1 }
                    : reduce
                      ? { opacity: 0.6, x: 0, scale: 1 }
                      : { opacity: [1, 1, 0], x: [0, 80, 140], scale: [1, 0.95, 0.85] }
              }
              transition={{
                delay: reduce ? 0 : phase === "chips" ? i * 0.08 : i * 0.06,
                duration: reduce ? 0 : phase === "fly" ? 0.85 : 0.32,
                ease: [0.22, 1, 0.36, 1],
                times: phase === "fly" ? [0, 0.55, 1] : undefined,
              }}
              className={cx(
                "inline-flex items-center gap-1 border px-2 py-0.5 text-[11px]",
                mistRadii.control,
              )}
              style={{
                borderColor: `${mimi}55`,
                backgroundColor: `${mimi}10`,
                color: mimi,
              }}
            >
              <span>{chip.label}</span>
              {chip.sublabel && (
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] opacity-70">
                  {chip.sublabel}
                </span>
              )}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
