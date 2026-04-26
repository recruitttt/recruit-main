import { Lock, Sparkles } from "lucide-react";
import { getStatusColor, type StatusTone } from "./mist-tokens";
import { GlassCard } from "./glass-card";

function DiffPane({ title, items, tone }: { title: string; items: string[]; tone: StatusTone }) {
  const color = getStatusColor(tone);

  return (
    <GlassCard density="compact" variant="muted" className="rounded-[20px]">
      <div className="mb-3 text-xs font-semibold text-[var(--color-fg-subtle)]">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <p key={item} className="rounded-[12px] border px-3 py-1.5 text-xs leading-5 text-[var(--color-fg-muted)]" style={{ borderColor: `${color}22`, backgroundColor: `${color}0A` }}>
            {item}
          </p>
        ))}
      </div>
    </GlassCard>
  );
}

export function DiffViewer({
  before,
  after,
  rationale,
  locked,
}: {
  before: string[];
  after: string[];
  rationale?: string[];
  locked?: string[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="grid gap-3 md:grid-cols-2">
        <DiffPane title="Before" items={before} tone="neutral" />
        <DiffPane title="After" items={after} tone="success" />
      </div>
      {(rationale || locked) && (
        <GlassCard>
          {rationale && (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]"><Sparkles className="h-4 w-4 text-[var(--color-fg-subtle)]" /> Why these edits</div>
              <div className="space-y-2">{rationale.map((item) => <div key={item} className="text-sm leading-6 text-[var(--color-fg-muted)]">{item}</div>)}</div>
            </>
          )}
          {locked && (
            <div className="mt-4 flex flex-wrap gap-2">
              {locked.map((item) => (
                <span key={item} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--theme-compat-bg)] px-3 text-xs font-semibold text-[var(--color-fg-muted)]"><Lock className="h-3 w-3" /> {item}</span>
              ))}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
