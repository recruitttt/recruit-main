"use client";

//
// GraphFilterBar — filter pills above the force-directed graph plus a
// reset-zoom button. Visually consistent with the recruit "mist" glass
// aesthetic used by the rest of the dashboard.
//

import {
  CalendarClock,
  FlaskConical,
  Maximize2,
  Network,
  Sparkles,
} from "lucide-react";
import { cx } from "@/components/design-system";
import { FILTERS, NODE_COLORS, type GraphFilter, type GraphNodeKind } from "./graph-types";

export interface GraphFilterBarProps {
  filter: GraphFilter;
  onFilterChange: (filter: GraphFilter) => void;
  onResetZoom: () => void;
  nodeCounts: Record<GraphNodeKind, number>;
  visibleNodes: number;
  visibleEdges: number;
}

export function GraphFilterBar({
  filter,
  onFilterChange,
  onResetZoom,
  nodeCounts,
  visibleNodes,
  visibleEdges,
}: GraphFilterBarProps): React.ReactElement {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-[22px] border border-[var(--glass-border)] bg-[var(--theme-compat-bg)] p-1.5 text-[var(--color-fg-muted)] shadow-[var(--theme-panel-shadow)] backdrop-blur-2xl">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {FILTERS.map((option) => {
          const isActive = option.id === filter;
          const Icon = FILTER_ICONS[option.id];
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onFilterChange(option.id)}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold tracking-[0] transition",
                isActive
                  ? "border-[var(--glass-border)] bg-[var(--theme-compat-bg-strong)] text-[var(--color-fg)] shadow-[var(--theme-card-inset-shadow)]"
                  : "border-transparent bg-transparent text-[var(--color-fg-muted)] hover:bg-[var(--glass-control-hover)] hover:text-[var(--color-fg)]",
              )}
              aria-pressed={isActive}
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="hidden min-w-0 items-center gap-2 border-l border-[var(--glass-border)] pl-3 lg:flex">
        <Legend counts={nodeCounts} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden rounded-full border border-[var(--glass-border)] bg-[var(--theme-compat-bg-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-fg-muted)] sm:inline">
          {visibleNodes} nodes / {visibleEdges} edges
        </span>
        <button
          type="button"
          onClick={onResetZoom}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--theme-compat-bg)] text-[var(--color-fg-muted)] shadow-[var(--theme-card-inset-shadow)] transition hover:bg-[var(--glass-control-hover)] hover:text-[var(--color-fg)]"
          aria-label="Reset zoom"
          title="Reset zoom"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

const FILTER_ICONS: Record<GraphFilter, React.ComponentType<{ className?: string }>> = {
  all: Network,
  ai: Sparkles,
  research: FlaskConical,
  recent: CalendarClock,
};

const LEGEND_ORDER: ReadonlyArray<GraphNodeKind> = [
  "person",
  "project",
  "company",
  "school",
  "skill",
  "link",
  "publication",
  "honor",
];

function Legend({ counts }: { counts: Record<GraphNodeKind, number> }): React.ReactElement {
  return (
    <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {LEGEND_ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
        <li
          key={kind}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-fg-muted)]"
          title={`${counts[kind]} ${kind} node(s)`}
        >
          <span
            className="h-2.5 w-2.5 rounded-full border border-[var(--glass-border)]"
            style={{
              backgroundColor: NODE_COLORS[kind],
              boxShadow: `0 0 10px ${NODE_COLORS[kind]}38`,
            }}
          />
          <span className="capitalize">{kind}</span>
          <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">{counts[kind]}</span>
        </li>
      ))}
    </ul>
  );
}
