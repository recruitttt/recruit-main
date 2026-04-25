"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";

const TransitionCanvas = dynamic(() => import("./scene-transition-canvas"), {
  ssr: false,
});

export type TransitionPhase = "enter" | "wave" | "exit" | "done";

/**
 * Onboarding → room transition. Rendered inline in the chat flow with no
 * card chrome; the canvas is transparent so Scout appears directly on the
 * chat background, then drops out of frame as the camera pans down into
 * the room.
 */
export function SceneTransition({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<TransitionPhase>("enter");

  useEffect(() => {
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase("wave"), 900));
    timers.push(window.setTimeout(() => setPhase("exit"), 2900));
    timers.push(
      window.setTimeout(() => {
        setPhase("done");
        onComplete();
      }, 4100)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="relative mt-4 h-[280px]"
      style={{ background: "transparent" }}
    >
      <TransitionCanvas phase={phase} />
    </motion.div>
  );
}
