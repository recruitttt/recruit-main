"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { Topnav } from "@/components/shell/topnav";
import { RoomCanvasClient } from "./room-canvas-client";
import type { RoomIntroPhase } from "./room-intro";

export type TransitionPhase = "enter" | "wave" | "exit" | RoomIntroPhase;

const TransitionCanvas = dynamic(() => import("./scene-transition-canvas"), {
  ssr: false,
  loading: () => null,
});

type Props = { onComplete: () => void };

export function SceneTransition({ onComplete }: Props) {
  const [phase, setPhase] = useState<RoomIntroPhase>("wave");
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  useEffect(() => {
    if (!sceneReady) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase("fall"), 1120));
    timers.push(window.setTimeout(() => setPhase("land"), 2140));
    timers.push(
      window.setTimeout(() => {
        setPhase("done");
        onComplete();
      }, 3040)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [onComplete, sceneReady]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="fixed inset-0 z-50 overflow-hidden bg-[var(--color-bg)]"
    >
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: phase === "wave" ? 0 : 1, y: phase === "wave" ? -12 : 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <Topnav />
      </motion.div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <motion.div
          className="mb-6 flex items-end justify-between"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: phase === "wave" ? 0 : 1, y: phase === "wave" ? 10 : 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#6B7A90]">
              Live · agents working
            </div>
            <h1 className="mt-1 font-serif text-4xl leading-tight text-[#101827]">The room</h1>
          </div>
        </motion.div>

        <motion.div
          className="transform-gpu will-change-transform"
          initial={{ y: "19vh", scale: 0.96 }}
          animate={{ y: phase === "wave" ? "19vh" : 0, scale: phase === "wave" ? 0.96 : 1 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <RoomCanvasClient introPhase={phase} showDetailPanel={false} onSceneReady={handleSceneReady} />
        </motion.div>
      </main>

      {/* Scout wave overlay — fullscreen centered character, only during wave phase */}
      <AnimatePresence>
        {phase === "wave" && (
          <motion.div
            key="wave-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="h-[340px] w-[280px]">
              <TransitionCanvas phase="wave" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function useSceneTransition() {
  const router = useRouter();
  const [active, setActive] = useState(false);

  const trigger = useCallback(() => {
    setActive(true);
  }, []);

  const handleComplete = useCallback(() => {
    setActive(false);
    router.push("/dashboard");
  }, [router]);

  return { active, trigger, handleComplete };
}
