import type * as React from "react";
import { mistClasses } from "./mist-tokens";
import { cx } from "./utils";

export function GlassCard({
  children,
  className = "",
  variant = "default",
  density = "normal",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "selected" | "critical" | "muted";
  density?: "compact" | "normal" | "spacious";
  interactive?: boolean;
}) {
  return (
    <div
      className={cx(
        "min-w-0",
        mistClasses.card,
        density === "compact" ? "p-3" : density === "spacious" ? "p-5" : "p-4",
        variant === "selected" && "border-[var(--color-accent)] bg-[var(--color-accent-soft)] ring-1 ring-[var(--color-accent-glow)] shadow-[inset_3px_0_0_var(--color-accent-glow),var(--theme-card-inset-shadow)]",
        variant === "critical" && "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]",
        variant === "muted" && "bg-[var(--theme-compat-bg-soft)]",
        interactive && "transition hover:bg-[var(--glass-control-hover)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
