import { mockApplications, stageOrder, stageLabels, type Stage } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const stageColors: Record<Stage, string> = {
  queued: "bg-zinc-400",
  tailoring: "bg-amber-500",
  reviewing: "bg-violet-500",
  submitting: "bg-[var(--color-accent)]",
  submitted: "bg-emerald-500",
  blocked: "bg-red-500",
};

export function Pipeline() {
  const counts = stageOrder.reduce<Record<Stage, number>>(
    (acc, s) => {
      acc[s] = mockApplications.filter((a) => a.stage === s).length;
      return acc;
    },
    { queued: 0, tailoring: 0, reviewing: 0, submitting: 0, submitted: 0, blocked: 0 }
  );

  const total = stageOrder.reduce((s, st) => s + counts[st], 0);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
          Pipeline
        </h3>
        <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
          {total} active
        </span>
      </div>

      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
        {stageOrder.map((s) => {
          const w = total > 0 ? (counts[s] / total) * 100 : 0;
          if (w === 0) return null;
          return (
            <div
              key={s}
              className={cn("h-full transition-all", stageColors[s])}
              style={{ width: `${w}%` }}
            />
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {stageOrder.map((s) => (
          <div key={s}>
            <div className="flex items-center gap-1.5">
              <div className={cn("h-1.5 w-1.5 rounded-full", stageColors[s])} />
              <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-[var(--color-fg-subtle)]">
                {stageLabels[s]}
              </div>
            </div>
            <div className="mt-1 text-[18px] font-serif tracking-tight text-[var(--color-fg)] tabular-nums">
              {counts[s]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
