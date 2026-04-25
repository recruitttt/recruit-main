import { mockActivityFeed, type ActivityEvent } from "@/lib/mock-data";
import { formatRelative } from "@/lib/utils";
import { Workflow, Sparkles, Eye, MousePointerClick, Send, Database } from "lucide-react";

const iconByKind: Record<ActivityEvent["kind"], React.ComponentType<{ className?: string }>> = {
  discover: Workflow,
  tailor: Sparkles,
  review: Eye,
  fill: MousePointerClick,
  submit: Send,
  cache: Database,
};

const colorByKind: Record<ActivityEvent["kind"], string> = {
  discover: "text-[var(--color-fg-muted)]",
  tailor: "text-amber-300",
  review: "text-violet-300",
  fill: "text-cyan-300",
  submit: "text-emerald-300",
  cache: "text-[var(--color-accent)]",
};

export function ActivityFeed() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
        <h3 className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
          Live activity
        </h3>
        <span className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
          last 7 events
        </span>
      </div>
      <div className="px-5 py-4">
        <ol className="relative space-y-4">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--color-border)]" />
          {mockActivityFeed.map((ev) => {
            const Icon = iconByKind[ev.kind];
            return (
              <li key={ev.id} className="relative flex items-start gap-3">
                <div className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] mt-0.5">
                  <Icon className={`h-2.5 w-2.5 ${colorByKind[ev.kind]}`} />
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-[var(--color-fg)] font-medium truncate">
                      {ev.company}
                    </span>
                    <span className="text-[10px] text-[var(--color-fg-subtle)] font-mono shrink-0">
                      {formatRelative(ev.timestamp)}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--color-fg-muted)] leading-snug mt-0.5">
                    {ev.text}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
