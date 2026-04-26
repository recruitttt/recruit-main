"use client";

//
// Activation orbit — the 1.4s climax fired when the user confirms onboarding.
// Four squad agents orbit a central "profile" card; Scout sits at center.
// A confetti burst lands at t=0.9s. The page itself plays the activate chord
// from lib/sounds.ts at t=0 (handled by the orchestrator).
//

import { useEffect, useState } from "react";
// `useState`/`useEffect` are kept for the confetti reveal toggle — confetti
// piece positions themselves are computed once at module scope below.
import { motion, useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";
import { cx, mistColors, mistRadii } from "@/components/design-system";
import { AgentCharacter } from "@/components/onboarding/characters";
import { AGENTS } from "@/lib/agents";
import type { AgentId } from "@/lib/agents";

const ORBIT_RADIUS = 110;
const ORBIT_AGENTS: AgentId[] = ["mimi", "pip", "juno", "bodhi"];
const CONFETTI_AT = 900; // ms
const ORBIT_DURATION = 1.4; // s

export function ActivationOrbit() {
  const reduce = useReducedMotion();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const id = window.setTimeout(() => setShowConfetti(true), CONFETTI_AT);
    return () => window.clearTimeout(id);
  }, [reduce]);

  return (
    <div
      className="relative mx-auto flex h-[300px] w-full max-w-[420px] items-center justify-center"
      role="status"
      aria-label="Activating your squad"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${mistColors.activationGold}40, transparent 65%)`,
        }}
      />

      <motion.div
        initial={reduce ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cx(
          "relative z-10 flex flex-col items-center gap-2 border bg-white/55 px-5 py-4 backdrop-blur-2xl",
          mistRadii.nested,
        )}
        style={{
          borderColor: `${mistColors.activationGold}80`,
          boxShadow: `0 0 0 1px ${mistColors.activationGold}40, 0 22px 60px rgba(15,23,42,0.12)`,
        }}
      >
        <AgentCharacter id="scout" awake size={56} />
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Squad ready
          </div>
          <div
            className="mt-1 font-serif text-[18px] leading-tight tracking-tight"
            style={{ color: AGENTS.scout.hue }}
          >
            Let&apos;s go.
          </div>
        </div>
        <Sparkles
          className="h-3.5 w-3.5"
          style={{ color: mistColors.activationGold }}
        />
      </motion.div>

      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { rotate: -10 }}
        animate={{ rotate: reduce ? 0 : 350 }}
        transition={{
          duration: reduce ? 0 : ORBIT_DURATION,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {ORBIT_AGENTS.map((id, i) => {
          const angle = (i / ORBIT_AGENTS.length) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * ORBIT_RADIUS;
          const y = Math.sin(angle) * ORBIT_RADIUS;
          return (
            <motion.div
              key={id}
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: reduce ? 0 : 0.1 + i * 0.07,
                duration: reduce ? 0 : 0.4,
              }}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
              }}
            >
              <motion.div
                animate={{ rotate: reduce ? 0 : -350 }}
                transition={{
                  duration: reduce ? 0 : ORBIT_DURATION,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <AgentCharacter id={id} awake size={42} />
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      {showConfetti && !reduce && <ConfettiBurst />}
    </div>
  );
}

interface ConfettiPiece {
  x: number;
  y: number;
  rotate: number;
  hue: string;
}

const CONFETTI_HUES = [
  mistColors.activationGold,
  mistColors.accent,
  AGENTS.mimi.hue,
  AGENTS.pip.hue,
  AGENTS.juno.hue,
  AGENTS.bodhi.hue,
];

const CONFETTI_PIECES: ConfettiPiece[] = (() => {
  const count = 26;
  // Deterministic pseudo-random per-index — keeps React purity rules happy
  // and ensures every confetti burst lands the same way across re-renders.
  const rand = (seed: number) => {
    const v = Math.sin(seed * 9301 + 49297) * 233280;
    return v - Math.floor(v);
  };
  return Array.from({ length: count }).map((_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const distance = 140 + rand(i + 1) * 60;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      rotate: rand(i + 17) * 360,
      hue: CONFETTI_HUES[i % CONFETTI_HUES.length],
    };
  });
})();

function ConfettiBurst() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {CONFETTI_PIECES.map((piece, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: piece.x,
            y: piece.y,
            scale: [0, 1, 1, 0.6],
            rotate: piece.rotate,
          }}
          transition={{
            duration: 0.85,
            ease: [0.22, 1, 0.36, 1],
            times: [0, 0.2, 0.7, 1],
          }}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 6,
            height: 10,
            background: piece.hue,
            borderRadius: 1,
            transformOrigin: "center",
          }}
        />
      ))}
    </div>
  );
}
