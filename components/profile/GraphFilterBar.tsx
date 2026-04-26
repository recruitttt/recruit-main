"use client";

//
// GraphFilterBar — filter pills above the force-directed graph plus a
// reset-zoom button. Visually consistent with the recruit "mist" glass
// aesthetic used by the rest of the dashboard.
//

import { Maximize2 } from "lucide-react";
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
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-white/65 bg-white/68 px-3 py-2 text-slate-700 shadow-[0_18px_38px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-2xl">
      <div className="flex items-center gap-1.5">
        {FILTERS.map((option) => {
          const isActive = option.id === filter;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onFilterChange(option.id)}
              className={cx(
                "h-8 rounded-full border px-3 text-[12px] font-semibold tracking-tight transition",
                isActive
                  ? "border-white/85 bg-white/90 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_18px_rgba(15,23,42,0.10)]"
                  : "border-white/45 bg-white/35 text-slate-600 hover:bg-white/55 hover:text-slate-900",
              )}
              aria-pressed={isActive}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="ml-1 hidden items-center gap-2 border-l border-white/55 pl-3 md:flex">
        <Legend counts={nodeCounts} />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-[11px] font-mono uppercase tracking-[0.14em] text-slate-500 sm:inline">
          {visibleNodes} nodes · {visibleEdges} edges
        </span>
        <button
          type="button"
          onClick={onResetZoom}
          className="flex h-8 items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-3 text-[12px] font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition hover:bg-white/82"
          aria-label="Reset zoom"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Reset zoom
        </button>
      </div>
    </div>
  );
}

const LEGEND_ORDER: ReadonlyArray<GraphNodeKind> = [
  "person",
  "project",
  "company",
  "school",
  "skill",
  "publication",
  "honor",
];

function Legend({ counts }: { counts: Record<GraphNodeKind, number> }): React.ReactElement {
  return (
    <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {LEGEND_ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
        <li
          key={kind}
          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
          title={`${counts[kind]} ${kind} node(s)`}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: NODE_COLORS[kind],
              boxShadow: `0 0 6px ${NODE_COLORS[kind]}55`,
            }}
          />
          <span className="capitalize">{kind}</span>
          <span className="font-mono text-[10px] text-slate-400">{counts[kind]}</span>
        </li>
      ))}
    </ul>
  );
}
