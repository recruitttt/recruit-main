"use client";

import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useState } from "react";

import { cx, Panel } from "@/components/design-system";
import { AGENTS } from "@/lib/agents";
import {
  mockAgentWorkLog,
  type AgentWorkEntry,
  type DiffPayload,
  type KeywordsPayload,
  type ResearchPayload,
} from "@/lib/agent-work-log";

const TAG_STYLES: Record<string, string> = {
  "tech stack": "bg-violet-100 text-violet-700 border-violet-200",
  culture: "bg-amber-100 text-amber-700 border-amber-200",
  growth: "bg-emerald-100 text-emerald-700 border-emerald-200",
  team: "bg-sky-100 text-sky-700 border-sky-200",
};

function useTypewriter(text: string, startDelay: number, charDelay = 16) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    const t = setTimeout(() => {
      let i = 0;
      iv = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(iv); setDone(true); }
      }, charDelay);
    }, startDelay);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [text, startDelay, charDelay]);

  return { displayed, done };
}

function AnimatedNumber({ from, to, delay = 0 }: { from: number; to: number; delay?: number }) {
  const mv = useMotionValue(from);
  const [display, setDisplay] = useState(from);

  useEffect(() => {
    const controls = animate(mv, to, { duration: 1.2, delay, ease: "easeOut" });
    const unsub = mv.on("change", (v) => setDisplay(Math.round(v)));
    return () => { controls.stop(); unsub(); };
  }, [from, to, delay, mv]);

  return <>{display}</>;
}

function AgentDot({ agentId, isLive }: { agentId: AgentWorkEntry["agentId"]; isLive?: boolean }) {
  const agent = AGENTS[agentId];
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      {isLive && (
        <motion.span
          animate={{ scale: [1, 1.9, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
          className="absolute inline-block rounded-full"
          style={{ width: 14, height: 14, backgroundColor: agent.hue, opacity: 0.4 }}
        />
      )}
      <span
        className="relative inline-block rounded-full"
        style={{ width: 9, height: 9, backgroundColor: agent.hue }}
      />
    </span>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", className)}>
      {children}
    </span>
  );
}

function StrikethroughLine({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.55, ease: "easeInOut", delay }}
      style={{ originX: 0 }}
      className="absolute inset-x-3 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-rose-400"
    />
  );
}

function DiffBody({ payload, isLive, cardDelay }: { payload: DiffPayload; isLive?: boolean; cardDelay: number }) {
  const strikeDelay = isLive ? cardDelay + 0.35 : 0;
  const typeDelay = isLive ? (cardDelay + 1.05) * 1000 : 0;
  const { displayed, done } = useTypewriter(isLive ? payload.after : "", typeDelay);

  return (
    <div className="mt-3 space-y-1.5">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: cardDelay + 0.15, duration: 0.3 }}
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
      >
        {payload.section}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: cardDelay + 0.2, duration: 0.3 }}
        className="relative overflow-hidden rounded-[10px] border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-sm leading-6 text-rose-700"
      >
        {payload.before}
        <StrikethroughLine delay={strikeDelay} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: isLive ? cardDelay + 0.95 : cardDelay + 0.28, duration: 0.3 }}
        className="min-h-[2.75rem] overflow-hidden rounded-[10px] border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-sm leading-6 text-emerald-900"
      >
        {isLive ? (
          <>
            {displayed}
            {!done && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.55 }}
                className="ml-px inline-block h-[1em] w-[2px] translate-y-[2px] rounded-sm bg-emerald-600"
              />
            )}
          </>
        ) : (
          payload.after
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: isLive ? cardDelay + 1.8 : cardDelay + 0.35, duration: 0.4 }}
        className="flex items-start gap-1.5 pt-0.5"
      >
        <span className="mt-px shrink-0 font-mono text-[10px] text-slate-400">why</span>
        <span className="text-xs italic text-slate-500">{payload.reason}</span>
      </motion.div>
    </div>
  );
}

const pillVariants = {
  hidden: { opacity: 0, scale: 0.75 },
  visible: { opacity: 1, scale: 1 },
};

