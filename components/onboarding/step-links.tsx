"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { GithubIcon, LinkedinIcon, XIcon, DevpostIcon } from "@/components/ui/brand-icons";
import { cn } from "@/lib/utils";

type LinkProvider = {
  key: "github" | "linkedin" | "twitter" | "devpost";
  label: string;
  prefix: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
};

const providers: LinkProvider[] = [
  { key: "github", label: "GitHub", prefix: "github.com/", icon: GithubIcon, placeholder: "yourhandle" },
  { key: "linkedin", label: "LinkedIn", prefix: "linkedin.com/in/", icon: LinkedinIcon, placeholder: "yourhandle" },
  { key: "twitter", label: "X / Twitter", prefix: "x.com/", icon: XIcon, placeholder: "yourhandle" },
  { key: "devpost", label: "DevPost", prefix: "devpost.com/", icon: DevpostIcon, placeholder: "yourhandle" },
];

export function StepLinks({
  defaults,
  onBack,
  onNext,
}: {
  defaults: Record<string, string>;
  onBack: () => void;
  onNext: (data: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(defaults);

  const filled = Object.values(values).filter((v) => v && v.trim().length > 0).length;

  return (
    <div>
      <div className="mb-10">
        <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)] font-mono">
          Step 03 · Links
        </div>
        <h1 className="font-serif text-[44px] leading-[1.05] tracking-tight text-[var(--color-fg)]">
          Where else do you live online?
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-md">
          Auto-fills the link fields on every application. Skip any you don't use — we won't invent ones you don't have.
        </p>
      </div>

      <div className="space-y-3">
        {providers.map((p) => {
          const filled = values[p.key] && values[p.key].trim().length > 0;
          return (
            <div
              key={p.key}
              className={cn(
                "flex items-center gap-3 rounded-md border bg-[var(--color-surface)] px-3.5 py-3 transition-colors focus-within:border-[var(--color-accent)] focus-within:bg-[var(--color-surface-1)]",
                filled ? "border-[var(--color-border-strong)]" : "border-[var(--color-border)]"
              )}
            >
              <p.icon className={cn("h-4 w-4 shrink-0", filled ? "text-[var(--color-accent)]" : "text-[var(--color-fg-subtle)]")} />
              <div className="text-[13px] text-[var(--color-fg-subtle)] font-mono shrink-0 tabular-nums">
                {p.prefix}
              </div>
              <input
                value={values[p.key] || ""}
                onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
                placeholder={p.placeholder}
                className="w-full bg-transparent text-[13px] font-mono text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none"
              />
              {filled && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={3} />}
            </div>
          );
        })}
      </div>

      <div className="mt-5 text-[12px] text-[var(--color-fg-subtle)] font-mono">
        {filled} of 4 added · {4 - filled} optional
      </div>

      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button variant="primary" size="lg" onClick={() => onNext(values)}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
