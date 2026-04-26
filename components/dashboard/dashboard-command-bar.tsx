"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowUp,
  Loader2,
  MessageSquareText,
  Sparkles,
  X,
} from "lucide-react";
import { ActionButton, cx, mistClasses } from "@/components/design-system";

export type DashboardCommandStatus = "idle" | "loading" | "success" | "error";

export type DashboardCommandResult = {
  title?: string;
  body: ReactNode;
  meta?: string;
};

export type DashboardCommandBarProps = {
  placeholder?: string;
  status?: DashboardCommandStatus;
  error?: string | null;
  result?: DashboardCommandResult | null;
  defaultOpen?: boolean;
  pinned?: boolean;
  disabled?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: (command: string) => void | Promise<void>;
  onClearResult?: () => void;
};

export function DashboardCommandBar({
  placeholder = "Ask Recruit to find, rank, tailor, or explain applications...",
  status = "idle",
  error,
  result,
  disabled = false,
  value,
  onValueChange,
  onSubmit,
  onClearResult,
}: DashboardCommandBarProps) {
  const inputId = useId();
  const [mounted, setMounted] = useState(false);
  const [internalValue, setInternalValue] = useState("");
  const command = value ?? internalValue;
  const loading = status === "loading";
  const canSubmit = command.trim().length > 0 && !loading && !disabled;
  const statusText = loading
    ? "Working"
    : status === "error"
      ? error ?? "Try again"
      : result
        ? result.title ?? "Done"
        : null;

  function setCommand(next: string) {
    setInternalValue(next);
    onValueChange?.(next);
  }

  async function submit(nextCommand = command) {
    const trimmed = nextCommand.trim();
    if (!trimmed || loading || disabled) return;
    await onSubmit?.(trimmed);
    setCommand("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const bar = (
    <div
      className="pointer-events-none fixed inset-x-0 z-[80] px-3 sm:px-5"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto mx-auto w-full max-w-4xl"
      >
        <AnimatePresence initial={false}>
          {(result || error) && !loading ? (
            <motion.div
              key={error ? "error" : "result"}
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              role={error ? "alert" : "status"}
              aria-live={error ? "assertive" : "polite"}
              className="mb-2 grid max-h-[32vh] grid-cols-[auto_minmax(0,1fr)_auto] gap-3 overflow-auto rounded-[18px] border border-[var(--dashboard-command-border)] bg-[var(--dashboard-command-bg)] px-3 py-3 text-sm text-[var(--color-fg)] shadow-[0_18px_44px_rgba(2,8,6,0.14)] backdrop-blur-2xl sm:px-4"
            >
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--dashboard-command-border)] bg-[var(--dashboard-control-bg)] text-[#8E7EA8]">
                {error ? <AlertCircle className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
                  {error ? "Command failed" : result?.title ?? "Command result"}
                </div>
                <div className="mt-1 min-w-0 text-sm leading-6 text-[var(--color-fg)]">
                  {error ?? result?.body}
                </div>
                {result?.meta && !error ? (
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
                    {result.meta}
                  </div>
                ) : null}
              </div>
              {onClearResult ? (
                <button
                  type="button"
                  onClick={onClearResult}
                  aria-label="Clear command result"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-fg-subtle)] transition hover:bg-[var(--glass-control-hover)] hover:text-[var(--color-fg)]"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <form
          onSubmit={handleSubmit}
          className={cx(
            "grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border border-[var(--dashboard-command-border)] bg-[var(--dashboard-command-bg)] px-2.5 py-2 shadow-[0_20px_54px_rgba(2,8,6,0.16)] backdrop-blur-2xl sm:gap-3 sm:px-3",
            mistClasses.control,
          )}
        >
          <div
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--dashboard-command-border)] bg-[var(--dashboard-control-bg)] text-[#8E7EA8]"
          >
            {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles className="h-[18px] w-[18px]" />}
          </div>

          <label htmlFor={inputId} className="sr-only">
            Dashboard command
          </label>
          <input
            id={inputId}
            value={command}
            disabled={disabled}
            onChange={(event) => setCommand(event.target.value)}
            placeholder={placeholder}
            className="min-w-0 bg-transparent text-sm font-medium text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
          />

          {statusText ? (
            <div className="hidden max-w-[160px] items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-control-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-fg-muted)] sm:flex">
              <span className="truncate">{statusText}</span>
              {onClearResult && !loading ? (
                <button
                  type="button"
                  onClick={onClearResult}
                  aria-label="Clear command status"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--color-fg-subtle)] transition hover:bg-[var(--glass-control-hover)] hover:text-[var(--color-fg)]"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ) : null}

          <ActionButton
            type="submit"
            variant="primary"
            size="icon"
            disabled={!canSubmit}
            aria-label="Run dashboard command"
            className="bg-[var(--dashboard-command-button-bg)] text-white hover:bg-[var(--dashboard-command-button-hover)]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </ActionButton>
        </form>
      </motion.div>
    </div>
  );

  return mounted ? createPortal(bar, document.body) : null;
}
