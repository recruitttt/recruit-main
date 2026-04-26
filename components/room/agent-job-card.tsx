"use client";

import { Html } from "@react-three/drei";
import { AGENTS, type AgentId } from "@/lib/agents";
import { useLiveRoom } from "@/lib/room/use-live-room";
import { stageLabels } from "@/lib/mock-data";

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
      <div className="pointer-events-none -translate-y-2 select-none rounded-[14px] border border-white/55 bg-[#F8FBFF]/92 px-2.5 py-1.5 shadow-[0_12px_28px_-14px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-md">
        <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-[#6B7A90]">
          <span
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: tint, boxShadow: `0 0 6px ${tint}88` }}
          />
          {stageLabels[task.stage]}
        </div>
        <div className="mt-0.5 max-w-[150px] truncate text-[10.5px] font-semibold leading-tight text-[#101827]">
          {task.company}
        </div>
        <div className="max-w-[150px] truncate text-[9.5px] leading-tight text-[#465568]">
          {task.role}
        </div>
      </div>
    </Html>
  );
}
