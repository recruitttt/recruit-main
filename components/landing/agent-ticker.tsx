"use client";

import { motion, useReducedMotion } from "motion/react";
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

const TICKER_DURATION_S = 28;

function TickerItem({ ev }: { ev: Event }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 px-3">
      <CompanyLogo
        bg={ev.logoBg}
        text={ev.logoText}
        size={16}
        className="rounded-[4px]"
      />
      <span className="tracking-tight text-[var(--color-fg)]">{ev.company}</span>
      <span className="text-[var(--color-fg-subtle)]">·</span>
      <span className="text-[var(--color-fg-muted)]">{ev.text}</span>
      <span className="ml-1 text-[var(--color-fg-subtle)]">•</span>
    </span>
  );
}

// Duplicate the list so the seamless -50% translate creates an infinite loop.
const loop: Event[] = [...events, ...events];

export function AgentTicker() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="inline-flex max-w-full items-center gap-2.5 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 py-1 pl-1.5 pr-3 text-[12px] font-mono backdrop-blur-sm">
      <span className="flex shrink-0 items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2">
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="absolute inset-0 rounded-full bg-emerald-500 opacity-60"
            style={{ animation: "pulse-soft 1.6s ease-in-out infinite" }}
          />
          <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
          Live
        </span>
      </span>

      <span className="h-3 w-px shrink-0 bg-[var(--color-border)]" />

      <div className="relative w-[260px] overflow-hidden sm:w-[360px]">
        <motion.div
          className="flex w-max whitespace-nowrap"
          animate={reduceMotion ? undefined : { x: ["0%", "-50%"] }}
          transition={
            reduceMotion
              ? undefined
              : { repeat: Infinity, duration: TICKER_DURATION_S, ease: "linear" }
          }
        >
          {loop.map((ev, i) => (
            <TickerItem key={`${ev.company}-${i}`} ev={ev} />
          ))}
        </motion.div>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--color-surface)] to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--color-surface)] to-transparent"
        />
      </div>
    </div>
  );
}
