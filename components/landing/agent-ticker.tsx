"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/ui/logo";

type Event = {
  company: string;
  role: string;
  text: string;
  logoBg: string;
  logoText: string;
};

const events: Event[] = [
  {
    company: "Anthropic",
    role: "Software Engineer, Product",
    text: "Submitted",
    logoBg: "#d97757",
    logoText: "A",
  },
  {
    company: "Linear",
    role: "Design Engineer",
    text: "Filling form (14/14)",
    logoBg: "#5e6ad2",
    logoText: "L",
  },
  {
    company: "Vercel",
    role: "Product Engineer",
    text: "Reviewing tailored resume",
    logoBg: "#000",
    logoText: "▲",
  },
  {
    company: "Perplexity",
    role: "Senior Frontend Engineer",
    text: "Tailoring against JD",
    logoBg: "#1d4944",
    logoText: "P",
  },
  {
    company: "Supabase",
    role: "Full Stack Engineer",
    text: "Discovered, queued",
    logoBg: "#3ecf8e",
    logoText: "S",
  },
];

export function AgentTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % events.length), 2400);
    return () => clearInterval(t);
  }, []);

  const ev = events[index];

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md py-1.5 pl-1.5 pr-4 text-[12px] font-mono">
      <span className="flex items-center gap-2 rounded-full bg-[var(--color-surface-1)] py-0.5 pl-1 pr-2">
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          style={{ animation: "pulse-soft 2s ease-in-out infinite" }}
        />
        <span className="text-[10px] uppercase tracking-wider text-emerald-300">
          Live
        </span>
      </span>

      <div className="flex items-center gap-2 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={ev.company}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex items-center gap-2 min-w-0"
          >
            <CompanyLogo
              bg={ev.logoBg}
              text={ev.logoText}
              size={18}
              className="rounded-[4px]"
            />
            <span className="text-[var(--color-fg)] truncate">
              {ev.company}
            </span>
            <span className="text-[var(--color-fg-subtle)] truncate">
              · {ev.role}
            </span>
            <span className="hidden sm:inline text-[var(--color-fg-subtle)]">
              ·
            </span>
            <span className="hidden sm:inline text-[var(--color-accent)] truncate">
              {ev.text}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
