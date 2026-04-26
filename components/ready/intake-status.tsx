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
  onConfigure?: (kind: IntakeKind) => void;
  onDisconnect?: (kind: IntakeKind) => void;
  disconnecting?: IntakeKind | null;
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
  onConfigure,
  onDisconnect,
  disconnecting,
}: IntakeStatusPanelProps): React.ReactElement {
  const ready = snapshot.filter((s) => s.status === "complete").length;
  const counted = snapshot.filter((s) => s.status !== "skipped").length;

  return (
    <GlassCard density="spacious">
      <div className="mb-4 flex items-center justify-between">
        <span className={mistClasses.sectionLabel}>Intake status</span>
        <span className="font-mono text-[11px] text-[var(--color-fg-subtle)]">
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
              onConfigure={onConfigure}
              onDisconnect={onDisconnect}
              disconnecting={disconnecting === entry.kind}
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
  onConfigure,
  onDisconnect,
  disconnecting,
}: {
  meta: SourceMeta;
  entry: SourceStatus;
  onRetry?: (kind: IntakeKind) => void;
  onConfigure?: (kind: IntakeKind) => void;
  onDisconnect?: (kind: IntakeKind) => void;
  disconnecting?: boolean;
}): React.ReactElement {
  const Icon = meta.icon;
  const configurable = entry.kind !== "chat";
  const canDisconnect = configurable && entry.status !== "skipped";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cx(
        "flex items-start gap-3 border border-[var(--glass-border)] bg-[var(--theme-compat-bg-soft)] px-3 py-3",
        mistRadii.nested,
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--theme-compat-bg)]">
        <Icon className="h-4 w-4 text-[var(--color-fg-muted)]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--color-fg-muted)]">
            {meta.name}
          </span>
          <StatusPill status={entry.status} />
        </div>
        <p
          className="mt-1 truncate font-mono text-[11px] leading-5 text-[var(--color-fg-subtle)]"
          title={entry.caption}
        >
          {entry.caption}
        </p>
      </div>
      {configurable && (
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
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
          {onConfigure && (
            <ActionButton
              variant={entry.status === "skipped" ? "primary" : "secondary"}
              size="sm"
              onClick={() => onConfigure(meta.kind)}
              aria-label={`Configure ${meta.name}`}
            >
              Configure
            </ActionButton>
          )}
          {canDisconnect && onDisconnect && (
            <ActionButton
              variant="ghost"
              size="sm"
              loading={disconnecting}
              disabled={disconnecting}
              onClick={() => onDisconnect(meta.kind)}
              aria-label={`Disconnect ${meta.name}`}
            >
              Disconnect
            </ActionButton>
          )}
        </div>
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
    className: "border-[var(--color-border)] bg-[var(--theme-compat-bg)] text-[var(--color-fg-muted)]",
    icon: Loader2,
  },
  running: {
    label: "Running",
    className:
      "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent-glow)]",
    icon: Loader2,
    spin: true,
  },
  complete: {
    label: "Complete",
    className: "border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    icon: AlertTriangle,
  },
  skipped: {
    label: "Skipped",
    className:
      "border-dashed border-[var(--color-border)] bg-[var(--theme-compat-bg-soft)] text-[var(--color-fg-subtle)]",
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
