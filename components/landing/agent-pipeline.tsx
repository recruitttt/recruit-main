"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Search, Pencil, Send, Mail, CalendarCheck } from "lucide-react";
import { Mark } from "@/components/ui/logo";
import { mistColors } from "@/components/design-system";

const steps = [
  { Icon: Search,        label: "Finding jobs" },
  { Icon: Pencil,        label: "Tailoring resumes" },
  { Icon: Send,          label: "Submitting" },
  { Icon: Mail,          label: "Reaching recruiters" },
  { Icon: CalendarCheck, label: "Scheduling interviews" },
];

type Phase = "reveal" | "dwell" | "collapse" | "burst" | "fly" | "done";

const T = {
  reveal: 2300,
  dwell: 1200,
  collapse: 700,
  burst: 260,
  fly: 780,
};

const container: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.3, delayChildren: 0.2 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

function collapseTargetFor(i: number) {
  const centerIdx = (steps.length - 1) / 2;
  const offset = (centerIdx - i) * 72; // items translate toward row center
  return {
    x: offset,
    scale: 0.4,
    opacity: 0,
    filter: "blur(1.5px)",
    transition: {
      duration: T.collapse / 1000,
      ease: [0.5, 0, 0.65, 1] as const,
    },
  };
}

export function AgentPipeline({ onComplete }: { onComplete?: () => void }) {
  const [phase, setPhase] = useState<Phase>("reveal");
  const rowRef = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [logoTarget, setLogoTarget] = useState<{ x: number; y: number } | null>(null);

  // phase state-machine driver
  useEffect(() => {
    let t: number | undefined;
    if (phase === "reveal")   t = window.setTimeout(() => setPhase("dwell"), T.reveal);
    if (phase === "dwell")    t = window.setTimeout(() => setPhase("collapse"), T.dwell);
    if (phase === "collapse") t = window.setTimeout(() => setPhase("burst"), T.collapse);
    if (phase === "burst")    t = window.setTimeout(() => setPhase("fly"), T.burst);
    if (phase === "fly")      t = window.setTimeout(() => setPhase("done"), T.fly);
    return () => { if (t) window.clearTimeout(t); };
  }, [phase]);

  // capture row center at start of collapse
  useEffect(() => {
    if (phase !== "collapse" || center) return;
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCenter({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, [phase, center]);

  // capture logo target right before flight
  useEffect(() => {
    if (phase !== "burst") return;
    const logoEl = document.querySelector("[data-logo-mark]") as SVGElement | null;
    if (!logoEl) return;
    const frame = window.requestAnimationFrame(() => {
      const rect = logoEl.getBoundingClientRect();
      setLogoTarget({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  // when the flight lands: reveal the real logo + pulse it
  useEffect(() => {
    if (phase !== "done") return;
    onComplete?.();
    const logoEl = document.querySelector("[data-logo-mark]") as SVGElement | null;
    if (logoEl) {
      // give the opacity fade-in a beat before pulsing
      window.setTimeout(() => {
        logoEl.animate(
          [
            { transform: "scale(1)",    filter: "brightness(1)"    },
            { transform: "scale(1.22)", filter: "brightness(1.35)" },
            { transform: "scale(1)",    filter: "brightness(1)"    },
          ],
          { duration: 540, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      }, 60);
    }
  }, [phase, onComplete]);

  if (phase === "done") return null;

  const showRow = phase === "reveal" || phase === "dwell" || phase === "collapse";
  const collapsing = phase === "collapse";

  return (
    <>
      {showRow && (
        <motion.div
          ref={rowRef}
          initial="hidden"
          animate="show"
          variants={container}
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-[12px] text-slate-600"
        >
          {steps.map((s, i) => (
            <motion.div
              key={s.label}
              variants={item}
              animate={collapsing ? collapseTargetFor(i) : undefined}
              className="flex items-center gap-2.5"
            >
              {i > 0 && <span className="text-slate-400/70">·</span>}
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <s.Icon
                  className="h-3.5 w-3.5 text-sky-600 opacity-85"
                  strokeWidth={1.75}
                />
                {s.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* cyan glow pulses at the convergence point */}
      <AnimatePresence>
        {(phase === "burst" || phase === "fly") && center && (
          <motion.div
            key="burst-glow"
            className="pointer-events-none fixed left-0 top-0 z-40"
            initial={{ x: center.x - 60, y: center.y - 60, opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.6, 2.2] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: (T.burst + T.fly) / 1000,
              times: [0, 0.35, 1],
              ease: "easeOut",
            }}
            style={{ width: 120, height: 120 }}
          >
            <div
              className="h-full w-full rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(14,165,233,0.55), rgba(14,165,233,0) 65%)",
                filter: "blur(2px)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* the mark emerges from the glow, then flies to the logo position */}
      <AnimatePresence>
        {(phase === "burst" || phase === "fly") && center && (
          <motion.div
            key="flying-mark"
            className="pointer-events-none fixed left-0 top-0 z-50"
            style={{ color: mistColors.accent }}
            initial={{
              x: center.x - 16,
              y: center.y - 16,
              scale: 0.2,
              opacity: 0,
              rotate: -90,
            }}
            animate={
              phase === "fly" && logoTarget
                ? {
                    x: logoTarget.x - 15,
                    y: logoTarget.y - 15,
                    scale: 1,
                    opacity: [1, 1, 0],
                    rotate: 0,
                    transition: {
                      x:       { duration: T.fly / 1000, ease: [0.22, 1, 0.36, 1] },
                      y:       { duration: T.fly / 1000, ease: [0.22, 1, 0.36, 1] },
                      scale:   { duration: T.fly / 1000, ease: [0.22, 1, 0.36, 1] },
                      rotate:  { duration: T.fly / 1000, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: T.fly / 1000, times: [0, 0.85, 1] },
                    },
                  }
                : {
                    scale: 1.1,
                    opacity: 1,
                    rotate: 0,
                    transition: { duration: T.burst / 1000, ease: [0.22, 1, 0.36, 1] },
                  }
            }
            exit={{ opacity: 0 }}
          >
            <div className="h-8 w-8">
              <Mark size="md" className="h-8 w-8" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
