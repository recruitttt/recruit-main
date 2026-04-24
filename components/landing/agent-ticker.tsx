"use client";

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
    <div className="relative inline-flex items-center gap-3 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)]/90 backdrop-blur-xl py-2 pl-2 pr-5 text-[13px] font-mono shadow-[0_8px_32px_-12px_rgba(34,211,238,0.25)]">
      <div className="absolute -inset-px rounded-full bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-cyan-500/0 pointer-events-none" />
      <span className="relative flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 py-1 pl-1.5 pr-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-60" style={{ animation: "pulse-soft 1.6s ease-in-out infinite" }} />
          <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-emerald-300">
          Live
        </span>
      </span>

      <div key={ev.company} className="relative flex items-center gap-2.5 min-w-0 transition-opacity duration-300">
        <CompanyLogo
          bg={ev.logoBg}
          text={ev.logoText}
          size={22}
          className="rounded-[5px]"
        />
        <span className="font-sans text-[14px] text-[var(--color-fg)] truncate font-medium tracking-tight">
          {ev.company}
        </span>
        <span className="hidden sm:inline text-[var(--color-fg-subtle)] truncate text-[12px]">
          {ev.role}
        </span>
        <span className="hidden sm:inline text-[var(--color-fg-subtle)]">
          →
        </span>
        <span className="hidden sm:inline text-[var(--color-accent)] truncate text-[12px]">
          {ev.text}
        </span>
      </div>
    </div>
  );
}
