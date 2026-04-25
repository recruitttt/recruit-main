"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Question = {
  key: string;
  label: string;
  helper?: string;
  options: string[];
  multi?: boolean;
};

const questions: Question[] = [
  {
    key: "roles",
    label: "What roles should we apply to?",
    helper: "Pick as many as you'd consider.",
    multi: true,
    options: ["Software Engineer", "Product Engineer", "Design Engineer", "Frontend", "Full-Stack", "ML / AI", "Founding Engineer"],
  },
  {
    key: "location",
    label: "Where are you open to working?",
    multi: true,
    options: ["Remote · Worldwide", "Remote · Americas", "San Francisco", "New York", "Seattle", "Other"],
  },
  {
    key: "work_auth",
    label: "Are you legally authorized to work in the US?",
    options: ["Yes", "No, I'd need sponsorship", "I'm a US citizen / permanent resident"],
  },
  {
    key: "salary",
    label: "What's your minimum acceptable salary?",
    helper: "Sets the floor — the agent never wastes time on roles below this.",
    options: ["$120k+", "$160k+", "$200k+", "$240k+", "Open"],
  },
  {
    key: "company_size",
    label: "What size company excites you?",
    multi: true,
    options: ["Pre-seed / seed (1-15)", "Series A/B (15-100)", "Series C+ (100-500)", "Public (500+)"],
  },
];

export function StepQuestionnaire({
  defaults,
  onBack,
  onNext,
}: {
  defaults: Record<string, string[]>;
  onBack: () => void;
  onNext: (data: Record<string, string[]>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(defaults);

  function toggle(qKey: string, opt: string, multi: boolean) {
    setAnswers((prev) => {
      const cur = prev[qKey] || [];
      if (multi) {
        return { ...prev, [qKey]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
      }
      return { ...prev, [qKey]: [opt] };
    });
  }

  const allAnswered = questions.every((q) => (answers[q.key] || []).length > 0);

  return (
    <div>
      <div className="mb-10">
        <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)] font-mono">
          Step 04 · Preferences
        </div>
        <h1 className="font-serif text-[44px] leading-[1.05] tracking-tight text-[var(--color-fg)]">
          What are you looking for?
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-md">
          The agent will only apply to roles that match these. Change them anytime in settings.
        </p>
      </div>

      <div className="space-y-9">
        {questions.map((q, qi) => (
          <div key={q.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-medium tracking-tight text-[var(--color-fg)]">
                <span className="text-[var(--color-fg-subtle)] font-mono mr-2">0{qi + 1}.</span>
                {q.label}
              </h3>
              {q.multi && (
                <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono shrink-0">
                  Multi
                </span>
              )}
            </div>
            {q.helper && (
              <p className="mb-3 text-[13px] text-[var(--color-fg-muted)]">
                {q.helper}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const selected = (answers[q.key] || []).includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(q.key, opt, !!q.multi)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-[13px] transition-all cursor-pointer",
                      selected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button variant="accent" size="lg" disabled={!allAnswered} onClick={() => onNext(answers)}>
          Activate agent
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
