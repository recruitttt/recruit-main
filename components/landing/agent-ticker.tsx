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
    <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 backdrop-blur-sm py-1 pl-1.5 pr-3.5 text-[12px] font-mono">
      <span className="flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-60" style={{ animation: "pulse-soft 1.6s ease-in-out infinite" }} />
          <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-emerald-700">
          Live
        </span>
      </span>

      <span className="h-3 w-px bg-[var(--color-border)]" />

      <div key={ev.company} className="flex items-center gap-2 min-w-0 transition-opacity duration-300">
        <CompanyLogo
          bg={ev.logoBg}
          text={ev.logoText}
          size={16}
          className="rounded-[4px]"
        />
        <span className="text-[var(--color-fg)] truncate tracking-tight">
          {ev.company}
        </span>
        <span className="text-[var(--color-fg-subtle)]">·</span>
        <span className="text-[var(--color-fg-muted)] truncate">
          {ev.text}
        </span>
      </div>
    </div>
  );
}
