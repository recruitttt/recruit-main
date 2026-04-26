"use client";

import { motion, useReducedMotion } from "motion/react";
import { cx } from "@/components/design-system";

type ThemeParticleFallProps = {
  className?: string;
};

const PARTICLES = Array.from({ length: 34 }, (_, index) => ({
  id: index,
  left: (index * 29 + 11) % 100,
  size: 2 + (index % 5) * 0.9,
  delay: (index % 11) * 1.1,
  duration: 22 + (index % 7) * 3.4,
  drift: ((index % 9) - 4) * 5,
}));

export function ThemeParticleFall({ className }: ThemeParticleFallProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <ParticleLayer
        kind="star"
        reduceMotion={Boolean(reduceMotion)}
        className="opacity-[var(--falling-stars-opacity)]"
      />
      <ParticleLayer
        kind="grass"
        reduceMotion={Boolean(reduceMotion)}
        className="opacity-[var(--falling-grass-opacity)]"
      />
    </div>
  );
}

function ParticleLayer({
  kind,
  reduceMotion,
  className,
}: {
  kind: "star" | "grass";
  reduceMotion: boolean;
  className?: string;
}) {
  return (
    <div className={cx("absolute inset-0 transition-opacity duration-500", className)}>
      {PARTICLES.map((particle) => (
        <motion.span
          key={`${kind}-${particle.id}`}
          className={cx(
            "absolute top-[-8%] block",
            kind === "star"
              ? "rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.72)]"
              : "rounded-[999px_999px_999px_0] bg-[var(--color-accent)] opacity-60 shadow-[0_0_10px_rgba(63,122,86,0.16)]",
          )}
          style={{
            left: `${particle.left}%`,
            width: kind === "star" ? particle.size : particle.size * 1.3,
            height: kind === "star" ? particle.size : particle.size * 0.78,
          }}
          animate={reduceMotion ? undefined : {
            x: [0, particle.drift, particle.drift * -0.4],
            y: ["-8vh", "108vh"],
            rotate: kind === "grass" ? [0, 140, 260] : [0, 0],
            opacity: kind === "star" ? [0, 0.8, 0.2, 0] : [0, 0.56, 0.34, 0],
          }}
          transition={reduceMotion ? undefined : {
            duration: particle.duration,
            delay: particle.delay,
            ease: "linear",
            repeat: Infinity,
          }}
        />
      ))}
    </div>
  );
}
