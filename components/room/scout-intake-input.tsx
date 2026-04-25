"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playSend } from "@/lib/sounds";
import { useRoomStore } from "./room-store";

const PLACEHOLDERS = [
  "Your dream job…",
  "Just the dream, or anything for now?",
  "Remote? Minimum pay? Where?",
];

export function ScoutIntakeInput() {
  const intakePhase = useRoomStore((s) => s.intakePhase);
  const intakeStep = useRoomStore((s) => s.intakeStep);
  const submitIntakeAnswer = useRoomStore((s) => s.submitIntakeAnswer);
  const visible = intakePhase === "questioning";

  return (
    <AnimatePresence>
      {visible ? (
        <IntakeInput
          key={intakeStep}
          step={intakeStep}
          onSubmit={(v) => {
            playSend();
            submitIntakeAnswer(v);
          }}
        />
      ) : null}
    </AnimatePresence>
  );
}

function IntakeInput({
  step,
  onSubmit,
}: {
  step: number;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, []);

  const trimmed = value.trim();
  const disabled = trimmed.length === 0;

  return (
    <motion.form
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        onSubmit(trimmed);
        setValue("");
      }}
      className="pointer-events-auto absolute bottom-6 left-1/2 z-20 flex w-[min(560px,calc(100%-32px))] -translate-x-1/2 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-2 shadow-[0_24px_48px_-24px_rgba(15,15,18,0.35)] backdrop-blur-md"
    >
      <div className="pl-3 pr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        {step + 1} / 3
      </div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={PLACEHOLDERS[step] ?? ""}
        className="flex-1 bg-transparent px-2 py-2 text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none"
        autoComplete="off"
      />
      <Button
        type="submit"
        variant="accent"
        size="md"
        disabled={disabled}
      >
        Send <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </motion.form>
  );
}
