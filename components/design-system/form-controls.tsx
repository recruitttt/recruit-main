import type * as React from "react";
import { Check, ChevronDown, FileText, Upload, X } from "lucide-react";
import { getStatusColor, mistClasses, mistRadii, type StatusTone } from "./mist-tokens";
import { cx } from "./utils";

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
  const inputClass = cx(
    "w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed",
    multiline && "min-h-16 resize-none",
  );

  return (
    <label className={cx("block", rootClassName)}>
      {label && <span className="mb-2 block text-xs font-semibold text-slate-500">{label}</span>}
      <span
        className={cx(
          "flex items-start gap-3 border px-3 text-sm text-slate-700",
          multiline ? "min-h-24 py-3" : "h-11 items-center",
          mistClasses.card,
          state === "error" && "border-red-500/35 bg-red-500/8",
          state === "disabled" && "opacity-55",
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
      {helper && <span className={cx("mt-2 block text-xs", state === "error" ? "text-red-600" : "text-slate-500")}>{helper}</span>}
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
      {label && <span className="mb-2 block text-xs font-semibold text-slate-500">{label}</span>}
      <span className={cx("flex h-10 items-center justify-between border px-3 text-sm text-slate-700", mistClasses.card, state === "error" && "border-red-500/35 bg-red-500/8", state === "disabled" && "opacity-55")}>
        {value}
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </span>
      {helper && <span className={cx("mt-2 block text-xs", state === "error" ? "text-red-600" : "text-slate-500")}>{helper}</span>}
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
    <label className={cx("flex items-center justify-between border px-3 py-3 text-sm text-slate-700", mistClasses.card, disabled && "opacity-55")}>
      <span className="font-semibold">{label}</span>
      <span className={cx("relative h-6 w-11 rounded-full transition", checked ? "bg-[#0EA5E9]" : "bg-slate-400/30")}>
        <span className={cx("absolute top-1 h-4 w-4 rounded-full bg-white transition", checked ? "right-1" : "left-1")} />
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
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  tone?: StatusTone;
}) {
  const color = getStatusColor(tone);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: selected ? `${color}55` : "rgba(255,255,255,0.62)",
        background: selected ? `linear-gradient(180deg, rgba(255,255,255,0.64), ${color}18)` : "linear-gradient(180deg, rgba(255,255,255,0.50), rgba(255,255,255,0.24))",
        boxShadow: selected ? `inset 0 1px 0 rgba(255,255,255,0.82), 0 10px 22px ${color}10` : "inset 0 1px 0 rgba(255,255,255,0.72), 0 8px 18px rgba(15,23,42,0.04)",
        color: selected ? color : "#465568",
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
      {label && <div className={cx("mb-2", mistClasses.sectionLabel)}>{label}</div>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <ChoiceChip key={option} selected={selected.includes(option)} onClick={() => onToggle(option)} tone={multi ? "accent" : "active"}>
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
}: {
  fileName?: string;
  parsing?: boolean;
  onBrowse: () => void;
  onClear?: () => void;
  acceptLabel?: string;
}) {
  if (!fileName) {
    return (
      <button
        type="button"
        onClick={onBrowse}
        className={cx("flex w-full items-center gap-3 border border-dashed border-white/70 bg-white/34 px-4 py-5 text-left text-slate-700 transition hover:border-sky-400/55 hover:bg-white/48", mistRadii.nested)}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/50 text-slate-500">
          <Upload className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">Drop your resume or click to upload</span>
          <span className="mt-1 block font-mono text-[11px] text-slate-500">{acceptLabel}</span>
        </span>
      </button>
    );
  }

  return (
    <div className={cx("flex items-center gap-3 border border-white/55 bg-white/34 px-4 py-3", mistRadii.nested)}>
      <FileText className="h-4 w-4 shrink-0 text-sky-500" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-800">{fileName}</div>
        <div className="font-mono text-[11px] text-slate-500">{parsing ? "Parsing resume..." : "Ready"}</div>
      </div>
      {parsing ? (
        <div className="h-3 w-3 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
      ) : (
        <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
      )}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/55 bg-white/32 text-slate-500 transition hover:bg-white/55 hover:text-slate-800"
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
    <div className={cx("flex items-center gap-2", className)}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full border border-white/45 bg-white/36 shadow-inner">
        <div className="h-full rounded-full bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.45)] transition-[width] duration-500" style={{ width }} />
      </div>
      {label && <span className="font-mono text-[11px] tabular-nums text-slate-500">{label}</span>}
    </div>
  );
}
