import type * as React from "react";
import { Check, ChevronDown, FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { mistClasses, mistRadii, type StatusTone } from "./mist-tokens";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-glow)] focus-visible:ring-offset-1";
const FOCUS_WITHIN_RING = "focus-within:ring-2 focus-within:ring-[var(--color-accent-glow)] focus-within:ring-offset-1";
const DISABLED_OPACITY = "opacity-65";
const TONE_VAR: Record<StatusTone, string> = {
  active: "--color-accent",
  accent: "--color-accent",
  success: "--color-success",
  warning: "--color-warn",
  danger: "--color-danger",
  neutral: "--color-fg-subtle",
  locked: "--color-fg-muted",
};

export function TextField({
  label,
  value,
  placeholder,
  icon,
  multiline = false,
  state = "default",
  helper,
  type = "text",
  name,
  autoFocus = false,
  required = false,
  readOnly = true,
  onChange,
  onKeyDown,
  inputRef,
  className = "",
  rootClassName = "",
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  multiline?: boolean;
  state?: "default" | "error" | "disabled" | "loading";
  helper?: string;
  type?: React.HTMLInputTypeAttribute;
  name?: string;
  autoFocus?: boolean;
  required?: boolean;
  readOnly?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
  className?: string;
  rootClassName?: string;
}) {
  const inputClass = cn(
    "w-full bg-transparent text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] disabled:cursor-not-allowed",
    FOCUS_RING,
    multiline ? "min-h-16 resize-none leading-snug placeholder:leading-snug" : "leading-none placeholder:leading-none",
  );

  return (
    <label className={cn("block", rootClassName)}>
      {label && <span className="mb-2 block text-xs font-semibold text-[var(--color-fg-muted)]">{label}</span>}
      <span
        className={cn(
          "flex gap-3 border px-3 text-sm text-[var(--color-fg)] transition",
          FOCUS_WITHIN_RING,
          multiline ? "min-h-24 items-start py-3" : "h-11 items-center",
          mistClasses.card,
          state === "error" && "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]",
          state === "disabled" && DISABLED_OPACITY,
          className,
        )}
      >
        {icon}
        {multiline ? (
          <textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            className={inputClass}
            value={value ?? ""}
            placeholder={placeholder}
            name={name}
            autoFocus={autoFocus}
            required={required}
            disabled={state === "disabled" || state === "loading"}
            readOnly={readOnly}
            onChange={onChange}
            onKeyDown={onKeyDown}
          />
        ) : (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            className={inputClass}
            value={value ?? ""}
            placeholder={placeholder}
            type={type}
            name={name}
            autoFocus={autoFocus}
            required={required}
            disabled={state === "disabled" || state === "loading"}
            readOnly={readOnly}
            onChange={onChange}
            onKeyDown={onKeyDown}
          />
        )}
      </span>
      {helper && (
        <span className={cn("mt-2 block text-xs leading-tight", state === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-fg-subtle)]")}>
          {helper}
        </span>
      )}
    </label>
  );
}

export function SelectField({
  label,
  value,
  state = "default",
  helper,
}: {
  label?: string;
  value: string;
  state?: "default" | "error" | "disabled";
  helper?: string;
}) {
  return (
    <label className="block">
      {label && <span className="mb-2 block text-xs font-semibold text-[var(--color-fg-muted)]">{label}</span>}
      <span
        className={cn(
          "flex h-10 items-center justify-between border px-3 text-sm leading-none text-[var(--color-fg)] transition",
          FOCUS_WITHIN_RING,
          mistClasses.card,
          state === "error" && "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]",
          state === "disabled" && DISABLED_OPACITY,
        )}
      >
        {value}
        <ChevronDown className="h-4 w-4 text-[var(--color-fg-subtle)]" />
      </span>
      {helper && (
        <span className={cn("mt-2 block text-xs leading-tight", state === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-fg-subtle)]")}>
          {helper}
        </span>
      )}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between border px-3 py-3 text-sm leading-none text-[var(--color-fg)] transition",
        FOCUS_WITHIN_RING,
        mistClasses.card,
        disabled && DISABLED_OPACITY,
      )}
    >
      <span className="font-semibold leading-none">{label}</span>
      <span className={cn("relative h-6 w-11 rounded-full transition", checked ? "bg-[var(--color-accent)]" : "bg-[var(--glass-control-bg)]")}>
        <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-[var(--color-surface)] transition", checked ? "right-1" : "left-1")} />
      </span>
    </label>
  );
}

