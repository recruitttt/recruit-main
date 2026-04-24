import { mockKPIs } from "@/lib/mock-data";

export function KPIStrip() {
  return (
    <div className="grid grid-cols-2 gap-px bg-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden md:grid-cols-3 lg:grid-cols-6">
      {mockKPIs.map((kpi) => (
        <div key={kpi.label} className="bg-[var(--color-surface)] p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
              {kpi.label}
            </div>
            {kpi.hint && (
              <div className="text-[10px] text-[var(--color-fg-subtle)] font-mono">
                {kpi.hint}
              </div>
            )}
          </div>
          <div className="mt-3 text-[28px] font-serif tracking-tight text-[var(--color-fg)] leading-none tabular-nums">
            {kpi.value}
          </div>
          {kpi.delta && (
            <div className="mt-2 text-[11px] text-[var(--color-fg-muted)] font-mono">
              {kpi.delta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
