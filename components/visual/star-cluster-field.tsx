"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { cx } from "@/components/design-system";

type StarClusterFieldProps = {
  className?: string;
  variant?: "dashboard" | "graph";
};

const CLUSTERS = [
  {
    x: 18,
    y: 16,
    drift: -64,
    stars: [
      [-26, -10, 1.4, 0.38],
      [-12, 6, 2.2, 0.62],
      [0, 0, 1.2, 0.44],
      [12, -13, 2.8, 0.76],
      [26, 9, 1.6, 0.46],
      [35, -4, 1.1, 0.34],
    ],
  },
  {
    x: 54,
    y: 18,
    drift: -92,
    stars: [
      [-38, 10, 1.2, 0.36],
      [-21, -8, 2.5, 0.72],
      [-5, 5, 1.5, 0.44],
      [12, -2, 3.2, 0.82],
      [24, 15, 1.4, 0.4],
      [43, -13, 1.9, 0.5],
    ],
  },
  {
    x: 78,
    y: 34,
    drift: -70,
    stars: [
      [-28, -13, 1.6, 0.46],
      [-14, 7, 2.6, 0.68],
      [2, -3, 1.2, 0.38],
      [17, 12, 2.1, 0.56],
      [34, -8, 1.5, 0.42],
      [48, 6, 1.1, 0.34],
    ],
  },
  {
    x: 35,
    y: 48,
    drift: -52,
    stars: [
      [-24, 4, 1.2, 0.36],
      [-9, -12, 2, 0.52],
      [8, 2, 1.6, 0.42],
      [21, -4, 2.4, 0.58],
      [36, 13, 1.1, 0.32],
    ],
  },
] as const;

export function StarClusterField({
  className,
  variant = "dashboard",
}: StarClusterFieldProps) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, variant === "graph" ? -18 : -58]);
  const scale = useTransform(scrollYProgress, [0, 0.48, 1], [1, variant === "graph" ? 1.03 : 1.06, 0.98]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, variant === "graph" ? -2 : -3]);

  return (
    <motion.div
      aria-hidden="true"
      className={cx("theme-star-field pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={reduceMotion ? undefined : { y, scale, rotate }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(142,126,168,0.025),transparent_44%),linear-gradient(225deg,rgba(63,122,86,0.024),transparent_46%)]" />
      {CLUSTERS.map((cluster, clusterIndex) => (
        <motion.div
          key={`${cluster.x}-${cluster.y}`}
          className="absolute"
          style={{ left: `${cluster.x}%`, top: `${cluster.y}%` }}
          animate={reduceMotion ? undefined : {
            x: [0, cluster.drift * 0.14, 0],
            y: [0, cluster.drift * 0.07, 0],
          }}
          transition={reduceMotion ? undefined : {
            duration: 62 + clusterIndex * 12,
            delay: clusterIndex * 2.2,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          {cluster.stars.map(([dx, dy, size, starOpacity], starIndex) => (
            <motion.span
              key={`${dx}-${dy}-${starIndex}`}
              className="absolute rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.58)]"
              style={{
                left: dx,
                top: dy,
                width: size,
                height: size,
                opacity: starOpacity,
              }}
              animate={reduceMotion ? undefined : {
                opacity: [starOpacity * 0.48, starOpacity, starOpacity * 0.62],
                scale: [0.8, 1.22, 0.9],
              }}
              transition={reduceMotion ? undefined : {
                duration: 15 + ((clusterIndex + starIndex) % 5) * 3.4,
                delay: clusterIndex * 0.8 + starIndex * 0.45,
                ease: "easeInOut",
                repeat: Infinity,
              }}
            />
          ))}
        </motion.div>
      ))}
      <motion.div
        className="absolute left-[18%] top-[20%] h-px w-[64%] origin-left bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]"
        animate={reduceMotion ? undefined : { opacity: [0.04, 0.14, 0.05], scaleX: [0.7, 1, 0.82] }}
        transition={reduceMotion ? undefined : { duration: 32, ease: "easeInOut", repeat: Infinity }}
      />
    </motion.div>
  );
}
