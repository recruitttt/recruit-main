"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

const placeholders = [
  "Software Engineer at a Series A startup, remote, $200k+",
  "Founding Engineer at an AI company in San Francisco",
  "Senior Frontend role at a developer-tools startup",
  "Product Engineer with a serious design bar, $220k+",
  "ML / AI engineering role, ideally pre-Series B",
];

const DEFAULT_PLACEHOLDER = placeholders[0];

const quickPicks = [
  "Software Engineer",
  "Product Engineer",
  "Founding Engineer",
  "Frontend",
  "ML / AI",
  "Design Engineer",
];

export function JobPrompt() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [placeholder, setPlaceholder] = useState(DEFAULT_PLACEHOLDER);

  useEffect(() => {
    setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
  }, []);

  function submit(role?: string) {
    const q = (role ?? value).trim();
    if (!q) return router.push("/onboarding");
    router.push(`/onboarding?role=${encodeURIComponent(q)}`);
  }

  return (
    <div className="w-full max-w-2xl">
      {/* prompt box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="group relative"
      >
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 opacity-0 group-focus-within:opacity-100 blur-md transition-opacity" />
        <div className="relative flex items-end gap-2 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)]/90 backdrop-blur-xl p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] focus-within:border-[var(--color-accent)] transition-colors">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent py-2 text-[15px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none leading-relaxed min-h-[40px] max-h-32"
            autoFocus={false}
          />
          <button
            type="submit"
            aria-label="Send"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 text-[13px] font-medium text-[var(--color-bg)] hover:brightness-110 transition-all glow-accent cursor-pointer"
          >
            Find me jobs
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>

      {/* quick picks */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono mr-1">
          Or try
        </span>
        {quickPicks.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => submit(p)}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-colors cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-5 text-center">
        <span className="text-[12px] text-[var(--color-fg-subtle)] font-mono">
          Free tier · No credit card · 5 applications on us
        </span>
      </div>
    </div>
  );
}
