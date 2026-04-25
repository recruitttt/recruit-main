"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { X, ArrowUpRight } from "lucide-react";
import { useRoomStore, type FocusTarget, type FurnitureId } from "./room-store";
import { AGENTS, type AgentId } from "@/lib/agents";
import { applicationForAgent } from "@/lib/room/app-agent-map";
import { mockPersonaReviews, stageLabels } from "@/lib/mock-data";
import { CompanyLogo } from "@/components/ui/logo";
import { StageBadge, Pill } from "@/components/ui/badge";
import { STATIONS, type StationId } from "@/lib/room/stations";
import { cn } from "@/lib/utils";
import { useLiveRoom } from "@/lib/room/use-live-room";

const verdictColors: Record<string, string> = {
  Strong: "text-emerald-700",
  "On the line": "text-amber-700",
  Weak: "text-red-700",
};

export function FocusPanel() {
  const focusTarget = useRoomStore((s) => s.focusTarget);
  const clearFocus = useRoomStore((s) => s.clearFocus);

  return (
    <AnimatePresence>
      {focusTarget ? <PanelShell key={panelKey(focusTarget)} target={focusTarget} onClose={clearFocus} /> : null}
    </AnimatePresence>
  );
}

function panelKey(target: FocusTarget): string {
  return `${target.kind}:${target.id}`;
}

function PanelShell({ target, onClose }: { target: FocusTarget; onClose: () => void }) {
  const accent = panelAccent(target);
  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="pointer-events-auto absolute right-4 top-4 bottom-4 w-[380px] overflow-hidden rounded-[24px] border border-white/50 bg-white/85 shadow-[0_30px_70px_-30px_rgba(15,23,42,0.22),0_12px_32px_-16px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: accent, opacity: 0.9 }}
      />
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-white/50 text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/70 hover:text-slate-800"
        aria-label="Close panel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
        {target.kind === "agent" ? <AgentPanel agentId={target.id} /> : null}
        {target.kind === "station" ? <StationPanel stationId={target.id} /> : null}
        {target.kind === "furniture" ? <FurniturePanel furnitureId={target.id} /> : null}
      </div>
    </motion.div>
  );
}

function panelAccent(target: FocusTarget): string {
  if (target.kind === "agent") return AGENTS[target.id].hue;
  if (target.kind === "station") return STATIONS.find((s) => s.id === target.id)?.accent ?? "#94A3B8";
  return "#94A3B8";
}

