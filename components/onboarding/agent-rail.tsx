"use client";

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AGENT_ORDER, AGENTS, type AgentId } from "@/lib/agents";
import { AgentCharacter } from "@/components/onboarding/characters";
import { cx, mistClasses } from "@/components/design-system";
import { rgba } from "@/lib/utils";

type Props = {
  awake: Set<AgentId>;
  speaking: AgentId | null;
  waking: AgentId | null;
  className?: string;
};

export function AgentRail({ awake, speaking, waking, className }: Props) {
  return (
    <aside className={cx("flex flex-col", className)}>
      <div className="mb-5 hidden lg:block">
        <div className={mistClasses.sectionLabel}>
          Your squad
        </div>
        <div className="mt-1 text-[12px] leading-relaxed text-slate-600">
          5 agents, each applying to a different role in parallel
        </div>
      </div>

      {/* mobile: horizontal strip — no connector */}
      <div className="flex gap-3 lg:hidden">
        {AGENT_ORDER.map((id) => {
          const a = AGENTS[id];
          return (
            <div key={id} className="flex flex-1 items-center gap-3">
              <AgentOrb
                id={id}
                awake={awake.has(id)}
                speaking={speaking === id}
                waking={waking === id}
                hue={a.hue}
              />
            </div>
          );
        })}
      </div>

      {/* desktop: vertical column with an animated connector line between orbs */}
      <div className="hidden lg:flex lg:flex-col">
        {AGENT_ORDER.map((id, i) => {
          const a = AGENTS[id];
          const isAwake = awake.has(id);
          const isSpeaking = speaking === id;
          const isWaking = waking === id;
          const isLast = i === AGENT_ORDER.length - 1;
          const nextId = !isLast ? AGENT_ORDER[i + 1] : null;
          const nextAgent = nextId ? AGENTS[nextId] : null;
          const nextIsAwake = nextId ? awake.has(nextId) : false;
          return (
            <React.Fragment key={id}>
              <div className="flex items-center gap-3">
                <AgentOrb
                  id={id}
                  awake={isAwake}
                  speaking={isSpeaking}
                  waking={isWaking}
                  hue={a.hue}
                />
                <div className="min-w-0">
                  <div
                    className="text-[13px] font-medium tracking-tight transition-colors"
                    style={{ color: isAwake ? a.hue : "#6B7A90" }}
                  >
                    {a.name}
                  </div>
                  <div
                    className={cx(
                      "text-[10px] font-mono uppercase tracking-[0.1em] transition-colors",
                      isAwake ? "text-slate-500" : "text-slate-400/70"
                    )}
                  >
                    {a.label}
                  </div>
                </div>
              </div>

              {!isLast && nextAgent && (
                <Connector fromHue={a.hue} toHue={nextAgent.hue} filled={nextIsAwake} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </aside>
  );
}

/** A short vertical line between two orbs; fills from top to bottom with a
 *  color gradient when the next agent wakes up. */
function Connector({
  fromHue,
  toHue,
  filled,
}: {
  fromHue: string;
  toHue: string;
  filled: boolean;
}) {
  return (
    <div className="relative h-6" aria-hidden>
      <div className="absolute bottom-0 left-[27px] top-0 w-[2px] overflow-hidden rounded-full bg-white/45">
        <motion.div
          className="w-full rounded-full"
          style={{
            background: `linear-gradient(to bottom, ${fromHue}, ${toHue})`,
          }}
          initial={{ height: 0 }}
          animate={{ height: filled ? "100%" : 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function AgentOrb({
  id,
  awake,
  speaking,
  waking,
  hue,
}: {
  id: AgentId;
  awake: boolean;
  speaking: boolean;
  waking: boolean;
  hue: string;
}) {
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      {/* shockwave rings on wake */}
      <AnimatePresence>
        {waking && (
          <>
            <motion.span
              key="sw1"
              className="absolute inset-0 rounded-full pointer-events-none"
              initial={{ scale: 0.7, opacity: 0.75 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              style={{ border: `2px solid ${hue}` }}
            />
            <motion.span
              key="sw2"
              className="absolute inset-0 rounded-full pointer-events-none"
              initial={{ scale: 0.7, opacity: 0.5 }}
              animate={{ scale: 3.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeOut", delay: 0.18 }}
              style={{ border: `1.5px solid ${hue}` }}
            />
          </>
        )}
      </AnimatePresence>

      {/* pulsing glow ring when speaking */}
      {speaking && (
        <>
          <motion.div
            className="absolute inset-[-6px] rounded-full"
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ background: `radial-gradient(circle, ${rgba(hue, 0.35)}, transparent 70%)` }}
          />
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{ boxShadow: `0 0 0 2px ${rgba(hue, 0.55)}, 0 0 14px 2px ${rgba(hue, 0.25)}` }}
          />
        </>
      )}

      {/* character with a brief scale bounce on wake */}
      <motion.div
        animate={waking ? { scale: [1, 1.2, 1] } : { scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative"
      >
        <AgentCharacter id={id} awake={awake || speaking} size={52} />
      </motion.div>
    </div>
  );
}
