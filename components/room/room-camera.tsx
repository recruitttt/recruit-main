"use client";

import { useEffect, useRef } from "react";
import { CameraControls } from "@react-three/drei";
import { useRoomStore } from "./room-store";
import { agentHomePosition } from "@/lib/room/app-agent-map";

const OVERVIEW = {
  pos: [0, 6.8, 12.4] as const,
  look: [0, 1.6, -2.0] as const,
};

export function RoomCamera() {
  const controls = useRef<CameraControls>(null);
  const selected = useRoomStore((s) => s.selectedAgentId);

  useEffect(() => {
    if (!controls.current) return;
    if (selected) {
      const target = agentHomePosition(selected);
      controls.current.setLookAt(
        target.x - 2.8, 2.9, target.z + 5.6,
        target.x + 1.6, 0.9, target.z + 0.3,
        true
      );
    } else {
      controls.current.setLookAt(
        OVERVIEW.pos[0], OVERVIEW.pos[1], OVERVIEW.pos[2],
        OVERVIEW.look[0], OVERVIEW.look[1], OVERVIEW.look[2],
        true
      );
    }
  }, [selected]);

  return (
    <CameraControls
      ref={controls}
      smoothTime={0.48}
      draggingSmoothTime={0.25}
      minDistance={4}
      maxDistance={22}
      minPolarAngle={Math.PI * 0.14}
      maxPolarAngle={Math.PI * 0.44}
      dollySpeed={0}
      truckSpeed={0}
    />
  );
}
