"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

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
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 opacity-0 group-focus-within:opacity-100 blur-md transition-opacity" />
        <div className="relative flex items-end gap-2 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)]/90 backdrop-blur-xl p-3 shadow-[0_12px_40px_-12px_rgba(15,15,18,0.12)] focus-within:border-[var(--color-accent)] transition-colors">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          </div>

          {/* input + overlaid rotating placeholder */}
          <div className="relative flex-1">
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
              className="block w-full resize-none bg-transparent py-2 text-[15px] text-[var(--color-fg)] outline-none leading-relaxed min-h-[40px] max-h-32 relative z-10"
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
                    className="w-full truncate text-[15px] leading-relaxed text-[var(--color-fg-subtle)]"
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
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 text-[13px] font-medium text-white hover:brightness-110 transition-all glow-accent cursor-pointer"
          >
            Spin up my 5 agents
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
