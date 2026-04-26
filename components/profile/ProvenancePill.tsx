//
// ProvenancePill — tiny inline pill marking which adapter sourced a field.
// Renders even when the field is empty so the UI surfaces *which* source
// could fill the gap.
//

import type { ProvenanceSource } from "@/lib/profile";

const PALETTE: Record<ProvenanceSource, { label: string; className: string; emptyHint: string }> = {
  github: {
    label: "github",
    className:
      "border-emerald-500/30 bg-emerald-500/12 text-emerald-700",
    emptyHint: "GitHub will fill this once intake completes",
  },
  linkedin: {
    label: "linkedin",
    className:
      "border-[var(--color-border)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
    emptyHint: "Connect LinkedIn to populate this",
  },
  chat: {
    label: "chat",
    className:
      "border-violet-500/30 bg-violet-500/12 text-violet-700",
    emptyHint: "Mention this in onboarding chat to fill",
  },
  resume: {
    label: "resume",
    className:
      "border-amber-500/35 bg-amber-500/12 text-amber-700",
    emptyHint: "Upload a resume to populate this",
  },
  manual: {
    label: "manual",
    className:
      "border-slate-400/35 bg-slate-200/45 text-slate-700",
    emptyHint: "Add manually in settings",
  },
  website: {
    label: "website",
    className:
      "border-orange-500/35 bg-orange-500/12 text-orange-700",
    emptyHint: "Add a personal website to scrape",
  },
  devpost: {
    label: "devpost",
    className:
      "border-fuchsia-500/30 bg-fuchsia-500/12 text-fuchsia-700",
    emptyHint: "Link a DevPost profile to import",
  },
};

export interface ProvenancePillProps {
  source: ProvenanceSource;
  /** When true, render in muted "no data yet" state with the source hint. */
  empty?: boolean;
  /** Optional extra suffix label, e.g. "+ chat" for merged sources. */
  suffix?: string;
  className?: string;
}

export function ProvenancePill({
  source,
  empty = false,
  suffix,
  className = "",
}: ProvenancePillProps): React.ReactElement {
  const meta = PALETTE[source];
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]";

  if (empty) {
    return (
      <span
        className={`${base} border-slate-300/55 bg-white/30 text-slate-500 ${className}`}
        title={meta.emptyHint}
      >
        <span className="h-1 w-1 rounded-full bg-slate-400/65" aria-hidden />
        no {meta.label} yet
      </span>
    );
  }

  return (
    <span
      className={`${base} ${meta.className} ${className}`}
      title={`Sourced from ${meta.label}`}
    >
      <span
        className="h-1 w-1 rounded-full bg-current opacity-80"
        aria-hidden
      />
      from {meta.label}
      {suffix ? <span className="opacity-70">{suffix}</span> : null}
    </span>
  );
}

export interface ProvenanceLegendProps {
  className?: string;
}

export function ProvenanceLegend({ className = "" }: ProvenanceLegendProps): React.ReactElement {
  const sources: ProvenanceSource[] = [
    "github",
    "linkedin",
    "resume",
    "chat",
    "website",
    "devpost",
    "manual",
  ];
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        provenance
      </span>
      {sources.map((s) => (
        <ProvenancePill key={s} source={s} />
      ))}
    </div>
  );
}