function KeywordsBody({ payload, cardDelay }: { payload: KeywordsPayload; cardDelay: number }) {
  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-slate-400">coverage</span>
        <span className="font-mono text-sm font-semibold text-slate-500">
          <AnimatedNumber from={payload.coverageBefore} to={payload.coverageBefore} delay={cardDelay} />%
        </span>
        <span className="font-mono text-[11px] text-slate-400">→</span>
        <span className="font-mono text-sm font-semibold text-emerald-700">
          <AnimatedNumber from={payload.coverageBefore} to={payload.coverageAfter} delay={cardDelay + 0.2} />%
        </span>
      </div>

      {/* Coverage bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: `${payload.coverageBefore}%` }}
          animate={{ width: `${payload.coverageAfter}%` }}
          transition={{ duration: 1.2, delay: cardDelay + 0.2, ease: "easeOut" }}
          className="h-full rounded-full bg-sky-500"
          style={{ boxShadow: "0 0 10px rgba(14,165,233,0.55)" }}
        />
      </div>

      <div className="space-y-1.5 pt-0.5">
        {payload.matched.length > 0 && (
          <motion.div
            className="flex flex-wrap items-start gap-1.5"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.055, delayChildren: cardDelay + 0.35 } } }}
          >
            <span className="mt-0.5 shrink-0 font-mono text-[10px] font-semibold text-emerald-600">✓</span>
            {payload.matched.map((kw) => (
              <motion.span key={kw} variants={pillVariants} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                <Pill className="border-emerald-200 bg-emerald-50 text-emerald-700">{kw}</Pill>
              </motion.span>
            ))}
          </motion.div>
        )}
        {payload.added.length > 0 && (
          <motion.div
            className="flex flex-wrap items-start gap-1.5"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.055, delayChildren: cardDelay + 0.55 } } }}
          >
            <span className="mt-0.5 shrink-0 font-mono text-[10px] font-semibold text-sky-600">+</span>
            {payload.added.map((kw) => (
              <motion.span key={kw} variants={pillVariants} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                <Pill className="border-sky-200 bg-sky-50 text-sky-700">{kw}</Pill>
              </motion.span>
            ))}
          </motion.div>
        )}
        {payload.missing.length > 0 && (
          <motion.div
            className="flex flex-wrap items-start gap-1.5"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.055, delayChildren: cardDelay + 0.75 } } }}
          >
            <span className="mt-0.5 shrink-0 font-mono text-[10px] font-semibold text-amber-500">○</span>
            {payload.missing.map((kw) => (
              <motion.span key={kw} variants={pillVariants} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                <Pill className="border-amber-200/70 bg-amber-50 text-amber-600">{kw}</Pill>
              </motion.span>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ResearchBody({ payload, cardDelay }: { payload: ResearchPayload; cardDelay: number }) {
  return (
    <div className="mt-3 space-y-2">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: cardDelay + 0.15, duration: 0.3 }}
        className="font-mono text-[10px] text-slate-400"
      >
        {payload.sources}
      </motion.div>
      <div className="space-y-1.5">
        {payload.insights.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: cardDelay + 0.2 + i * 0.1, duration: 0.32, ease: "easeOut" }}
            className="flex items-start gap-2"
          >
            <Pill className={cx("mt-0.5 shrink-0", TAG_STYLES[insight.tag] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
              {insight.tag}
            </Pill>
            <span className="text-sm leading-5 text-slate-700">{insight.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function WorkCard({ entry, index }: { entry: AgentWorkEntry; index: number }) {
  const agent = AGENTS[entry.agentId];
  const isLive = entry.status === "live";
  const cardDelay = index * 0.07;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 24, delay: cardDelay }}
      className={cx(
        "relative overflow-hidden rounded-[18px] border bg-white/80 px-4 py-3.5",
        isLive
          ? "border-sky-300/80 shadow-[0_0_0_1px_rgba(56,189,248,0.3),0_4px_20px_rgba(8,145,178,0.12)]"
          : "border-[var(--color-border)] shadow-[0_2px_8px_rgba(15,23,42,0.05)]",
      )}
    >
      {isLive && (
        <motion.div
          animate={{ opacity: [0.08, 0.18, 0.08] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="pointer-events-none absolute inset-0 rounded-[18px]"
          style={{ background: `radial-gradient(ellipse at 10% 50%, ${agent.hue}22 0%, transparent 70%)` }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AgentDot agentId={entry.agentId} isLive={isLive} />
          <span className="text-sm font-semibold" style={{ color: agent.hue }}>{agent.name}</span>
          <span className="text-slate-300">·</span>
          <span className="text-sm font-medium text-slate-700">{entry.company}</span>
          <span className="hidden text-xs text-slate-400 sm:inline">{entry.role}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.1 }}
                className="h-1.5 w-1.5 rounded-full bg-sky-500"
              />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-600">live</span>
            </span>
          )}
          <span className="font-mono text-[11px] text-slate-400">{entry.timestamp}</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: cardDelay + 0.1, duration: 0.25 }}
        className="mt-1 text-xs font-semibold text-slate-500"
      >
        {entry.label}
      </motion.div>

      {entry.kind === "diff" && <DiffBody payload={entry.payload as DiffPayload} isLive={isLive} cardDelay={cardDelay} />}
      {entry.kind === "keywords" && <KeywordsBody payload={entry.payload as KeywordsPayload} cardDelay={cardDelay} />}
      {entry.kind === "research" && <ResearchBody payload={entry.payload as ResearchPayload} cardDelay={cardDelay} />}
    </motion.div>
  );
}

export function AgentWorkLogPanel({ replayKey = 0 }: { replayKey?: number }) {
  const liveCount = mockAgentWorkLog.filter((e) => e.status === "live").length;

  return (
    <Panel
      title="Agent Work Log"
      actions={
        <span className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.1 }}
            className="h-1.5 w-1.5 rounded-full bg-sky-500"
          />
          {liveCount === 1 ? "1 agent working" : `${liveCount} agents working`}
        </span>
      }
    >
      <div key={replayKey} className="no-scrollbar max-h-[640px] space-y-2.5 overflow-y-auto pr-0.5">
        {mockAgentWorkLog.map((entry, i) => (
          <WorkCard key={entry.id} entry={entry} index={i} />
        ))}
      </div>
    </Panel>
  );
}
