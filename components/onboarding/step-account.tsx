"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, AtSign, User } from "lucide-react";
import { GithubIcon } from "@/components/ui/brand-icons";

export function StepAccount({
  defaults,
  onNext,
}: {
  defaults: { name?: string; email?: string };
  onNext: (data: { name: string; email: string }) => void;
}) {
  const [name, setName] = useState(defaults.name || "");
  const [email, setEmail] = useState(defaults.email || "");

  const valid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email);

  return (
    <div>
      <div className="mb-10">
        <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)] font-mono">
          Step 01 · Account
        </div>
        <h1 className="font-serif text-[44px] leading-[1.05] tracking-tight text-[var(--color-fg)]">
          First, who are you?
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-muted)] max-w-md">
          We'll use this to set up your account and address you on every cover letter the agent writes.
        </p>
      </div>

      <div className="space-y-5">
        <Field label="Full name" icon={User}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mo Hoshir"
            autoFocus
            className="w-full bg-transparent text-[15px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none"
          />
        </Field>

        <Field label="Email" icon={AtSign}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="w-full bg-transparent text-[15px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none"
          />
        </Field>

        <div className="pt-2">
          <button className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-1)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] transition-colors cursor-pointer">
            <GithubIcon className="h-4 w-4" />
            Continue with GitHub
          </button>
        </div>
      </div>

      <div className="mt-10 flex justify-end">
        <Button
          variant="primary"
          size="lg"
          disabled={!valid}
          onClick={() => onNext({ name, email })}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
        {label}
      </div>
      <div className="flex items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 transition-colors focus-within:border-[var(--color-accent)] focus-within:bg-[var(--color-surface-1)]">
        <Icon className="h-4 w-4 shrink-0 text-[var(--color-fg-subtle)]" />
        {children}
      </div>
    </label>
  );
}
