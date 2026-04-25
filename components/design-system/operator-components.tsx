import type * as React from "react";
import { FileText, MonitorPlay, Paperclip } from "lucide-react";
import { getStatusColor, mistClasses, mistRadii, type StatusTone } from "./mist-tokens";
import { cx } from "./utils";

export function RunStatusIndicator({
  state,
  label,
  meta,
}: {
  state: "running" | "paused" | "blocked" | "completed" | "stopped";
  label: string;
  meta?: string;
}) {
  const tone: StatusTone = state === "running" ? "accent" : state === "completed" ? "success" : state === "blocked" ? "danger" : state === "paused" ? "warning" : "neutral";
  const color = getStatusColor(tone);

  return (
    <div className={cx("flex items-center justify-between border border-white/55 bg-white/30 px-3 py-2.5", mistRadii.nested)}>
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}55` }} />
        <span>
          <span className="block text-sm font-semibold text-slate-950">{label}</span>
          {meta && <span className="block text-xs text-slate-500">{meta}</span>}
        </span>
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color }}>{state}</span>
    </div>
  );
}

export function ArtifactCard({
  title,
  meta,
  type = "file",
}: {
  title: string;
  meta: string;
  type?: "file" | "preview" | "attachment";
}) {
  const Icon = type === "preview" ? MonitorPlay : type === "attachment" ? Paperclip : FileText;

  return (
    <div className={cx("flex items-center justify-between px-3 py-3 text-sm", mistClasses.card)}>
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="truncate font-semibold text-slate-700">{title}</span>
      </div>
      <span className="shrink-0 text-slate-500">{meta}</span>
    </div>
  );
}

export function BrowserPreview({ children }: { children?: React.ReactNode }) {
  return (
    <div className={cx("border border-white/55 bg-slate-900/12 p-3", mistRadii.nested)}>
      <div className="mb-3 flex items-center gap-2 rounded-full border border-white/45 bg-white/32 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate font-mono text-[10px] text-slate-400">greenhouse.io/linear/senior-product-manager</span>
      </div>
      <div className="min-h-52 rounded-[16px] border border-white/45 bg-white/26 p-4">
        {children ?? <div className="flex h-44 items-center justify-center text-sm font-semibold text-slate-500">live browser preview</div>}
      </div>
    </div>
  );
}
