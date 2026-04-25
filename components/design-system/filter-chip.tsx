import type * as React from "react";
import { X, type LucideIcon } from "lucide-react";
import { getStatusColor, type StatusTone } from "./mist-tokens";
import { cx } from "./utils";

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
  const color = getStatusColor(tone);
  const isPillow = mode === "pillow" || mode === "score";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border font-semibold",
        isPillow ? "min-h-10 gap-2.5 py-1 pl-2 pr-3 text-sm" : "min-h-8 gap-2 px-3 text-xs",
      )}
      style={{
        borderColor: mode === "pillow" ? "rgba(255,255,255,0.78)" : `${color}38`,
        background:
          mode === "pillow"
            ? `linear-gradient(180deg, rgba(255,255,255,0.78), ${color}14)`
            : `linear-gradient(180deg, rgba(255,255,255,0.50), ${color}12)`,
        boxShadow:
          mode === "pillow"
            ? `inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 32px rgba(15,23,42,0.08), 0 0 0 1px ${color}10`
            : "inset 0 1px 0 rgba(255,255,255,0.72), 0 8px 18px rgba(15,23,42,0.05)",
        color,
      }}
    >
      {(mode === "dot" || mode === "filter") && !Icon && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}55` }} />
      )}
      {Icon && mode !== "dot" && (
        <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full border", isPillow ? "h-7 w-7" : "h-5 w-5")} style={{ borderColor: `${color}24`, background: "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.38))" }}>
          <Icon className={isPillow ? "h-3.5 w-3.5" : "h-3 w-3"} strokeWidth={2} />
        </span>
      )}
      <span className={mode === "filter" ? "text-slate-700" : undefined}>{label}</span>
      {meta && <span className="font-mono text-[11px] opacity-70">{meta}</span>}
      {mode === "filter" && (
        <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/60 bg-white/40 text-slate-500">
          <X className="h-3 w-3" />
        </span>
      )}
    </span>
  );
}
