"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";

const TOUR_KEY = "recruit:tour-done";
const PAD = 10;
const CARD_W = 296;

interface Rect { top: number; left: number; width: number; height: number }

interface Step {
  id: string;
  target: string;
  title: string;
  body: string;
  placement: "bottom" | "left" | "right";
}

const STEPS: Step[] = [
  {
    id: "status-strip",
    target: "status-strip",
    title: "Your pipeline at a glance",
    body: "These cards update live as your agents work. Sources, jobs captured, ranked, and tailored — all tracked here.",
    placement: "bottom",
  },
  {
    id: "leaderboard",
    target: "leaderboard",
    title: "Your ranked job board",
    body: "Every role is scored against your profile and sorted in real time. Click any row to inspect it in depth.",
    placement: "bottom",
  },
  {
    id: "inspector",
    target: "inspector",
    title: "Fit analysis and tailoring",
    body: "Scout shows strengths, risks, and rationale for each role. Hit Tailor to generate a targeted resume PDF.",
    placement: "left",
  },
];

function snap(tourId: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${tourId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function popoverPos(rect: Rect, placement: Step["placement"]): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 14;

  if (placement === "bottom") {
    let left = rect.left + rect.width / 2 - CARD_W / 2;
    left = Math.max(12, Math.min(left, vw - CARD_W - 12));
    const top = rect.top + rect.height + margin;
    return { top, left };
  }
  if (placement === "left") {
    const left = Math.max(12, rect.left - CARD_W - margin);
    let top = rect.top + rect.height / 2 - 110;
    top = Math.max(12, Math.min(top, vh - 240));
    return { top, left };
  }
  // right
  const left = Math.min(rect.left + rect.width + margin, vw - CARD_W - 12);
  let top = rect.top + rect.height / 2 - 110;
  top = Math.max(12, Math.min(top, vh - 240));
  return { top, left };
}

export function DashboardTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [showDone, setShowDone] = useState(false);
  const returnFocusRef = useRef<Element | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(TOUR_KEY) !== "1") {
        returnFocusRef.current = document.activeElement;
        setVisible(true);
      }
    } catch {}
  }, []);

  const finish = useCallback(() => {
    try { window.localStorage.setItem(TOUR_KEY, "1"); } catch {}
    setShowDone(false);
    setVisible(false);
    setTimeout(() => {
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
    }, 200);
  }, []);

  const advance = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      setShowDone(true);
    }
  }, [step]);

  // Measure target on step change
  useEffect(() => {
    if (!visible || showDone) return;
    const target = STEPS[step]?.target;
    if (!target) return;

    const el = document.querySelector(`[data-tour="${target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const frame = requestAnimationFrame(() => {
      const measured = snap(target);
      if (!measured) {
        // Hidden on this breakpoint — skip
        setStep(s => s + 1);
        return;
      }
      setRect(measured);
    });
    return () => cancelAnimationFrame(frame);
  }, [step, visible, showDone]);

  // Escape key
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, finish]);

  // Re-measure on resize / scroll
  useEffect(() => {
    if (!visible || showDone) return;
    const target = STEPS[step]?.target;
    if (!target) return;
    let t: ReturnType<typeof setTimeout>;
    const remeasure = () => { clearTimeout(t); t = setTimeout(() => setRect(snap(target)), 80); };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, { passive: true });
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure);
      clearTimeout(t);
    };
  }, [step, visible, showDone]);

  // Focus next button
  useEffect(() => {
    if (visible) setTimeout(() => nextRef.current?.focus(), 100);
  }, [step, visible, showDone]);

  if (!visible) return null;

  const current = STEPS[step];
  const spotStyle = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;
  const cardPos = rect && current ? popoverPos(rect, current.placement) : {};

  return (
    <AnimatePresence>
      {showDone ? (
        // ── Done modal ─────────────────────────────────────────────────────
        <motion.div
          key="done"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[95] flex items-center justify-center p-6"
          onClick={finish}
        >
          <div className="absolute inset-0 bg-[rgba(15,23,42,0.52)] backdrop-blur-[3px]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[360px] overflow-hidden rounded-[30px] border border-white/70 bg-[#FDFCFA]/97 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.28)] backdrop-blur-2xl"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-done-title"
          >
            {/* Warm gradient accent */}
            <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(8,145,178,0.08),transparent_70%)]" />

            <div className="relative p-7">
              {/* Scout avatar */}
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white shadow-[0_0_0_4px_rgba(8,145,178,0.14),0_2px_8px_rgba(8,145,178,0.3)]"
                  style={{ background: "linear-gradient(140deg,#0891b2 0%,#06b6d4 100%)" }}
                  aria-hidden
                >
                  S
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-600">Scout</div>
                  <div className="text-[10px] text-slate-400">Lead agent</div>
                </div>
              </div>

              <h2 id="tour-done-title" className="text-[22px] font-semibold tracking-[-0.04em] text-slate-950">
                You are all set.
              </h2>
              <p className="mt-2 text-[13px] leading-[1.68] text-slate-500">
                Hit Run in the status strip to kick off your first search. Scout will keep the board fresh as new roles come in.
              </p>

              {/* Step dots */}
              <div className="mt-5 flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className="h-1 rounded-full"
                    style={{ width: 6, backgroundColor: "#0891b2", opacity: 0.5 + (i / STEPS.length) * 0.5 }}
                  />
                ))}
                <div className="h-1 w-5 rounded-full" style={{ backgroundColor: "#0891b2" }} />
              </div>

              <button
                ref={nextRef}
                type="button"
                onClick={finish}
                className="mt-5 w-full rounded-[18px] bg-slate-950 py-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Start searching
              </button>
              <button
                type="button"
                onClick={finish}
                className="mt-2.5 w-full text-center text-[11.5px] text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        // ── Spotlight steps ─────────────────────────────────────────────────
        <motion.div
          key="spotlight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none fixed inset-0 z-[95]"
        >
          {/* Spotlight box — the enormous box-shadow darkens everything else */}
          {spotStyle && (
            <motion.div
              className="pointer-events-none fixed rounded-[20px]"
              style={{ boxShadow: "0 0 0 9999px rgba(15,23,42,0.60), 0 0 0 1.5px rgba(255,255,255,0.22)", zIndex: 96 }}
              animate={{ top: spotStyle.top, left: spotStyle.left, width: spotStyle.width, height: spotStyle.height }}
              initial={false}
              transition={{ type: "spring", stiffness: 300, damping: 34, mass: 0.8 }}
            />
          )}

          {/* Popover card */}
          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 7, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ ...cardPos, width: CARD_W, position: "fixed", zIndex: 97, pointerEvents: "auto" }}
                className="rounded-[22px] border border-white/70 bg-[#FDFCFA]/97 shadow-[0_20px_56px_-10px_rgba(15,23,42,0.22)] backdrop-blur-2xl"
                role="dialog"
                aria-label={`Tour: step ${step + 1} of ${STEPS.length}`}
              >
                <div className="p-5">
                  {/* Header row */}
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold text-white shadow-[0_0_0_2px_rgba(8,145,178,0.2)]"
                        style={{ background: "linear-gradient(140deg,#0891b2,#06b6d4)" }}
                        aria-hidden
                      >
                        S
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                        {step + 1} / {STEPS.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={finish}
                      className="rounded px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:text-slate-600 focus:outline-none"
                    >
                      Skip
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="text-[14px] font-semibold leading-snug tracking-[-0.025em] text-slate-950">
                    {current.title}
                  </h3>

                  {/* Body */}
                  <p className="mt-1.5 text-[12.5px] leading-[1.62] text-slate-500">
                    {current.body}
                  </p>

                  {/* Progress dots + Next button */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {STEPS.map((_, i) => (
                        <motion.div
                          key={i}
                          className="h-[5px] rounded-full"
                          animate={{
                            width: i === step ? 18 : 5,
                            backgroundColor: i === step ? "#0891b2" : "#cbd5e1",
                          }}
                          transition={{ duration: 0.25 }}
                        />
                      ))}
                    </div>
                    <button
                      ref={nextRef}
                      type="button"
                      onClick={advance}
                      className="flex items-center gap-1 rounded-full bg-slate-950 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      {step === STEPS.length - 1 ? "Done" : "Next"}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
