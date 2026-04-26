"use client";

import { Html } from "@react-three/drei";
import { AGENTS, type AgentId } from "@/lib/agents";
import { useLiveRoom } from "@/lib/room/use-live-room";

const STAGE_TINT: Record<string, string> = {
  queued: "#94A3B8",
  tailoring: "#D97706",
  reviewing: "#7C3AED",
  submitting: "#3F7A56",
  submitted: "#059669",
  blocked: "#DC2626",
};

export function AgentJobCard({ agentId }: { agentId: AgentId }) {
  const live = useLiveRoom();
  const task = live.byAgent[agentId];
  if (!task) return null;
  const tint = STAGE_TINT[task.stage] ?? AGENTS[agentId].hue;

  return (
    <Html
      position={[0, 1.78, 0]}
      center
      distanceFactor={9}
      style={{ pointerEvents: "none" }}
      zIndexRange={[40, 0]}
      occlude={false}
    >
      <div className="pointer-events-none -translate-y-2 select-none rounded-[10px] border border-white/45 bg-white/72 px-2 py-1 shadow-[0_10px_22px_-16px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-md">
        <div className="flex max-w-[110px] items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: tint, boxShadow: `0 0 6px ${tint}88` }}
          />
          <span className="truncate text-[10.5px] font-semibold leading-none text-[#101827]">
            {task.company}
          </span>
        </div>
      </div>
    </Html>
  );
}
