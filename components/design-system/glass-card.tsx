"use client";

import type * as React from "react";
import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { mistClasses } from "./mist-tokens";
import { cx } from "./utils";

const TILT_MAX_DEG = 5;
const SPRING = { stiffness: 220, damping: 22, mass: 0.4 };

export function GlassCard({
  children,
  className = "",
  variant = "default",
  density = "normal",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "selected" | "critical" | "muted";
  density?: "compact" | "normal" | "spacious";
  interactive?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  // Range -0.5 .. +0.5 for x and y position over the card.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-TILT_MAX_DEG, TILT_MAX_DEG]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [TILT_MAX_DEG, -TILT_MAX_DEG]);

  const tiltEnabled = interactive && !reduce;

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tiltEnabled) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    px.set((event.clientX - rect.left) / rect.width - 0.5);
    py.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const handleLeave = () => {
    if (!tiltEnabled) return;
    px.set(0);
    py.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={tiltEnabled ? handleMove : undefined}
      onPointerLeave={tiltEnabled ? handleLeave : undefined}
      style={tiltEnabled ? { perspective: 800, rotateX, rotateY, transformStyle: "preserve-3d" } : undefined}
      className={cx(
        "min-w-0",
        mistClasses.card,
        density === "compact" ? "p-3" : density === "spacious" ? "p-5" : "p-4",
        variant === "selected" && "border-[var(--color-accent)] bg-[var(--color-accent-soft)] ring-1 ring-[var(--color-accent-glow)] shadow-[inset_3px_0_0_rgba(63,122,86,0.42),inset_0_1px_0_rgba(255,255,255,0.6)]",
        variant === "critical" && "border-red-500/30 bg-red-500/10",
        variant === "muted" && "bg-white/28",
        interactive && "transition-colors hover:bg-white/50",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
