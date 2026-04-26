"use client";

import { AGENT_ORDER, type AgentId } from "@/lib/agents";
import { RoomAgent } from "./room-agent";

export function RoomAgents({ hiddenAgentId }: { hiddenAgentId?: AgentId | null }) {
  return (
    <group>
      {AGENT_ORDER.map((id) => (
        id === hiddenAgentId ? null : <RoomAgent key={id} agentId={id} />
      ))}
    </group>
  );
}
