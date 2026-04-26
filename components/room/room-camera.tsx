"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { useRoomStore } from "./room-store";
import { focusFraming } from "@/lib/room/focus-framing";
import { playerActive, playerPosition } from "@/lib/room/player-position";

const OVERVIEW = {
  pos: [0, 6.8, 12.4] as const,
  look: [0, 1.6, -2.0] as const,
};

const FIXED_AZIMUTH = 0;
const FOLLOW_DAMP = 3;
const FOLLOW_X_LIMIT = 6;
const FOLLOW_EPSILON = 0.0008;
const FOLLOW_TARGET_REUSE = new THREE.Vector3();

export function RoomCamera() {
  const controls = useRef<CameraControls>(null);
  const focusTarget = useRoomStore((s) => s.focusTarget);
  const playerMode = useRoomStore((s) => s.playerMode);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (focusTarget) {
      const framing = focusFraming(focusTarget);
      c.setLookAt(
        framing.cam[0], framing.cam[1], framing.cam[2],
        framing.look[0], framing.look[1], framing.look[2],
        true,
      );
    } else {
      c.setLookAt(
        OVERVIEW.pos[0], OVERVIEW.pos[1], OVERVIEW.pos[2],
        OVERVIEW.look[0], OVERVIEW.look[1], OVERVIEW.look[2],
        true,
      );
    }
  }, [focusTarget]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    if (focusTarget) return;
    if (playerMode !== "walking" || !playerActive.current) return;
    c.getTarget(FOLLOW_TARGET_REUSE);
    const desiredX = THREE.MathUtils.clamp(playerPosition.x, -FOLLOW_X_LIMIT, FOLLOW_X_LIMIT);
    const newX = THREE.MathUtils.damp(FOLLOW_TARGET_REUSE.x, desiredX, FOLLOW_DAMP, delta);
    const dx = newX - FOLLOW_TARGET_REUSE.x;
    if (Math.abs(dx) > FOLLOW_EPSILON) c.truck(dx, 0, false);
  });

  return (
    <CameraControls
      ref={controls}
      smoothTime={0.48}
      draggingSmoothTime={0.25}
      minDistance={4}
      maxDistance={22}
      minPolarAngle={Math.PI * 0.32}
      maxPolarAngle={Math.PI * 0.42}
      minAzimuthAngle={FIXED_AZIMUTH}
      maxAzimuthAngle={FIXED_AZIMUTH}
      azimuthRotateSpeed={0}
      dollySpeed={0}
      truckSpeed={1.4}
      verticalDragToForward={false}
    />
  );
}
