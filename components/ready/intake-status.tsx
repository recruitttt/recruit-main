"use client";

//
// IntakeStatusPanel — one card per source (GitHub, LinkedIn, Resume, Web,
// Chat). Each card shows an icon, source name, status pill, and a subtle
// caption.
//
// The Convex `useQuery(api.intakeRuns.byUserKind, ...)` calls live in the
// parent so the parent can also drive the bottom CTA off the same snapshot
// without firing duplicate subscriptions.
//
// Matches the onboarding aesthetic — uses GlassCard / mistClasses so the
// page feels native.
//

import { motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

import {
  ActionButton,
  GlassCard,
  cx,
  mistClasses,
  mistRadii,
} from "@/components/design-system";
import { GithubIcon, LinkedinIcon } from "@/components/ui/brand-icons";

export type IntakeKind = "github" | "linkedin" | "resume" | "web" | "chat";

export type IntakeRunRow = {
  _id?: string;
  status: "queued" | "running" | "completed" | "failed";
  kind?: string;
  events?: Array<{
    stage?: string;
    message?: string;
    done?: number;
    total?: number;
    level?: string;
  }>;
  startedAt?: string;
  completedAt?: string;
  error?: string;
} | null | undefined;

export type IntakeStatusKey =
  | "pending"
  | "running"
  | "complete"
  | "failed"
  | "skipped";

export interface SourceStatus {
  kind: IntakeKind;
  name: string;
  status: IntakeStatusKey;
  caption: string;
  run: IntakeRunRow;
}

export interface IntakeStatusPanelProps {
  snapshot: ReadonlyArray<SourceStatus>;
  onRetry?: (kind: IntakeKind) => void;
}

interface SourceMeta {
  kind: IntakeKind;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  emptyCaption: string;
}

export const READY_SOURCES: ReadonlyArray<SourceMeta> = [
  {
    kind: "github",
    name: "GitHub",
    icon: GithubIcon,
    emptyCaption: "Not connected",
  },
  {
    kind: "linkedin",
    name: "LinkedIn",
    icon: LinkedinIcon,
    emptyCaption: "Not linked",
  },
  {
    kind: "resume",
    name: "Resume",
    icon: FileText,
    emptyCaption: "Not uploaded",
  },
  {
    kind: "web",
    name: "Web",
    icon: Globe,
    emptyCaption: "No web sources",
  },
  {
    kind: "chat",
    name: "Chat",
    icon: MessageCircle,
    emptyCaption: "Awaiting answers",
  },
];

const SOURCE_BY_KIND: Record<IntakeKind, SourceMeta> = READY_SOURCES.reduce(
  (acc, meta) => ({ ...acc, [meta.kind]: meta }),
  {} as Record<IntakeKind, SourceMeta>,
);

export function IntakeStatusPanel({
  snapshot,
  onRetry,
}: IntakeStatusPanelProps): React.ReactElement {
  const ready = snapshot.filter((s) => s.status === "complete").length;
  const counted = snapshot.filter((s) => s.status !== "skipped").length;

  return (
    <GlassCard density="spacious">
      <div className="mb-4 flex items-center justify-between">
        <span className={mistClasses.sectionLabel}>Intake status</span>
        <span className="font-mono text-[11px] text-slate-500">
          {ready} / {counted} ready
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {snapshot.map((entry) => {
          const meta = SOURCE_BY_KIND[entry.kind];
          if (!meta) return null;
          return (
            <SourceCard
              key={entry.kind}
              meta={meta}
              entry={entry}
              onRetry={onRetry}
            />
          );
        })}
      </div>
    </GlassCard>
  );
}

function SourceCard({
  meta,
  entry,
  onRetry,
}: {
  meta: SourceMeta;
  entry: SourceStatus;
  onRetry?: (kind: IntakeKind) => void;
}): React.ReactElement {
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cx(
        "flex items-start gap-3 border border-white/55 bg-white/30 px-3 py-3",
        mistRadii.nested,
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/45">
        <Icon className="h-4 w-4 text-slate-600" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-800">
            {meta.name}
          </span>
          <StatusPill status={entry.status} />
        </div>
        <p
          className="mt-1 truncate font-mono text-[11px] leading-5 text-slate-500"
          title={entry.caption}
        >
          {entry.caption}
        </p>
      </div>
      {entry.status === "failed" && onRetry && (
        <ActionButton
          variant="secondary"
          size="sm"
          onClick={() => onRetry(meta.kind)}
          aria-label={`Retry ${meta.name}`}
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </ActionButton>
      )}
    </motion.div>
  );
}

export function StatusPill({
  status,
  size = "md",
}: {
  status: IntakeStatusKey;
  size?: "sm" | "md";
}): React.ReactElement {
  const config = STATUS_STYLE[status];
  const Icon = config.icon;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono uppercase tracking-[0.12em]",
        size === "sm" ? "text-[9px]" : "text-[10px]",
        config.className,
      )}
    >
      <Icon
        className={cx("h-2.5 w-2.5", config.spin && "animate-spin")}
      />
      {config.label}
    </span>
  );
}

