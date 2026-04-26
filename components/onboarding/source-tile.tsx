"use client";

//
// SourceTile — a single agent-owned card on the sources canvas. Shows the
// owning agent's character (awake when the source has any progress event),
// the source name, an inline status row, and slot for source-specific actions
// (rendered by the parent — e.g. GitHub Connect button, LinkedIn URL input).
//

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cx, mistRadii } from "@/components/design-system";
import { AgentCharacter } from "@/components/onboarding/characters";
import { AGENTS, agentForSourceKind } from "@/lib/agents";
import { playWake } from "@/lib/sounds";
import type { IntakeRunRow } from "@/app/onboarding/_data";

type Status = "idle" | "running" | "done" | "failed";

export interface SourceTileProps {
  kind: "github" | "linkedin" | "resume" | "web";
  title: string;
  subtitle?: string;
  /** Live Convex intake-run row for this source (or null/undefined). */
  run: IntakeRunRow;
  /** Override resolved status (e.g. GitHub "Connected" without a run). */
  statusOverride?: Status;
  /** Children render the per-source action UI inside the tile. */
  children: ReactNode;
}

export function SourceTile({
  kind,
  title,
  subtitle,
  run,
  statusOverride,
  children,
}: SourceTileProps) {
  const agentId = agentForSourceKind(kind) ?? "scout";
  const agent = AGENTS[agentId];
  const status: Status =
    statusOverride ??
    (run?.status === "completed"
      ? "done"
      : run?.status === "failed"
        ? "failed"
        : run?.status === "running" || run?.status === "queued"
          ? "running"
          : "idle");

  const awake = status !== "idle";
  const justWoke = useJustWoke(awake);
  const reduceMotion = useReducedMotion();

  const tone = TONE[status];

  return (
    <motion.div
      layout
      className={cx(
        "relative flex flex-col gap-3 border bg-white/30 px-4 py-3 backdrop-blur-xl transition-colors",
        mistRadii.nested,
        tone.border,
      )}
      style={tone.shadow ? { boxShadow: tone.shadow(agent.hue) } : undefined}
    >
      <div className="flex items-start gap-3">
        <motion.div
          animate={
            justWoke && !reduceMotion ? { scale: [1, 1.18, 1] } : { scale: 1 }
          }
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0"
        >
          <AgentCharacter id={agentId} awake={awake} size={40} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div className="text-[14px] font-semibold tracking-tight text-slate-900">
              {title}
            </div>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.14em]"
              style={{ color: agent.hue }}
            >
              {agent.name}
            </span>
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[12px] leading-5 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        <StatusPill status={status} />
      </div>
      <div className="border-t border-white/55 pt-3">{children}</div>
    </motion.div>
  );
}

const TONE: Record<
  Status,
  { border: string; shadow?: (hue: string) => string }
> = {
  idle: { border: "border-white/55" },
  running: {
    border: "border-sky-300/55",
    shadow: () => "0 0 0 1px rgba(56,189,248,0.18)",
  },
  done: {
    border: "border-emerald-300/55",
    shadow: (hue) => `0 0 0 1px ${hue}33`,
  },
  failed: {
    border: "border-rose-300/55",
    shadow: () => "0 0 0 1px rgba(244,63,94,0.18)",
  },
};

function StatusPill({ status }: { status: Status }) {
  const tone =
    status === "failed"
      ? "border-rose-300/55 bg-rose-50/70 text-rose-700"
      : status === "done"
        ? "border-emerald-300/55 bg-emerald-50/70 text-emerald-700"
        : status === "running"
          ? "border-sky-300/55 bg-sky-50/70 text-sky-700"
          : "border-slate-300/55 bg-white/50 text-slate-500";
  const label =
    status === "failed"
      ? "Failed"
      : status === "done"
        ? "Synced"
        : status === "running"
          ? "Pulling"
          : "Idle";
  return (
    <span
      className={cx(
        "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
        tone,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Returns true for ~700ms the first time `awake` flips from false → true.
 * Triggers the wake SFX in the same tick.
 */
function useJustWoke(awake: boolean): boolean {
  const wokenRef = useRef(false);
  const [justWoke, setJustWoke] = useState(false);

  useEffect(() => {
    if (!awake) {
      wokenRef.current = false;
      return;
    }
    if (wokenRef.current) return;
    wokenRef.current = true;
    setJustWoke(true);
    playWake();
    const id = window.setTimeout(() => setJustWoke(false), 700);
    return () => window.clearTimeout(id);
  }, [awake]);

  return justWoke;
}
