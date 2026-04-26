import type * as React from "react";
import { Loader2 } from "lucide-react";
import { mistClasses } from "./mist-tokens";
import { cx } from "./utils";

export function ActionButton({
  children,
  className = "",
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  secondary,
  variantKey: _variantKey,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger" | "dangerStrong";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  secondary?: boolean;
  variantKey?: string;
}) {
  const resolvedVariant = secondary ? "secondary" : variant;
  void _variantKey;

  return (
    <button
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-9 px-3 text-xs" : size === "lg" ? "h-12 px-5 text-base" : size === "icon" ? "h-10 w-10 px-0 text-sm" : "h-10 px-4 text-sm",
        size === "icon" || size === "sm" ? "rounded-full" : resolvedVariant === "primary" ? "rounded-[24px]" : "rounded-full",
        resolvedVariant === "primary" && "border-[#0F172A] bg-[#0F172A] text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)]",
        resolvedVariant === "secondary" && cx(mistClasses.control, "text-slate-700"),
        resolvedVariant === "ghost" && "border-white/55 bg-white/24 text-slate-700",
        resolvedVariant === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
        resolvedVariant === "danger" && "border-red-500/25 bg-red-500/10 text-red-600",
        resolvedVariant === "dangerStrong" && "border-red-500/40 bg-red-500/12 text-red-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_34px_rgba(239,68,68,0.10)]",
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? "Loading" : children}
    </button>
  );
}