const STATUS_STYLE: Record<
  IntakeStatusKey,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
    spin?: boolean;
  }
> = {
  pending: {
    label: "Pending",
    className: "border-slate-300/65 bg-white/40 text-slate-600",
    icon: Loader2,
  },
  running: {
    label: "Running",
    className:
      "border-sky-400/40 bg-sky-100/50 text-sky-700 shadow-[0_0_0_1px_rgba(56,189,248,0.18)]",
    icon: Loader2,
    spin: true,
  },
  complete: {
    label: "Complete",
    className: "border-emerald-500/35 bg-emerald-100/55 text-emerald-700",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "border-rose-500/35 bg-rose-100/55 text-rose-700",
    icon: AlertTriangle,
  },
  skipped: {
    label: "Skipped",
    className:
      "border-dashed border-slate-300/55 bg-white/22 text-slate-400",
    icon: Loader2,
  },
};

// ---------------------------------------------------------------------------
// buildSnapshot — pure helper that turns raw run rows + per-source attempted
// flags into the SourceStatus[] the panel and CTA both read from.
// ---------------------------------------------------------------------------

export function buildSnapshot({
  runs,
  attempted,
}: {
  runs: Record<IntakeKind, IntakeRunRow>;
  attempted: Record<IntakeKind, boolean>;
}): SourceStatus[] {
  return READY_SOURCES.map((meta) => {
    const run = runs[meta.kind];
    const wasAttempted = attempted[meta.kind];
    const status = resolveStatus(run, wasAttempted);
    const caption = buildCaption(meta, run, status);
    return { kind: meta.kind, name: meta.name, status, caption, run };
  });
}

function resolveStatus(
  run: IntakeRunRow,
  attempted: boolean,
): IntakeStatusKey {
  if (!run) return attempted ? "pending" : "skipped";
  if (run.status === "completed") return "complete";
  if (run.status === "failed") return "failed";
  if (run.status === "queued") return "pending";
  return "running";
}

function buildCaption(
  meta: SourceMeta,
  run: IntakeRunRow,
  status: IntakeStatusKey,
): string {
  if (status === "skipped") return meta.emptyCaption;
  if (!run) return "Waiting to start";
  if (status === "failed") return run.error ?? "Run failed — try again";

  const events = Array.isArray(run.events) ? run.events : [];
  const latest = events[events.length - 1];
  const progress =
    latest && typeof latest.done === "number" && typeof latest.total === "number" && latest.total > 0
      ? ` (${latest.done}/${latest.total})`
      : "";

  if (status === "running") {
    if (latest?.message) return `${latest.message}${progress}`;
    return `Working${progress}`;
  }

  if (status === "pending") return "Queued — starting shortly";

  // complete
  if (latest?.message) return latest.message;
  return `${meta.name} synced`;
}

// ---------------------------------------------------------------------------
// Aggregate helpers
// ---------------------------------------------------------------------------

export function isAllReady(snapshot: ReadonlyArray<SourceStatus>): boolean {
  return snapshot.every(
    (s) => s.status === "complete" || s.status === "skipped",
  );
}

export function pendingSources(
  snapshot: ReadonlyArray<SourceStatus>,
): SourceStatus[] {
  return snapshot.filter(
    (s) => s.status === "running" || s.status === "pending",
  );
}

export function failedSources(
  snapshot: ReadonlyArray<SourceStatus>,
): SourceStatus[] {
  return snapshot.filter((s) => s.status === "failed");
}
