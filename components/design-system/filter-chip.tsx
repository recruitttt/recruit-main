import type * as React from "react";
import { X, type LucideIcon } from "lucide-react";
import type { StatusTone } from "./mist-tokens";
import { cx } from "./utils";

const TONE_VAR: Record<StatusTone, string> = {
  active: "--color-accent",
  accent: "--color-accent",
  success: "--color-success",
  warning: "--color-warn",
  danger: "--color-danger",
  neutral: "--color-fg-subtle",
  locked: "--color-fg-muted",
};

export function FilterChip({
  label,
  tone = "accent",
  icon: Icon,
  mode = "dot",
  meta,
}: {
  label: string;
  tone?: StatusTone;
  icon?: LucideIcon;
  mode?: "dot" | "icon" | "pillow" | "score" | "filter";
  meta?: string;
  variantKey?: string;
}) {
  const color = `var(${TONE_VAR[tone]})`;
  const isPillow = mode === "pillow" || mode === "score";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border font-semibold",
        isPillow ? "min-h-10 gap-2.5 py-1 pl-2 pr-3 text-sm" : "min-h-8 gap-2 px-3 text-xs",
      )}
      style={{
        borderColor:
          mode === "pillow"
            ? "var(--glass-border)"
            : `color-mix(in oklab, ${color} 30%, transparent)`,
        background:
          mode === "pillow"
            ? `linear-gradient(180deg, var(--theme-compat-bg-strong), color-mix(in oklab, ${color} 14%, transparent))`
            : `linear-gradient(180deg, var(--theme-compat-bg), color-mix(in oklab, ${color} 12%, transparent))`,
        boxShadow:
          mode === "pillow"
            ? `var(--theme-card-inset-shadow), 0 14px 32px rgba(15,23,42,0.08), 0 0 0 1px color-mix(in oklab, ${color} 10%, transparent)`
            : "var(--theme-card-inset-shadow), 0 8px 18px rgba(15,23,42,0.05)",
        color,
      }}
    >
      {(mode === "dot" || mode === "filter") && !Icon && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}55` }} />
      )}
      {Icon && mode !== "dot" && (
        <span
          className={cx("inline-flex shrink-0 items-center justify-center rounded-full border", isPillow ? "h-7 w-7" : "h-5 w-5")}
          style={{
            borderColor: `color-mix(in oklab, ${color} 24%, transparent)`,
            background: "linear-gradient(180deg, var(--theme-compat-bg-strong), var(--theme-compat-bg-soft))",
          }}
        >
          <Icon className={isPillow ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={2} />
        </span>
      )}
      <span className={mode === "filter" ? "text-[var(--color-fg)]" : undefined}>{label}</span>
      {meta && <span className="font-mono text-[11px] opacity-70">{meta}</span>}
      {mode === "filter" && (
        <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-control-bg)] text-[var(--color-fg-subtle)]">
          <X className="h-3 w-3" />
        </span>
      )}
    </span>
  );
}
