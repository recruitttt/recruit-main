"use client";

import { Check, Loader2, X } from "lucide-react";
import { cx } from "@/components/design-system";
import {
  SOURCE_NAME,
  type IntakeKind,
  type IntakeRunRow,
} from "@/app/onboarding/_data";

export function ProgressBadge({
  kind,
  run,
  compact = false,
}: {
  kind: IntakeKind;
  run: NonNullable<IntakeRunRow>;
  compact?: boolean;
}) {
  const events = Array.isArray(run.events) ? run.events : [];
  const latest = events[events.length - 1];
  const status = run.status;

  const tone =
    status === "failed"
      ? "border-red-200/70 bg-red-50/60 text-red-700"
      : status === "completed"
        ? "border-emerald-200/70 bg-emerald-50/60 text-emerald-700"
        : "border-sky-200/70 bg-sky-50/60 text-sky-700";

  const Icon = status === "failed" ? X : status === "completed" ? Check : Loader2;

  const message =
    status === "failed"
      ? (run.error ?? "Failed")
      : latest?.message
        ? `${SOURCE_NAME[kind]}: ${latest.message}`
        : status === "completed"
          ? `${SOURCE_NAME[kind]} synced`
          : `${SOURCE_NAME[kind]}: starting…`;

  const progress =
    typeof latest?.done === "number" &&
    typeof latest?.total === "number" &&
    latest.total > 0
      ? ` (${latest.done}/${latest.total})`
      : "";

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5",
        compact ? "py-0.5 text-[10px]" : "py-1 text-[11px]",
        tone,
      )}
      title={message}
    >
      <Icon
        className={cx(
          compact ? "h-3 w-3" : "h-3.5 w-3.5",
          status === "running" || status === "queued" ? "animate-spin" : "",
        )}
      />
      <span className="truncate font-mono">
        {message}
        {progress}
      </span>
    </span>
  );
}
