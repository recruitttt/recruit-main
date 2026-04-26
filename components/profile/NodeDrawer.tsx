"use client";

//
// NodeDrawer — translucent side drawer that displays the full data for a
// selected graph node. Backdrop click + escape close. The shape of `data`
// is the original source object that produced the node (UserProfile, repo
// summary blob, experience entry, etc.) — we render generic key/value rows
// so we don't have to special-case every node type.
//

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { cx } from "@/components/design-system";
import type { GraphNodeKind } from "./graph-types";

export interface NodeDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  kind: GraphNodeKind;
  color: string;
  data: Record<string, unknown> | null;
}

export function NodeDrawer({
  open,
  onClose,
  title,
  subtitle,
  kind,
  color,
  data,
}: NodeDrawerProps): React.ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const rows = useMemo(() => buildDisplayRows(data), [data]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-slate-950/24 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={`${kind} details: ${title}`}
        className={cx(
          "relative ml-auto h-full w-full max-w-[420px] overflow-y-auto",
          "border-l border-white/65 bg-white/82 px-5 py-6 text-slate-800",
          "shadow-[0_22px_54px_rgba(15,23,42,0.18),inset_1px_0_0_rgba(255,255,255,0.85)]",
          "backdrop-blur-2xl",
        )}
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className="mb-2 inline-flex h-5 items-center gap-1.5 rounded-full border border-white/60 bg-white/55 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600"
              style={{ color }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}55` }}
              />
              {kind}
            </span>
            <h2 className="truncate text-lg font-semibold leading-tight text-slate-950">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/50 text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/72 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-white/60 bg-white/50 p-4 text-xs text-slate-500">
            No additional data captured for this node yet.
          </p>
        ) : (
          <dl className="space-y-3">
            {rows.map((row) => (
              <DrawerRow key={row.key} label={row.key} value={row.display} />
            ))}
          </dl>
        )}
      </aside>
    </div>
  );
}

function DrawerRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  const isLong = value.length > 80;
  return (
    <div className="rounded-xl border border-white/60 bg-white/55 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <dt className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {humanize(label)}
      </dt>
      <dd
        className={cx(
          "text-[13px] leading-relaxed text-slate-800",
          isLong ? "whitespace-pre-wrap" : "truncate",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

interface DisplayRow {
  key: string;
  display: string;
}

const HIDDEN_KEYS = new Set([
  "id",
  "_id",
  "_creationTime",
  "kind",
  "color",
  "x",
  "y",
  "vx",
  "vy",
  "fx",
  "fy",
  "index",
  "label",
  "size",
]);

function buildDisplayRows(data: Record<string, unknown> | null): DisplayRow[] {
  if (!data) return [];
  const rows: DisplayRow[] = [];
  for (const [key, raw] of Object.entries(data)) {
    if (HIDDEN_KEYS.has(key)) continue;
    if (raw === null || raw === undefined) continue;
    const display = stringify(raw);
    if (!display) continue;
    rows.push({ key, display });
  }
  return rows;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return value.join(", ");
    }
    if (value.every((v) => v && typeof v === "object" && "name" in (v as object))) {
      return value
        .map((v) => String((v as { name?: unknown }).name ?? ""))
        .filter(Boolean)
        .join(", ");
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
