"use client";

import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import { FRONT_STAGE } from "@/lib/room/app-agent-map";
import { useRoomStore } from "./room-store";

export const INTAKE_QUESTIONS: readonly string[] = [
  "Hey, while the others get moving — quick thing. What's the job you'd take in a heartbeat if it showed up tomorrow?",
  "Got it. And what are you actually open to right now? Dream role only, or anything that pays the bills?",
  "Last one — any hard lines on pay or where you want to work? Remote-only, Bay Area, minimum salary, anything like that.",
];

const REVEAL_MS_PER_CHAR = 26;

export function ScoutSpeechBubble() {
  const intakePhase = useRoomStore((s) => s.intakePhase);
  const intakeStep = useRoomStore((s) => s.intakeStep);
  const visible = intakePhase === "questioning";

  return (
    <Html
      position={[FRONT_STAGE[0], 2.25, FRONT_STAGE[2]]}
      center
      distanceFactor={6}
      style={{ pointerEvents: "none" }}
      zIndexRange={[50, 0]}
    >
      <AnimatePresence mode="wait">
        {visible ? (
          <BubbleBody key={intakeStep} step={intakeStep} />
        ) : null}
      </AnimatePresence>
    </Html>
  );
}

function BubbleBody({ step }: { step: number }) {
  const text = INTAKE_QUESTIONS[step] ?? "";
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    const iv = window.setInterval(() => {
      setRevealed((r) => {
        const next = r + 1;
        if (next >= text.length) {
          window.clearInterval(iv);
        }
        return Math.min(next, text.length);
      });
    }, REVEAL_MS_PER_CHAR);
    return () => window.clearInterval(iv);
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-[360px] max-w-[80vw] -translate-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-5 py-4 shadow-[0_20px_40px_-20px_rgba(15,15,18,0.25)] backdrop-blur-sm"
      style={{ pointerEvents: "auto" }}
    >
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: "#0891B2",
            boxShadow: "0 0 8px rgba(8,145,178,0.55)",
          }}
        />
        Scout · Agent · lead
      </div>
      <p className="text-[13.5px] leading-relaxed text-[var(--color-fg)]">
        {text.slice(0, revealed)}
        {revealed < text.length ? (
          <span className="inline-block h-[1em] w-[2px] translate-y-[2px] bg-current opacity-70" />
        ) : null}
      </p>
      {/* little pointer toward Scout's head */}
      <div
        aria-hidden
        className="absolute left-1/2 bottom-[-8px] h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-[var(--color-border)] bg-[var(--color-surface)]/95"
      />
    </motion.div>
  );
}