export function ChoiceChip({
  children,
  selected = false,
  onClick,
  disabled = false,
  tone = "accent",
  ariaLabel,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  tone?: StatusTone;
  ariaLabel?: string;
}) {
  const color = `var(${TONE_VAR[tone]})`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold leading-none transition disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS_RING,
      )}
      style={{
        borderColor: selected
          ? `color-mix(in oklab, ${color} 36%, transparent)`
          : "var(--glass-border)",
        background: selected
          ? `linear-gradient(180deg, color-mix(in oklab, ${color} 18%, transparent), color-mix(in oklab, ${color} 8%, transparent))`
          : "linear-gradient(180deg, var(--theme-compat-bg), var(--theme-compat-bg-soft))",
        boxShadow: selected
          ? `inset 0 2px 4px rgba(15,23,42,0.10), inset 0 0 0 1px color-mix(in oklab, ${color} 16%, transparent)`
          : "var(--theme-card-inset-shadow), 0 8px 18px rgba(15,23,42,0.04)",
        color: selected ? color : "var(--color-fg-muted)",
      }}
    >
      {selected && <Check className="h-3 w-3" strokeWidth={2.5} />}
      {children}
    </button>
  );
}

export function ChoiceChipGroup({
  label,
  options,
  selected,
  multi = false,
  onToggle,
}: {
  label?: string;
  options: string[];
  selected: string[];
  multi?: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      {label && <div className={cn("mb-2", mistClasses.sectionLabel)}>{label}</div>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <ChoiceChip
            key={option}
            selected={selected.includes(option)}
            onClick={() => onToggle(option)}
            tone={multi ? "accent" : "active"}
            ariaLabel={option}
          >
            {option}
          </ChoiceChip>
        ))}
      </div>
    </div>
  );
}

export function FileUploadControl({
  fileName,
  parsing = false,
  onBrowse,
  onClear,
  acceptLabel = "PDF, DOCX · up to 10 MB",
  ariaLabel,
}: {
  fileName?: string;
  parsing?: boolean;
  onBrowse: () => void;
  onClear?: () => void;
  acceptLabel?: string;
  ariaLabel?: string;
}) {
  if (!fileName) {
    return (
      <button
        type="button"
        onClick={onBrowse}
        aria-label={ariaLabel ?? "Upload resume"}
        className={cn(
          "flex w-full items-center gap-3 border border-dashed border-[var(--glass-border)] bg-[var(--glass-card-bg)] px-4 py-5 text-left leading-none text-[var(--color-fg)] transition hover:border-[var(--color-accent)] hover:bg-[var(--glass-control-hover)]",
          FOCUS_RING,
          mistRadii.nested,
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-control-bg)] text-[var(--color-fg-subtle)]">
          <Upload className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-none text-[var(--color-fg)]">Drop your resume or click to upload</span>
          <span className="mt-1 block font-mono text-[11px] leading-none text-[var(--color-fg-subtle)]">{acceptLabel}</span>
        </span>
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 border border-[var(--glass-border)] bg-[var(--glass-card-bg)] px-4 py-3 leading-none", mistRadii.nested)}>
      <FileText className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-none text-[var(--color-fg)]">{fileName}</div>
        <div className="mt-1 font-mono text-[11px] leading-none text-[var(--color-fg-subtle)]">{parsing ? "Parsing resume..." : "Ready"}</div>
      </div>
      {parsing ? (
        <div className="h-3 w-3 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
      ) : (
        <Check className="h-4 w-4 text-[var(--color-success)]" strokeWidth={2.5} />
      )}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-control-bg)] text-[var(--color-fg-subtle)] transition hover:bg-[var(--glass-control-hover)] hover:text-[var(--color-fg)]",
            FOCUS_RING,
          )}
          aria-label="Remove resume"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function ProgressMeter({ value, label, className = "" }: { value: number; label?: string; className?: string }) {
  const width = `${Math.max(0, Math.min(1, value)) * 100}%`;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full border border-[var(--glass-border)] bg-[var(--glass-control-bg)] shadow-inner">
        <div className="h-full rounded-full bg-[var(--color-accent)] shadow-[0_0_18px_rgba(63,122,86,0.35)] transition-[width] duration-500" style={{ width }} />
      </div>
      {label && <span className="font-mono text-[11px] leading-none tabular-nums text-[var(--color-fg-subtle)]">{label}</span>}
    </div>
  );
}
