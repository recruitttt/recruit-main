"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useRoomStore } from "./room-store";
import { focusFraming, type Framing } from "@/lib/room/focus-framing";
import { playerActive, playerPosition } from "@/lib/room/player-position";

const OVERVIEW_POS = [0, 6.8, 12.4] as const;
const OVERVIEW_LOOK = [0, 1.6, -2.0] as const;

const FOCUS_SMOOTH_TIME = 0.35;
const PARALLAX_SMOOTH_TIME = 0.6;

const PARALLAX_X_MAX = 0.3;
const PARALLAX_Y_MAX = 0.3;

const FOLLOW_SMOOTH_TIME = 0.45;
const FOLLOW_X_LIMIT = 6;
const FOLLOW_CAMERA_TRACK = 0.5;

/**
 * Resolves the active focus framing from the room store. Returns `null` when
 * the camera should sit in overview mode.
 */
export function useCameraFocus(): Framing | null {
  const focusTarget = useRoomStore((s) => s.focusTarget);
  const cameraMode = useRoomStore((s) => s.cameraMode);
  return useMemo(() => {
    if (cameraMode !== "focus" || !focusTarget) return null;
    return focusFraming(focusTarget);
  }, [cameraMode, focusTarget]);
}

export function RoomCamera() {
  const focus = useCameraFocus();
  const playerMode = useRoomStore((s) => s.playerMode);

  // Reuse vectors across frames — `useFrame` runs every tick, so allocating
  // here would churn GC and tank framerate.
  const temps = useMemo(
    () => ({
      basePos: new THREE.Vector3(),
      baseLook: new THREE.Vector3(),
      parallaxOffset: new THREE.Vector3(),
      parallaxTarget: new THREE.Vector3(),
    }),
    [],
  );
  const lookCurrent = useRef(
    new THREE.Vector3(OVERVIEW_LOOK[0], OVERVIEW_LOOK[1], OVERVIEW_LOOK[2]),
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const camera = state.camera;
    const followX = playerMode === "walking" && playerActive.current;

    if (focus) {
      temps.basePos.set(focus.cam[0], focus.cam[1], focus.cam[2]);
      temps.baseLook.set(focus.look[0], focus.look[1], focus.look[2]);
    } else {
      temps.basePos.set(OVERVIEW_POS[0], OVERVIEW_POS[1], OVERVIEW_POS[2]);
      temps.baseLook.set(OVERVIEW_LOOK[0], OVERVIEW_LOOK[1], OVERVIEW_LOOK[2]);
      if (followX) {
        const desiredX = THREE.MathUtils.clamp(
          playerPosition.x,
          -FOLLOW_X_LIMIT,
          FOLLOW_X_LIMIT,
        );
        temps.baseLook.x = desiredX;
        temps.basePos.x = desiredX * FOLLOW_CAMERA_TRACK;
      }
    }

    // Parallax disabled while focused so it doesn't fight the focus framing.
    const px = focus ? 0 : state.pointer.x * PARALLAX_X_MAX;
    const py = focus ? 0 : state.pointer.y * PARALLAX_Y_MAX;
    temps.parallaxTarget.set(px, py, 0);
    easing.damp3(
      temps.parallaxOffset,
      temps.parallaxTarget,
      PARALLAX_SMOOTH_TIME,
      dt,
    );
    temps.basePos.add(temps.parallaxOffset);

    const positionSmooth = focus ? FOCUS_SMOOTH_TIME : FOLLOW_SMOOTH_TIME;
    easing.damp3(camera.position, temps.basePos, positionSmooth, dt);
    easing.damp3(lookCurrent.current, temps.baseLook, FOCUS_SMOOTH_TIME, dt);
    camera.lookAt(lookCurrent.current);
  });

  return null;
}
