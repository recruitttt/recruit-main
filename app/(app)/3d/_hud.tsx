"use client";

//
// RoomHud — corner HUD chrome rendered above the 3D scene. Only the 2D
// overlay is animated here; the Three.js canvas itself is owned by
// RoomCanvasClient and stays untouched.
//

import { motion, useReducedMotion } from "motion/react";

import { fadeUp, staggerContainer } from "@/lib/motion-presets";

export function RoomHud(): React.ReactElement {
  const reduce = useReducedMotion();
  return (
    <motion.header
      className="mb-5"
      variants={staggerContainer(reduce ? 0 : 0.06)}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={fadeUp}
        className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#6B7A90]"
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
            style={
              reduce
                ? undefined
                : { animation: "pulse-soft 2.4s ease-in-out infinite" }
            }
            aria-hidden
          />
          Live · agents working
        </span>
      </motion.div>
      <motion.h1
        variants={fadeUp}
        className="mt-1 font-serif text-3xl leading-tight text-[#101827]"
      >
        The room
      </motion.h1>
    </motion.header>
  );
}
