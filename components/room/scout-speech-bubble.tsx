"use client";

import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import { FRONT_STAGE } from "@/lib/room/app-agent-map";
import { AGENTS } from "@/lib/agents";
import { speak } from "@/lib/speech";
import { useRoomStore } from "./room-store";

const REVEAL_MS_PER_CHAR = 22;

export function ScoutSpeechBubble() {
  const intakePhase = useRoomStore((s) => s.intakePhase);
  const messages = useRoomStore((s) => s.intakeMessages);
  const pending = useRoomStore((s) => s.intakePending);
  const chatMode = useRoomStore((s) => s.chatMode);
  const visible = intakePhase === "questioning" && chatMode === "3d";

  const latest = [...messages].reverse().find((m) => m.role === "assistant");
  const text = latest?.content ?? "";
  const showThinking = pending && !text;

  // Speak each new Scout line aloud via ElevenLabs in Scout's voice.
  // Tracks the last-spoken text so re-renders / state churn don't replay
  // the same line. Honors the global mute flag inside `speak()`.
  const lastSpokenRef = useRef<string>("");
  useEffect(() => {
    if (!visible) return;
    if (!text) return;
    if (lastSpokenRef.current === text) return;
    lastSpokenRef.current = text;
    void speak(text, { voiceId: AGENTS.scout.voiceId });
  }, [text, visible]);

  return (
    <Html
      position={[FRONT_STAGE[0], 2.4, FRONT_STAGE[2]]}
      center
      distanceFactor={9}
      style={{ pointerEvents: "none" }}
      zIndexRange={[50, 0]}
    >
      <AnimatePresence mode="wait">
        {visible ? (
          showThinking ? (
            <BubbleBody key="__thinking" text="" thinking />
          ) : (
            <BubbleBody key={text} text={text} thinking={false} />
          )
        ) : null}
      </AnimatePresence>
    </Html>
  );
}

function BubbleBody({ text, thinking }: { text: string; thinking: boolean }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (thinking) return;
    setRevealed(0);
    const iv = window.setInterval(() => {
      setRevealed((r) => {
        const next = r + 1;
        if (next >= text.length) window.clearInterval(iv);
        return Math.min(next, text.length);
      });
    }, REVEAL_MS_PER_CHAR);
    return () => window.clearInterval(iv);
  }, [text, thinking]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: "auto" }}
      className="relative w-[460px] max-w-[88vw] -translate-y-4 rounded-[22px] border border-white/55 bg-[#F8FBFF]/92 px-6 py-5 shadow-[0_22px_42px_-20px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.80)] backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#6B7A90]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#0891B2", boxShadow: "0 0 8px rgba(8,145,178,0.45)" }} />
        Scout · Agent · lead
      </div>
      {thinking ? (
        <div className="flex items-center gap-1.5 py-1 text-[#6B7A90]">
          <ThinkingDot delay={0} />
          <ThinkingDot delay={0.18} />
          <ThinkingDot delay={0.36} />
        </div>
      ) : (
        <p className="text-[17px] leading-relaxed text-[#101827]">
          {text.slice(0, revealed)}
          {revealed < text.length ? (
            <span className="inline-block h-[1em] w-[2px] translate-y-[2px] bg-current opacity-70" />
          ) : null}
        </p>
      )}
      <div
        aria-hidden
        className="absolute left-1/2 bottom-[-8px] h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-white/55 bg-[#F8FBFF]/92"
      />
    </motion.div>
  );
}

function ThinkingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      animate={{ opacity: [0.25, 1, 0.25] }}
      transition={{ duration: 1.2, repeat: Infinity, delay }}
      className="inline-block h-1.5 w-1.5 rounded-full bg-current"
    />
  );
}