function AgentPanel({ agentId }: { agentId: AgentId }) {
  const agent = AGENTS[agentId];
  const app = applicationForAgent(agentId);
  const live = useLiveRoom();
  const liveTask = live.byAgent[agentId];

  const company = liveTask?.company ?? app.company;
  const role = liveTask?.role ?? app.role;
  const stageKey = liveTask?.stage ?? app.stage;
  const tailoringScore = liveTask?.tailoringScore ?? app.tailoringScore;
  const matchScore = liveTask?.matchScore ?? app.matchScore;
  const provider = liveTask?.provider ?? app.provider;
  const location = liveTask?.location ?? app.location;
  const logoBg = liveTask?.logoBg ?? app.logoBg;
  const logoText = liveTask?.logoText ?? app.logoText;

  const scores = [
    { label: "Match", value: matchScore, hint: "JD vs intake" },
    { label: "Tailoring", value: tailoringScore || "—", hint: "Resume rewrite" },
    { label: "Questions", value: "14/14", hint: "Filled" },
    { label: "Cache hits", value: 7, hint: "Saved this run" },
  ];

  return (
    <>
      <div className="px-5 pt-5 pb-4 border-b border-white/45">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B7A90]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: agent.hue, boxShadow: `0 0 8px ${agent.hue}77` }} />
          {agent.name} · {stageLabels[stageKey]}
        </div>
        <div className="mt-3 flex items-start gap-3">
          <CompanyLogo bg={logoBg} text={logoText} size={42} className="rounded-lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[19px] leading-snug text-[#101827]">{role}</h2>
            <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[#465568]">
              <span className="font-medium text-[#101827]">{company}</span>
              <span>·</span>
              <span className="truncate">{location}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StageBadge stage={stageKey} pulse />
              <Pill tone="accent">via {provider}</Pill>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-white/30 border-b border-white/45">
        {scores.map((s) => (
          <div key={s.label} className="bg-white/60 px-3 py-3 flex flex-col gap-1">
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#6B7A90]">{s.label}</div>
            <div className="font-serif text-[20px] leading-none text-[#101827] tabular-nums">{s.value}</div>
            <div className="text-[10px] text-[#6B7A90] leading-tight">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="px-5 pt-4 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B7A90]">Three-persona review</div>
          <Pill tone="accent">pass</Pill>
        </div>
      </div>
      <div className="divide-y divide-white/40 border-y border-white/40">
        {mockPersonaReviews.map((r) => (
          <div key={r.persona} className="px-5 py-4">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[12.5px] font-medium text-[#101827]">{r.persona}</div>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] uppercase tracking-[0.15em] font-mono", verdictColors[r.verdict])}>{r.verdict}</span>
                <span className="font-mono text-[13px] text-[#101827] tabular-nums">{r.score}</span>
              </div>
            </div>
            <p className="text-[11.5px] text-[#465568] leading-relaxed">{r.notes}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto px-5 py-4 border-t border-white/45 bg-white/40">
        <Link
          href={`/applications/${app.id}`}
          className="flex items-center justify-between rounded-[16px] border border-white/60 bg-white/55 px-4 py-3 text-[13px] font-medium text-[#101827] shadow-[inset_0_1px_0_rgba(255,255,255,0.80)] transition hover:bg-white/70"
        >
          <span>Open full detail</span>
          <ArrowUpRight className="h-4 w-4 text-[#465568]" />
        </Link>
        <div className="mt-2 font-mono text-[10px] text-[#6B7A90] text-center">click × to close</div>
      </div>
    </>
  );
}

const STATION_BLURBS: Record<StationId, { title: string; tagline: string; body: string }> = {
  jobboard: {
    title: "Job board",
    tagline: "Where new openings land",
    body: "Each pinned card is a freshly ingested role from a connected ATS source. Scout glances over to check headcount and pulls a card off the board when she's ready to start tailoring.",
  },
  workbench: {
    title: "Workbench",
    tagline: "Resume tailoring desk",
    body: "Agents sit here while the tailor model rewrites a resume against the job description, validates keyword coverage, and runs the three-persona review. The monitor pulses while the run is in flight.",
  },
  review: {
    title: "Review panel",
    tagline: "Three-persona quality gate",
    body: "Floating cards represent recruiter, hiring manager, and IC reviewers. Each scores the tailored draft; if any persona pushes back, the agent rewrites before moving on.",
  },
  submit: {
    title: "Submit terminal",
    tagline: "Form fill + send",
    body: "The submit station auto-completes the application, attaches the tailored resume PDF, answers cached screening questions, and confirms a successful submission with the green ring.",
  },
  calendar: {
    title: "Calendar desk",
    tagline: "Submitted + follow-ups",
    body: "Submitted applications land here. The calendar tracks follow-up due dates and the desk lights up when an interview moves forward.",
  },
};

function StationPanel({ stationId }: { stationId: StationId }) {
  const blurb = STATION_BLURBS[stationId];
  const station = STATIONS.find((s) => s.id === stationId) ?? STATIONS[0];
  const live = useLiveRoom();
  const agentsHere = Object.entries(live.byAgent)
    .filter(([, t]) => t?.stage === station.stage)
    .map(([id]) => id as AgentId);

  return (
    <>
      <div className="px-5 pt-5 pb-4 border-b border-white/45">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B7A90]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: station.accent, boxShadow: `0 0 8px ${station.accent}77` }} />
          Station · {stageLabels[station.stage]}
        </div>
        <h2 className="mt-3 font-serif text-[22px] leading-snug text-[#101827]">{blurb.title}</h2>
        <div className="mt-1 text-[12.5px] text-[#465568]">{blurb.tagline}</div>
      </div>
      <div className="px-5 pt-4 pb-4 border-b border-white/45">
        <p className="text-[13px] leading-relaxed text-[#101827]">{blurb.body}</p>
      </div>
      <div className="px-5 pt-4 pb-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B7A90]">Agents currently here</div>
      </div>
      <div className="px-5 pb-4 flex flex-wrap gap-2">
        {agentsHere.length === 0 ? (
          <span className="text-[12px] text-[#6B7A90]">No one at this station right now.</span>
        ) : (
          agentsHere.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/60 px-2.5 py-1 text-[11.5px] font-medium text-[#101827]"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: AGENTS[id].hue }} />
              {AGENTS[id].name}
            </span>
          ))
        )}
      </div>
      <div className="mt-auto px-5 py-4 border-t border-white/45 bg-white/40">
        <div className="font-mono text-[10px] text-[#6B7A90] text-center">click × to close</div>
      </div>
    </>
  );
}

const FURNITURE_BLURBS: Record<FurnitureId, { title: string; body: string }> = {
  sofa: {
    title: "The sofa",
    body: "Where agents take a quick break between runs. Tap an agent to see what they're up to.",
  },
  "coffee-table": {
    title: "Coffee table",
    body: "Stack of design references and a half-finished mug. The squad's morale center.",
  },
  tv: {
    title: "Wall TV",
    body: "Loops the latest activity feed — pipeline events, submissions, and follow-up reminders.",
  },
  bookshelf: {
    title: "Bookshelf",
    body: "Reference docs, ATS connector manuals, and a few plants. Mostly decorative.",
  },
  window: {
    title: "Window to the beach",
    body: "Cycles between dawn, noon, and dusk over the course of a long pipeline run. Mostly there to keep morale high.",
  },
  plant: {
    title: "House plant",
    body: "Low maintenance, tropical, very on-brand. Sways gently when the air conditioning kicks in.",
  },
  "ceiling-fan": {
    title: "Ceiling fan",
    body: "Spins faster when the pipeline is busy. (Currently set to its default leisurely pace.)",
  },
};

function FurniturePanel({ furnitureId }: { furnitureId: FurnitureId }) {
  const blurb = FURNITURE_BLURBS[furnitureId];
  return (
    <>
      <div className="px-5 pt-5 pb-4 border-b border-white/45">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#6B7A90]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]" />
          Room detail
        </div>
        <h2 className="mt-3 font-serif text-[22px] leading-snug text-[#101827]">{blurb.title}</h2>
      </div>
      <div className="px-5 pt-4 pb-4">
        <p className="text-[13px] leading-relaxed text-[#101827]">{blurb.body}</p>
      </div>
      <div className="mt-auto px-5 py-4 border-t border-white/45 bg-white/40">
        <div className="font-mono text-[10px] text-[#6B7A90] text-center">click × to close</div>
      </div>
    </>
  );
}
