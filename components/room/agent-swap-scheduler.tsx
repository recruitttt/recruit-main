"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { swapTwoAgentStations } from "@/lib/room/app-agent-map";
import { useRoomStore } from "./room-store";

export function AgentSwapScheduler() {
  const nextAtRef = useRef(2 + Math.random() * 4);
  const intakePhase = useRoomStore((s) => s.intakePhase);

  useFrame(({ clock }) => {
    if (intakePhase !== "inactive") return;
    const t = clock.elapsedTime;
    if (t < nextAtRef.current) return;
    swapTwoAgentStations();
    nextAtRef.current = t + 4 + Math.random() * 6;
  });

  return null;
}
