import { CheckCircle2, CircleAlert, Database, Eye, Sparkles } from "lucide-react";
import { getStatusColor, type StatusTone } from "./mist-tokens";
import { cx } from "./utils";

export type EventLogItem = {
  time: string;
  type: "seen" | "decision" | "tool" | "success" | "blocked";
  title: string;
  detail: string;
};

const eventIcons = {
  seen: Eye,
  decision: Sparkles,
  tool: Database,
  success: CheckCircle2,
  blocked: CircleAlert,
};

const eventTones: Record<EventLogItem["type"], StatusTone> = {
  seen: "accent",
  decision: "warning",
  tool: "neutral",
  success: "success",
  blocked: "danger",
};

export function EventLog({ events, compact = false }: { events: EventLogItem[]; compact?: boolean }) {
  return (
    <div className="space-y-3">
      {events.map((event) => {
        const Icon = eventIcons[event.type];
        const color = getStatusColor(eventTones[event.type]);

        return (
          <div key={`${event.time}-${event.title}`} className={cx("grid gap-3", compact ? "grid-cols-[44px_24px_1fr]" : "grid-cols-[56px_30px_1fr]")}>
            <div className="font-mono text-xs text-slate-500">{event.time}</div>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/60 bg-white/30" style={{ color }}>
              <Icon className="h-3 w-3" />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">{event.title}</div>
              {!compact && <div className="mt-1 text-xs leading-5 text-slate-500">{event.detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
