"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { useToastStore, type Toast as ToastModel, type ToastVariant } from "@/lib/toast-store";
import { cn } from "@/lib/utils";

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "border-[var(--color-border)] bg-[var(--glass-panel-bg)] text-[var(--color-fg)]",
  success: "border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
  error: "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  info: "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  warning: "border-[var(--color-warn-border)] bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
};

function ToastItem({ id, variant, title, description, duration }: ToastModel) {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = ICONS[variant];

  useEffect(() => {
    const t = setTimeout(() => dismiss(id), duration);
    return () => clearTimeout(t);
  }, [id, duration, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[14px] border p-3.5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.22)] backdrop-blur-md",
        VARIANT_STYLES[variant],
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-tight">{title}</div>
        {description ? <div className="mt-0.5 text-xs leading-snug opacity-80">{description}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(id)}
        aria-label="Dismiss notification"
        className="-m-1 rounded p-1 opacity-60 transition hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
