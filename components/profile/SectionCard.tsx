"use client";

//
// SectionCard — reusable section wrapper for the dense Data view. Renders a
// glass-styled card with a title row, optional metadata pills, and a
// `<details>`-based "raw data" drawer at the bottom.
//

import { useState, type ReactNode } from "react";
import { ChevronRight, Database } from "lucide-react";
import { cx, mistClasses } from "@/components/design-system";

export interface SectionCardProps {
  title: string;
  /** Optional kicker rendered above the title. */
  kicker?: string;
  /** Right-aligned action / status node (e.g. provenance pill, sync time). */
  meta?: ReactNode;
  /** Optional one-line subtitle / description. */
  description?: ReactNode;
  /** Raw data shown inside the bottom drawer. JSON-serialisable preferred. */
  rawData?: unknown;
  /** Override the drawer label. */
  rawLabel?: string;
  /** Show an empty-state body when children resolve to nothing. */
  empty?: { title: string; hint: ReactNode };
  /** When false, the card is rendered greyed-out. Default true. */
  active?: boolean;
  className?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  kicker,
  meta,
  description,
  rawData,
  rawLabel = "raw data",
  empty,
  active = true,
  className = "",
  children,
}: SectionCardProps): React.ReactElement {
  const showEmpty = Boolean(empty) && isEffectivelyEmpty(children);

  return (
    <section
      className={cx(
        "min-w-0 border p-5",
        mistClasses.panel,
        !active && "opacity-70",
        className,
      )}
    >
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {kicker ? (
            <div className={mistClasses.sectionLabel}>{kicker}</div>
          ) : null}
          <h2 className="mt-1 truncate font-serif text-[22px] leading-tight tracking-tight text-[var(--color-fg)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-[13px] leading-snug text-[var(--color-fg-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {meta ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {meta}
          </div>
        ) : null}
      </header>

      {showEmpty && empty ? (
        <EmptyBody title={empty.title} hint={empty.hint} />
      ) : (
        <div className="space-y-4">{children}</div>
      )}

      {rawData !== undefined ? (
        <RawDrawer label={rawLabel} data={rawData} />
      ) : null}
    </section>
  );
}

function EmptyBody({ title, hint }: { title: string; hint: ReactNode }): React.ReactElement {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--theme-compat-bg-soft)] p-4 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
        {title}
      </div>
      <div className="mt-1 text-[13px] leading-snug text-[var(--color-fg-muted)]">{hint}</div>
    </div>
  );
}

function RawDrawer({ label, data }: { label: string; data: unknown }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const json = safeStringify(data);

  return (
    <details
      className="mt-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--theme-compat-bg-soft)] p-2"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--color-fg-muted)] transition hover:bg-[var(--glass-control-hover)]">
        <ChevronRight
          className={cx(
            "h-3 w-3 transition-transform",
            open && "rotate-90",
          )}
        />
        <Database className="h-3 w-3" />
        {label}
      </summary>
      <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-[11px] leading-snug text-[var(--color-fg)]">
        {json}
      </pre>
    </details>
  );
}

function safeStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "// unserialisable";
  }
}

function isEffectivelyEmpty(children: ReactNode): boolean {
  if (children == null || children === false) return true;
  if (Array.isArray(children)) return children.every((c) => isEffectivelyEmpty(c));
  return false;
}
