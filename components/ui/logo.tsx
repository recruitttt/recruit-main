"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { scaleIn } from "@/lib/motion-presets";

type Size = "sm" | "md" | "lg";

const textSize: Record<Size, string> = {
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[26px]",
};

const markSize: Record<Size, string> = {
  sm: "h-[18px] w-[18px]",
  md: "h-[22px] w-[22px]",
  lg: "h-[30px] w-[30px]",
};

const gap: Record<Size, string> = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
};

// Static SVG without its own animation. Used inside `Wordmark` so the parent
// can own the entry transition (avoids compounding scaleIn animations).
function MarkSvg({ className, size = "md" }: { className?: string; size?: Size }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("text-[var(--color-accent)]", markSize[size], className)}
      data-logo-mark
      aria-hidden
    >
      <rect
        x="2.75"
        y="2.75"
        width="18.5"
        height="18.5"
        rx="5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-80"
      />
      <path
        d="M7.25 6.55C7.08 6.14 7.5 5.76 7.9 5.95L17 10.38C17.48 10.61 17.42 11.31 16.9 11.46L13.2 12.5C12.98 12.56 12.8 12.72 12.7 12.93L11.15 16.28C10.92 16.77 10.22 16.75 10.02 16.24L7.25 6.55Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.05 9.85L12.7 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-75"
      />
    </svg>
  );
}

export function Wordmark({ className, size = "md" }: { className?: string; size?: Size }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={scaleIn}
      initial={reduce ? false : "hidden"}
      animate="visible"
      className={cn("flex items-center", gap[size], className)}
    >
      <MarkSvg size={size} />
      <span className={cn("font-serif tracking-tight text-[var(--color-accent)] leading-none", textSize[size])}>
        recruit
      </span>
    </motion.div>
  );
}

export function Mark({ className, size = "md" }: { className?: string; size?: Size }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      variants={scaleIn}
      initial={reduce ? false : "hidden"}
      animate="visible"
      className="inline-flex"
    >
      <MarkSvg className={className} size={size} />
    </motion.span>
  );
}

export function CompanyLogo({
  bg,
  text,
  size = 32,
  className,
}: {
  bg: string;
  text: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md font-medium text-white",
        className
      )}
      style={{
        background: bg,
        width: size,
        height: size,
        fontSize: size * 0.45,
      }}
    >
      {text}
    </div>
  );
}
