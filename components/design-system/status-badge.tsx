import type * as React from "react";
import { getStatusColor, type StatusTone } from "./mist-tokens";
import { cx } from "./utils";

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
  const color = getStatusColor(tone);
  const isLive = tone === "active" || tone === "accent";

  return (
    <span
      className="inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(15,23,42,0.05)]"
      style={{
        borderColor: `${color}38`,
        background: variant === "solid" ? color : `linear-gradient(180deg, rgba(255,255,255,0.50), ${color}12)`,
        color: variant === "solid" ? "white" : color,
      }}
    >
      {variant === "dot" && (
        <span
          className={cx("h-2 w-2 rounded-full", isLive && "motion-safe:animate-pulse-soft")}
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}55` }}
        />
      )}
      {children}
    </span>
  );
}
