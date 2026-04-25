import { cn } from "@/lib/utils";
import { type Stage } from "@/lib/mock-data";

const stageStyles: Record<Stage, string> = {
  queued:
    "bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] border-[var(--color-border)]",
  tailoring:
    "bg-amber-500/10 text-amber-300 border-amber-500/30",
  reviewing:
    "bg-violet-500/10 text-violet-300 border-violet-500/30",
  submitting:
    "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  submitted:
    "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  blocked:
    "bg-red-500/10 text-red-300 border-red-500/30",
};

export function StageBadge({
  stage,
  pulse = false,
  className,
}: {
  stage: Stage;
  pulse?: boolean;
  className?: string;
}) {
  const isLive = pulse && stage !== "submitted" && stage !== "queued";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase font-mono",
        stageStyles[stage],
        className
      )}
    >
      {isLive && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          style={{ animation: "pulse-soft 2s ease-in-out infinite" }}
        />
      )}
      <span>{stage}</span>
    </span>
  );
}

export function Pill({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "accent" | "success" | "warn";
}) {
  const tones = {
    neutral:
      "bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)]",
    accent:
      "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent-soft)]",
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono tracking-wide uppercase",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
