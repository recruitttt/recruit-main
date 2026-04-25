"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomStore } from "./room-store";

export function ScoutIntakeInput() {
  const intakePhase = useRoomStore((s) => s.intakePhase);
  const pending = useRoomStore((s) => s.intakePending);
  const messageCount = useRoomStore((s) => s.intakeMessages.filter((m) => m.role === "user").length);
  const submitIntakeAnswer = useRoomStore((s) => s.submitIntakeAnswer);
  const visible = intakePhase === "questioning";

  return (
    <AnimatePresence>
      {visible ? (
        <IntakeInput
          pending={pending}
          turnIndex={messageCount}
          onSubmit={(v) => void submitIntakeAnswer(v)}
        />
      ) : null}
    </AnimatePresence>
  );
}

function IntakeInput({
  pending,
  turnIndex,
  onSubmit,
}: {
  pending: boolean;
  turnIndex: number;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!pending) ref.current?.focus();
  }, [pending, turnIndex]);

  const trimmed = value.trim();
  const disabled = trimmed.length === 0 || pending;

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
      className="pointer-events-auto absolute bottom-6 left-1/2 z-20 flex w-[min(560px,calc(100%-32px))] -translate-x-1/2 items-center gap-2 rounded-[20px] border border-white/55 bg-[#F8FBFF]/92 p-2 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.80)] backdrop-blur-xl"
    >
      <div className="pl-3 pr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6B7A90]">
        {pending ? "scout…" : `q${turnIndex + 1}`}
      </div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={pending ? "Scout's thinking…" : "Tell Scout…"}
        className="flex-1 bg-transparent px-2 py-2 text-[14px] text-[#101827] placeholder:text-[#6B7A90] outline-none disabled:cursor-not-allowed"
        autoComplete="off"
        disabled={pending}
      />
      <Button type="submit" variant="accent" size="md" disabled={disabled}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><span>Send</span><ArrowRight className="h-3.5 w-3.5" /></>}
      </Button>
    </motion.form>
  );
}
