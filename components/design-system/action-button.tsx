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
        "inline-flex items-center justify-center gap-2 border font-semibold leading-none whitespace-nowrap transition-all duration-200 ease-out motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-9 px-3 text-xs" : size === "lg" ? "h-12 px-5 text-base" : size === "icon" ? "h-10 w-10 px-0 text-sm aspect-square" : "h-10 px-4 text-sm",
        size === "icon" || size === "sm" ? "rounded-full" : resolvedVariant === "primary" ? "rounded-[24px]" : "rounded-full",
        resolvedVariant === "primary" && "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-[0_14px_34px_var(--color-accent-glow)] hover:brightness-105 hover:shadow-[0_18px_40px_var(--color-accent-glow)]",
        resolvedVariant === "secondary" && cx(mistClasses.control, "text-[var(--color-fg)]"),
        resolvedVariant === "ghost" && "border-[var(--glass-border)] bg-[var(--glass-card-bg)] text-[var(--color-fg)] hover:bg-[var(--glass-control-hover)]",
        resolvedVariant === "success" && "border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
        resolvedVariant === "danger" && "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
        resolvedVariant === "dangerStrong" && "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_34px_var(--color-danger-soft)]",
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? "Loading" : children}
    </button>
  );
}
