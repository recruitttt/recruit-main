import type * as React from "react";
import type { StatusTone } from "./mist-tokens";

const TONE_VAR: Record<StatusTone, string> = {
  active: "--color-accent",
  accent: "--color-accent",
  success: "--color-success",
  warning: "--color-warn",
  danger: "--color-danger",
  neutral: "--color-fg-subtle",
  locked: "--color-fg-muted",
};

export function StatusBadge({
  children,
  tone = "accent",
  variant = "dot",
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  variant?: "dot" | "soft" | "solid";
  variantKey?: string;
}) {
  const color = `var(${TONE_VAR[tone]})`;

  return (
    <span
      className="inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(15,23,42,0.05)]"
      style={{
        borderColor: `color-mix(in oklab, ${color} 30%, transparent)`,
        background:
          variant === "solid"
            ? color
            : `linear-gradient(180deg, var(--theme-compat-bg), color-mix(in oklab, ${color} 12%, transparent))`,
        color: variant === "solid" ? "var(--color-bg)" : color,
      }}
    >
      {variant === "dot" && (
        <span
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 8px color-mix(in oklab, ${color} 55%, transparent)`,
          }}
        />
      )}
      {children}
    </span>
  );
}
