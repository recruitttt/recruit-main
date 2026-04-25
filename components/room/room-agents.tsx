"use client";

import { AGENT_ORDER } from "@/lib/agents";
import { RoomAgent } from "./room-agent";

export function RoomAgents() {
  return (
    <group>
      {AGENT_ORDER.map((id) => (
        <RoomAgent key={id} agentId={id} />
      ))}
    </group>
  );
}
