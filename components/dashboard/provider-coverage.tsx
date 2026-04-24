import { mockProviderCoverage } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const statusStyles = {
  live: "border-emerald-500/30 bg-emerald-500/5",
  preview: "border-amber-500/30 bg-amber-500/5",
  "coming-soon": "border-[var(--color-border)] bg-[var(--color-bg)]/40 opacity-60",
};

const statusLabels = {
  live: "Live",
  preview: "Preview",
  "coming-soon": "Soon",
};

const statusColor = {
  live: "text-emerald-300",
  preview: "text-amber-300",
  "coming-soon": "text-[var(--color-fg-subtle)]",
};

export function ProviderCoverage() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
          Provider coverage
        </h3>
        <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
          1 of 4 live
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {mockProviderCoverage.map((p) => (
          <div
            key={p.name}
            className={cn(
              "rounded-md border px-3 py-2.5",
              statusStyles[p.status]
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-medium text-[var(--color-fg)]">
                {p.name}
              </div>
              <div className={cn("text-[10px] uppercase tracking-[0.12em] font-mono", statusColor[p.status])}>
                {statusLabels[p.status]}
              </div>
            </div>
            {p.successRate !== undefined && (
              <div className="mt-1 text-[10px] font-mono text-[var(--color-fg-muted)]">
                {p.successRate}% success
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
