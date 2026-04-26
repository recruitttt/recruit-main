"use client";

import { Html } from "@react-three/drei";
import { AGENTS, type AgentId } from "@/lib/agents";
import { applicationForAgent } from "@/lib/room/app-agent-map";
import { stageLabels } from "@/lib/mock-data";
import { useRoomStore } from "./room-store";

export function RoomNameChip({ agentId }: { agentId: AgentId }) {
  const agent = AGENTS[agentId];
  const app = applicationForAgent(agentId);
  const hovered = useRoomStore((s) => s.hoveredAgentId === agentId);
  const selected = useRoomStore((s) => s.selectedAgentId === agentId);
  const active = hovered || selected;

  return (
    <Html
      position={[0, 1.75, 0]}
      center
      distanceFactor={2.6}
      occlude={false}
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        style={{
          transform: `scale(${active ? 1.06 : 1})`,
          transition: "transform 160ms ease-out, opacity 160ms ease-out",
          opacity: active ? 1 : 0.78,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "4px 10px 4px 8px",
            borderRadius: 999,
            background: "rgba(248, 251, 255, 0.92)",
            border: `1px solid ${active ? agent.hue : "rgba(255,255,255,0.65)"}`,
            boxShadow: active
              ? `0 6px 18px -8px ${agent.hue}66, 0 2px 6px -2px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.80)`
              : "0 2px 6px -2px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.70)",
            backdropFilter: "blur(12px)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: agent.hue, boxShadow: `0 0 6px ${agent.hue}AA` }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", color: "#101827" }}>
            {agent.name}
          </span>
          {active ? (
            <span style={{ fontSize: 10, color: "#465568", fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", textTransform: "lowercase" }}>
              · {stageLabels[app.stage].toLowerCase()} · {app.company}
            </span>
          ) : null}
        </div>
      </div>
    </Html>
  );
}
