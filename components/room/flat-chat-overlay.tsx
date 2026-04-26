"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Box, Loader2 } from "lucide-react";
import { useRoomStore } from "./room-store";
import { Button } from "@/components/ui/button";

export function FlatChatOverlay() {
  const chatMode = useRoomStore((s) => s.chatMode);
  const intakePhase = useRoomStore((s) => s.intakePhase);
  const visible = chatMode === "flat" && intakePhase !== "inactive" && intakePhase !== "walking-back";

  return (
    <AnimatePresence>{visible ? <FlatChatBody /> : null}</AnimatePresence>
  );
}

function FlatChatBody() {
  const messages = useRoomStore((s) => s.intakeMessages);
  const pending = useRoomStore((s) => s.intakePending);
  const submit = useRoomStore((s) => s.submitIntakeAnswer);
  const skip = useRoomStore((s) => s.skipIntake);
  const setChatMode = useRoomStore((s) => s.setChatMode);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending, messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending]);

  const trimmed = value.trim();
  const disabled = trimmed.length === 0 || pending;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#101827]/35 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-[min(640px,calc(100%-48px))] w-[min(560px,calc(100%-32px))] flex-col overflow-hidden rounded-[24px] border border-white/55 bg-[#F8FBFF]/96 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.32),0_12px_32px_-16px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/45 px-5 py-3">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#0891B2", boxShadow: "0 0 8px rgba(8,145,178,0.45)" }}
            />
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B7A90]">
              Scout · chatting
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setChatMode("3d")}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-white/55 bg-white/55 px-2.5 text-[10px] font-mono uppercase tracking-[0.18em] text-[#101827] transition hover:bg-white/75"
              title="Back to 3D room"
            >
              <Box className="h-3 w-3" />
              <span>3D</span>
            </button>
            <button
              type="button"
              onClick={skip}
              className="inline-flex h-7 items-center rounded-full px-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6B7A90] transition hover:text-[#101827]"
              title="Skip intake"
            >
              Skip
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {messages.length === 0 && pending ? (
              <ScoutThinking />
            ) : (
              messages.map((m, i) =>
                m.role === "assistant" ? (
                  <ScoutBubble key={i}>{m.content}</ScoutBubble>
                ) : (
                  <UserBubble key={i}>{m.content}</UserBubble>
                ),
              )
            )}
            {messages.length > 0 && pending ? <ScoutThinking /> : null}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (disabled) return;
            void submit(trimmed);
            setValue("");
          }}
          className="flex items-center gap-2 border-t border-white/45 bg-white/40 px-3 py-3"
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={pending ? "Scout's thinking…" : "Tell Scout…"}
            className="flex-1 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-[14px] text-[#101827] placeholder:text-[#6B7A90] outline-none transition focus:border-[var(--color-accent)] focus:bg-white/90 disabled:cursor-not-allowed"
            autoComplete="off"
            disabled={pending}
          />
          <Button type="submit" variant="accent" size="md" disabled={disabled}>
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <span>Send</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function ScoutBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[82%] rounded-[18px] rounded-bl-md border border-white/60 bg-white/85 px-4 py-2.5 text-[14.5px] leading-relaxed text-[#101827] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] rounded-[18px] rounded-br-md bg-[var(--color-accent)] px-4 py-2.5 text-[14.5px] leading-relaxed text-white shadow-[0_8px_18px_-10px_rgba(63,122,86,0.45)]">
        {children}
      </div>
    </div>
  );
}

function ScoutThinking() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-[18px] border border-white/60 bg-white/85 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
        <ThinkingDot delay={0} />
        <ThinkingDot delay={0.18} />
        <ThinkingDot delay={0.36} />
      </div>
    </div>
  );
}

function ThinkingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      animate={{ opacity: [0.25, 1, 0.25] }}
      transition={{ duration: 1.2, repeat: Infinity, delay }}
      className="inline-block h-1.5 w-1.5 rounded-full bg-[#6B7A90]"
    />
  );
}
