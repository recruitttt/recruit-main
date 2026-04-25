import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function StepProgress({
  current,
  steps,
}: {
  current: number;
  steps: { label: string }[];
}) {
  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-mono transition-colors",
                  done && "bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-bg)]",
                  active && "bg-[var(--color-surface-1)] border-[var(--color-accent)] text-[var(--color-accent)]",
                  !done && !active && "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg-subtle)]"
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : String(i + 1).padStart(2, "0")}
              </div>
              <span
                className={cn(
                  "text-[11px] uppercase tracking-[0.15em] font-mono transition-colors hidden md:inline",
                  done && "text-[var(--color-fg-muted)]",
                  active && "text-[var(--color-fg)]",
                  !done && !active && "text-[var(--color-fg-subtle)]"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-6 md:w-10 transition-colors",
                  done ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
