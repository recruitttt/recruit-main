"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cx, mistClasses } from "@/components/design-system";

const ROTATION = [
  "Tell the agents what you want. They apply.",
  "Ex. Looking for software engineering internships at early-stage startups",
  "Ex. Founding ML engineer at an AI company in SF",
  "Ex. Quant research roles in NYC, new grad",
  "Ex. Design engineer at a dev-tools startup",
  "Ex. Senior frontend, remote, $220k+",
  "Ex. Product engineer with a design bar, Series A to B",
];

const ROTATE_MS = 3400;

export function JobPrompt() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showOverlay = value.length === 0 && !focused;

  // rotate through the overlay phrases while the field is empty + unfocused
  useEffect(() => {
    if (!showOverlay) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATION.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [showOverlay]);

  function submit(role?: string) {
    const q = (role ?? value).trim();
    if (!q) return router.push("/onboarding");
    router.push(`/onboarding?role=${encodeURIComponent(q)}`);
  }

  return (
    <div className="w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="group relative"
      >
        <div className="absolute -inset-px rounded-[26px] bg-gradient-to-r from-sky-500/0 via-sky-500/22 to-sky-500/0 opacity-0 blur-md transition-opacity group-focus-within:opacity-100" />
        <div className={cx("relative flex flex-col gap-2 border p-3 transition-colors focus-within:border-sky-400/60 sm:flex-row sm:items-end", mistClasses.panel)}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-white/60 bg-white/42 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <Sparkles className="h-4 w-4 text-sky-600" />
          </div>

          {/* input + overlaid rotating placeholder */}
          <div className="relative w-full flex-1">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              // native placeholder stays empty — we render our own animated one
              placeholder=""
              className="relative z-10 block max-h-32 min-h-[40px] w-full resize-none bg-transparent py-2 text-[15px] leading-relaxed text-slate-900 outline-none"
              autoFocus={false}
            />

            {showOverlay && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center overflow-hidden py-2 z-0"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={index}
                    initial={{ y: 22, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -22, opacity: 0 }}
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full truncate text-[15px] leading-relaxed text-slate-500"
                  >
                    {ROTATION[index]}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>

          <button
            type="submit"
            aria-label="Spin up your 5 agents"
            className="flex h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-slate-950 bg-slate-950 px-4 text-[13px] font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] transition hover:bg-slate-800 sm:w-auto"
          >
            Spin up my 5 agents
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
