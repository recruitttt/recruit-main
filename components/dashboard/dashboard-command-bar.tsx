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
            "relative grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden border border-[var(--dashboard-command-border)] bg-[var(--dashboard-command-bg)] px-2.5 py-2 shadow-[0_20px_54px_rgba(2,8,6,0.16)] backdrop-blur-2xl sm:min-h-[60px] sm:gap-2.5 sm:px-3",
            mistClasses.control,
          )}
        >
          {loading ? (
            <motion.div
              aria-hidden="true"
              className="absolute inset-x-5 bottom-1 h-0.5 overflow-hidden rounded-full bg-[var(--dashboard-control-bg)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="h-full w-1/3 rounded-full bg-[var(--dashboard-command-button-bg)]"
                animate={{ x: ["-120%", "330%"] }}
                transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          ) : null}
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--dashboard-command-border)] bg-[var(--dashboard-control-bg)] text-[#8E7EA8] sm:h-10 sm:w-10"
          >
            <Sparkles className="h-[18px] w-[18px]" />
          </div>

          <label htmlFor={inputId} className="sr-only">
            Dashboard command
          </label>
          <input
            id={inputId}
            value={command}
            disabled={disabled || loading}
            onChange={(event) => setCommand(event.target.value)}
            placeholder={placeholder}
            className="h-10 min-w-0 appearance-none border-0 bg-transparent px-0 text-sm font-medium leading-none text-[var(--color-fg)] shadow-none outline-none ring-0 placeholder:text-[var(--color-fg-subtle)] focus:border-0 focus:outline-none focus:ring-0 disabled:cursor-progress disabled:opacity-80 sm:text-base"
          />

          <div className="flex min-w-0 items-center justify-end gap-2">
            {loading ? (
              <div
                role="status"
                aria-live="polite"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--dashboard-command-border)] bg-[var(--dashboard-control-bg)] px-3 text-xs font-semibold text-[var(--color-fg-muted)]"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Working</span>
              </div>
            ) : statusText ? (
              <div className="hidden max-w-[160px] items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-control-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-fg-muted)] sm:flex">
                <span className="truncate">{statusText}</span>
                {onClearResult ? (
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

            {!loading ? (
              <ActionButton
                type="submit"
                variant="primary"
                size="icon"
                disabled={!canSubmit}
                aria-label="Run dashboard command"
                className="bg-[var(--dashboard-command-button-bg)] text-[var(--dashboard-command-button-fg)] hover:bg-[var(--dashboard-command-button-hover)]"
              >
                <ArrowUp className="h-4 w-4" />
              </ActionButton>
            ) : null}
          </div>
        </form>
      </motion.div>
    </div>
  );

  return mounted ? createPortal(bar, document.body) : null;
}
