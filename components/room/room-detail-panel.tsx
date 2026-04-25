"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { X, ArrowUpRight } from "lucide-react";
import { useRoomStore } from "./room-store";
import { AGENTS, type AgentId } from "@/lib/agents";
import { applicationForAgent } from "@/lib/room/app-agent-map";
import { mockPersonaReviews, stageLabels } from "@/lib/mock-data";
import { CompanyLogo } from "@/components/ui/logo";
import { StageBadge, Pill } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const verdictColors: Record<string, string> = {
  Strong: "text-emerald-700",
  "On the line": "text-amber-700",
  Weak: "text-red-700",
};

export function RoomDetailPanel() {
  const selected = useRoomStore((s) => s.selectedAgentId);
  const setSelected = useRoomStore((s) => s.setSelected);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, setSelected]);

  return (
    <AnimatePresence>
      {selected ? <Panel key={selected} agentId={selected} onClose={() => setSelected(null)} /> : null}
    </AnimatePresence>
  );
}

function Panel({ agentId, onClose }: { agentId: AgentId; onClose: () => void }) {
  const agent = AGENTS[agentId];
  const app = applicationForAgent(agentId);

  const scores = [
    { label: "Match", value: app.matchScore, hint: "JD vs intake" },
    { label: "Tailoring", value: app.tailoringScore || "—", hint: "Resume rewrite" },
    { label: "Questions", value: "14/14", hint: "Filled" },
    { label: "Cache hits", value: 7, hint: "Saved this run" },
  ];

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="pointer-events-auto absolute right-4 top-4 bottom-4 w-[380px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/92 backdrop-blur-xl shadow-[0_30px_70px_-30px_rgba(15,15,18,0.3),0_12px_32px_-16px_rgba(15,15,18,0.2)]"
    >
      {/* Accent rail in agent hue */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: agent.hue, opacity: 0.9 }}
      />

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-1)] hover:text-[var(--color-fg)] transition-colors"
        aria-label="Close panel"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: agent.hue, boxShadow: `0 0 8px ${agent.hue}77` }}
            />
            {agent.name} · {stageLabels[app.stage]}
          </div>
          <div className="mt-3 flex items-start gap-3">
            <CompanyLogo
              bg={app.logoBg}
              text={app.logoText}
              size={42}
              className="rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif text-[19px] leading-snug text-[var(--color-fg)]">
                  {app.role}
                </h2>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
                <span className="font-medium text-[var(--color-fg)]">{app.company}</span>
                <span>·</span>
                <span className="truncate">{app.location}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StageBadge stage={app.stage} pulse />
                <Pill tone="accent">via {app.provider}</Pill>
              </div>
            </div>
          </div>
        </div>

        {/* Score strip */}
        <div className="grid grid-cols-4 gap-px bg-[var(--color-border)] border-b border-[var(--color-border)]">
          {scores.map((s) => (
            <div
              key={s.label}
              className="bg-[var(--color-surface)] px-3 py-3 flex flex-col gap-1"
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)]">
                {s.label}
              </div>
              <div className="font-serif text-[20px] leading-none text-[var(--color-fg)] tabular-nums">
                {s.value}
              </div>
              <div className="text-[10px] text-[var(--color-fg-subtle)] leading-tight">
                {s.hint}
              </div>
            </div>
          ))}
        </div>

        {/* Persona review */}
        <div className="px-5 pt-4 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
              Three-persona review
            </div>
            <Pill tone="accent">pass</Pill>
          </div>
        </div>
        <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {mockPersonaReviews.map((r) => (
            <div key={r.persona} className="px-5 py-4">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[12.5px] font-medium text-[var(--color-fg)]">
                  {r.persona}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.15em] font-mono",
                      verdictColors[r.verdict]
                    )}
                  >
                    {r.verdict}
                  </span>
                  <span className="font-mono text-[13px] text-[var(--color-fg)] tabular-nums">
                    {r.score}
                  </span>
                </div>
              </div>
              <p className="text-[11.5px] text-[var(--color-fg-muted)] leading-relaxed">
                {r.notes}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]/50">
          <Link
            href={`/applications/${app.id}`}
            className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] font-medium text-[var(--color-fg)] transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-1)]"
          >
            <span>Open full detail</span>
            <ArrowUpRight className="h-4 w-4 text-[var(--color-fg-muted)]" />
          </Link>
          <div className="mt-2 font-mono text-[10px] text-[var(--color-fg-subtle)] text-center">
            esc to close
          </div>
        </div>
      </div>
    </motion.div>
  );
}
