"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, FileText, Upload, Check, Sparkles } from "lucide-react";

const fakeExtracted = {
  name: "Mo Hoshir",
  headline: "Software Engineer · 4 years TypeScript / React / Postgres",
  topSkills: ["TypeScript", "Next.js", "React", "Postgres", "AWS", "Browser automation", "LLM agents"],
  highlights: [
    "Shipped Orbit, a TypeScript-first agent runtime to 1.2k weekly users",
    "Cut average task latency 47% via typed planner",
    "Open-sourced 3 Convex extensions used by 200+ projects",
  ],
};

type Phase = "drop" | "parsing" | "done";

export function StepResume({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (data: { resumeFilename: string }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("drop");
  const [filename, setFilename] = useState("");
  const [parseStep, setParseStep] = useState(0);

  const parseSteps = [
    "Extracting text from PDF…",
    "Identifying sections…",
    "Detecting skills + experience…",
    "Building canonical answer cache…",
    "Done.",
  ];

  function handleFile(name: string) {
    setFilename(name);
    setPhase("parsing");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setParseStep(i);
      if (i >= parseSteps.length - 1) {
        clearInterval(interval);
        setTimeout(() => setPhase("done"), 400);
      }
    }, 550);
  }

  return (
    <div>
      <div className="mb-10">
        <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)] font-mono">
          Step 02 · Resume
        </div>
        <h1 className="font-serif text-[44px] leading-[1.05] tracking-tight text-[var(--color-fg)]">
          Drop your resume.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-md">
          One PDF. We extract everything we can see, then verify with you in the next steps. Never asked twice.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {phase === "drop" && (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <label className="block cursor-pointer">
              <div className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] py-16 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-1)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-1)] border border-[var(--color-border)] group-hover:border-[var(--color-accent)] group-hover:bg-[var(--color-accent-soft)] transition-colors">
                  <Upload className="h-5 w-5 text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                </div>
                <div className="mt-5 text-[15px] text-[var(--color-fg)]">
                  Drop your resume PDF here
                </div>
                <div className="mt-1.5 text-[12px] text-[var(--color-fg-subtle)] font-mono">
                  or click to choose · max 5MB
                </div>
              </div>
              <input
                type="file"
                accept=".pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  handleFile(f?.name || "resume.pdf");
                }}
              />
            </label>
            <button
              onClick={() => handleFile("mo-hoshir-resume.pdf")}
              className="mt-3 w-full text-center text-[12px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)] font-mono cursor-pointer"
            >
              No resume handy? Use a sample →
            </button>
          </motion.div>
        )}

        {phase === "parsing" && (
          <motion.div
            key="parsing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border)]">
                <FileText className="h-4 w-4 text-[var(--color-accent)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] text-[var(--color-fg)] truncate">
                  {filename}
                </div>
                <div className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
                  Parsing · this stays local
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-2 font-mono text-[12px]">
              {parseSteps.slice(0, parseStep + 1).map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  {i < parseStep ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={3} />
                  ) : (
                    <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--color-accent)] border-t-transparent animate-spin" />
                  )}
                  <span className={i < parseStep ? "text-[var(--color-fg-muted)]" : "text-[var(--color-fg)]"}>
                    {s}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-muted)] font-mono">
                  Extracted
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono">
                ✓ {filename}
              </span>
            </div>
            <div className="p-5 space-y-4">
              <Row label="Name" value={fakeExtracted.name} />
              <Row label="Headline" value={fakeExtracted.headline} />
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
                  Top skills
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {fakeExtracted.topSkills.map((s) => (
                    <span
                      key={s}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-0.5 text-[12px] text-[var(--color-fg-muted)] font-mono"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
                  Cached for tailoring
                </div>
                <ul className="space-y-1.5">
                  {fakeExtracted.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-[var(--color-fg-muted)]">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          disabled={phase !== "done"}
          onClick={() => onNext({ resumeFilename: filename })}
        >
          Looks right
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 items-baseline">
      <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
        {label}
      </div>
      <div className="text-[14px] text-[var(--color-fg)]">{value}</div>
    </div>
  );
}
