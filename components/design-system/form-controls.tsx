import type * as React from "react";
import { ChevronDown } from "lucide-react";
import { mistClasses } from "./mist-tokens";
import { cx } from "./utils";

export function TextField({
  label,
  value,
  placeholder,
  icon,
  multiline = false,
  state = "default",
  helper,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  multiline?: boolean;
  state?: "default" | "error" | "disabled" | "loading";
  helper?: string;
}) {
  const inputClass = cx(
    "w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed",
    multiline && "min-h-16 resize-none",
  );

  return (
    <label className="block">
      {label && <span className="mb-2 block text-xs font-semibold text-slate-500">{label}</span>}
      <span
        className={cx(
          "flex items-start gap-3 border px-3 text-sm text-slate-700",
          multiline ? "min-h-24 py-3" : "h-11 items-center",
          mistClasses.card,
          state === "error" && "border-red-500/35 bg-red-500/8",
          state === "disabled" && "opacity-55",
        )}
      >
        {icon}
        {multiline ? (
          <textarea className={inputClass} value={value ?? ""} placeholder={placeholder} disabled={state === "disabled" || state === "loading"} readOnly />
        ) : (
          <input className={inputClass} value={value ?? ""} placeholder={placeholder} disabled={state === "disabled" || state === "loading"} readOnly />
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
