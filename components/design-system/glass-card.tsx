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
        variant === "selected" && "border-[var(--color-accent)] bg-[var(--color-accent-soft)] ring-1 ring-[var(--color-accent-glow)] shadow-[inset_3px_0_0_rgba(63,122,86,0.42),inset_0_1px_0_rgba(255,255,255,0.6)]",
        variant === "critical" && "border-red-500/30 bg-red-500/10",
        variant === "muted" && "bg-white/28",
        interactive && "transition hover:bg-white/50",
        className,
      )}
    >
      {children}
    </div>
  );
}
