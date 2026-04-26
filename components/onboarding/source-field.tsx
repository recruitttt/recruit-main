"use client";

import type * as React from "react";
import {
  ActionButton,
  TextField,
  cx,
  mistRadii,
} from "@/components/design-system";
import { canStartSourceRun } from "@/lib/intake/shared/source-state";
import { ProgressBadge } from "@/components/onboarding/progress-badge";
import type { IntakeKind, IntakeRunRow } from "@/app/onboarding/_data";

export function SourceField({
  label,
  icon,
  placeholder,
  value,
  onChange,
  onSubmit,
  submitLabel,
  pending,
  run,
  runKind,
  savedMessage,
  showRunBadge = true,
  disableWhileActive = true,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  run: IntakeRunRow;
  runKind: IntakeKind;
  savedMessage?: string;
  showRunBadge?: boolean;
  disableWhileActive?: boolean;
}) {
  const runActive = run ? !canStartSourceRun(run) : false;
  return (
    <div
      className={cx(
        "space-y-2 border border-white/55 bg-white/30 p-3",
        mistRadii.nested,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[13px] font-semibold text-slate-800">
            {label}
          </span>
        </div>
        {showRunBadge && run && (
          <ProgressBadge kind={runKind} run={run} compact />
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            value={value}
            placeholder={placeholder}
            readOnly={false}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <ActionButton
          variant="secondary"
          size="sm"
          loading={pending || (disableWhileActive && runActive)}
          disabled={
            !value.trim() || pending || (disableWhileActive && runActive)
          }
          onClick={onSubmit}
        >
          {disableWhileActive && runActive ? "Running" : submitLabel}
        </ActionButton>
      </div>
      {savedMessage ? (
        <p className="font-mono text-[11px] leading-5 text-emerald-700">
          {savedMessage}
        </p>
      ) : null}
    </div>
  );
}
