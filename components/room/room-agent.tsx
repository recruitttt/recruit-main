"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { AGENTS, type AgentId } from "@/lib/agents";
import {
  agentHomePosition,
  pickWanderTarget,
  stationForAgent,
} from "@/lib/room/app-agent-map";
import {
  WALK_SPEED,
  BOB_AMPLITUDE,
  LIMB_SWING,
  phase,
  dampYaw,
} from "@/lib/room/walk";
import { AgentFigure, useAgentRefs } from "./agent-figure";
import { useRoomStore } from "./room-store";

type Props = {
  agentId: AgentId;
};

/**
 * Behavioral shell around the shared AgentFigure: walking, wandering,
 * breathing, station-specific idle gestures, hover/click handlers.
 */
export function RoomAgent({ agentId }: Props) {
  const hue = AGENTS[agentId].hue;
  const refs = useAgentRefs();

  const hovered = useRoomStore((s) => s.hoveredAgentId === agentId);
  const selected = useRoomStore((s) => s.selectedAgentId === agentId);
  const setHovered = useRoomStore((s) => s.setHovered);
  const setSelected = useRoomStore((s) => s.setSelected);

  const initialPos = useMemo(() => agentHomePosition(agentId), [agentId]);
  const wanderState = useRef({
    target: initialPos.clone(),
    nextRollAt: Math.random() * 4 + 2,
    lastIdle: 0,
  });

  // Place the agent at its home station on mount. Without this, the root
  // group sits at world origin and the wander vectors pull it off the map.
  useEffect(() => {
    if (refs.group.current) {
      refs.group.current.position.copy(initialPos);
    }
  }, [initialPos, refs.group]);

  useFrame(({ clock }, delta) => {
    const g = refs.group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const station = stationForAgent(agentId);

    if (t > wanderState.current.nextRollAt) {
      const bucket = Math.floor(t / 3);
      wanderState.current.target = pickWanderTarget(agentId, bucket);
      wanderState.current.nextRollAt = t + 3 + Math.random() * 3;
    }

    const target = wanderState.current.target;
    const pos = g.position;
    const toTarget = new THREE.Vector3().subVectors(target, pos);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist > 0.06) {
      toTarget.normalize().multiplyScalar(Math.min(WALK_SPEED * delta, dist));
      pos.add(toTarget);
      g.rotation.y = dampYaw(g.rotation.y, station.facing, delta);

      if (refs.body.current) {
        refs.body.current.position.y = 0.47 + phase(t) * BOB_AMPLITUDE;
        refs.body.current.rotation.z = phase(t) * 0.03;
      }
      if (refs.legL.current) refs.legL.current.rotation.x = phase(t) * LIMB_SWING;
      if (refs.legR.current) refs.legR.current.rotation.x = phase(t, Math.PI) * LIMB_SWING;
      if (refs.armL.current) refs.armL.current.rotation.x = phase(t, Math.PI) * LIMB_SWING * 0.9;
      if (refs.armR.current) refs.armR.current.rotation.x = phase(t) * LIMB_SWING * 0.9;
      if (refs.armL.current) refs.armL.current.rotation.z = 0;
      if (refs.armR.current) refs.armR.current.rotation.z = 0;
      if (refs.head.current) {
        const walkYaw = Math.atan2(toTarget.x, toTarget.z) - station.facing;
        const clamped = Math.max(-0.9, Math.min(0.9, walkYaw));
        refs.head.current.rotation.y = THREE.MathUtils.damp(
          refs.head.current.rotation.y,
          clamped * 0.5,
          3,
          delta
        );
      }
      if (refs.wristL.current) {
        refs.wristL.current.rotation.x = 0;
        refs.wristL.current.rotation.z = 0;
      }
      if (refs.wristR.current) {
        refs.wristR.current.rotation.x = 0;
        refs.wristR.current.rotation.z = 0;
      }
    } else {
      const facing = selected ? -0.55 : station.facing;
      g.rotation.y = dampYaw(g.rotation.y, facing, delta);
      wanderState.current.lastIdle += delta;

      const breath = Math.sin(t * 1.4 + seed(agentId)) * 0.016;
      const tiny = Math.sin(t * 0.9 + seed(agentId) * 1.7) * 0.006;
      if (refs.body.current) {
        refs.body.current.position.y = 0.47 + breath;
        refs.body.current.scale.y = 1 + breath * 0.6;
        refs.body.current.rotation.z = tiny;
      }
      if (refs.legL.current) {
        refs.legL.current.rotation.x = THREE.MathUtils.damp(
          refs.legL.current.rotation.x,
          0,
          5,
          delta
        );
      }
      if (refs.legR.current) {
        refs.legR.current.rotation.x = THREE.MathUtils.damp(
          refs.legR.current.rotation.x,
          0,
          5,
          delta
        );
      }

      const stationIdle = stationIdleFor(station.id, t, agentId);
      if (refs.armL.current) {
        refs.armL.current.rotation.x = THREE.MathUtils.damp(
          refs.armL.current.rotation.x,
          stationIdle.armL,
          5,
          delta
        );
        refs.armL.current.rotation.z = THREE.MathUtils.damp(
          refs.armL.current.rotation.z,
          stationIdle.armLz ?? 0,
          4,
          delta
        );
      }
      if (refs.armR.current) {
        refs.armR.current.rotation.x = THREE.MathUtils.damp(
          refs.armR.current.rotation.x,
          stationIdle.armR,
          5,
          delta
        );
        refs.armR.current.rotation.z = THREE.MathUtils.damp(
          refs.armR.current.rotation.z,
          stationIdle.armRz ?? 0,
          4,
          delta
        );
      }
      if (refs.wristL.current) {
        refs.wristL.current.rotation.x = stationIdle.wristLx ?? 0;
        refs.wristL.current.rotation.z = stationIdle.wristLz ?? 0;
      }
      if (refs.wristR.current) {
        refs.wristR.current.rotation.x = stationIdle.wristRx ?? 0;
        refs.wristR.current.rotation.z = stationIdle.wristRz ?? 0;
      }
      if (refs.head.current) {
        refs.head.current.rotation.y = THREE.MathUtils.damp(
          refs.head.current.rotation.y,
          stationIdle.headYaw,
          3.5,
          delta
        );
        refs.head.current.rotation.x = THREE.MathUtils.damp(
          refs.head.current.rotation.x,
          stationIdle.headPitch,
          3,
          delta
        );
      }
    }
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(agentId);
    document.body.style.cursor = "pointer";
  };
  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(null);
    document.body.style.cursor = "";
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelected(selected ? null : agentId);
  };

  const outlineOpacity = selected ? 0.85 : hovered ? 0.55 : 0;

  return (
    <AgentFigure
      agentId={agentId}
      refs={refs}
      outlineColor={hue}
      outlineOpacity={outlineOpacity}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    />
  );
}

function seed(id: AgentId): number {
  const map: Record<AgentId, number> = {
    scout: 0,
    mimi: 1.4,
    pip: 2.8,
    juno: 4.2,
    bodhi: 5.6,
  };
  return map[id];
}

type StationIdle = {
  armL: number;
  armR: number;
  armLz?: number;
  armRz?: number;
  wristLx?: number;
  wristLz?: number;
  wristRx?: number;
  wristRz?: number;
  headYaw: number;
  headPitch: number;
};

function stationIdleFor(
  stationId: string,
  t: number,
  agentId: AgentId
): StationIdle {
  const s = seed(agentId);
  switch (stationId) {
    case "workbench": {
      // Typing at a keyboard: both arms extended forward, fingers tap quickly
      // via wrist rotation.x. Slight alternation between the two hands.
      const tap = Math.sin(t * 16 + s) * 0.22;
      const tapAlt = Math.sin(t * 16 + s + Math.PI) * 0.22;
      return {
        armL: -0.62 + Math.sin(t * 2.2 + s) * 0.04,
        armR: -0.62 + Math.sin(t * 2.2 + s + 0.4) * 0.04,
        armLz: 0.08,
        armRz: -0.08,
        wristLx: tap,
        wristRx: tapAlt,
        headYaw: Math.sin(t * 0.5 + s) * 0.06,
        headPitch: 0.25 + Math.sin(t * 0.4 + s) * 0.04,
      };
    }
    case "review": {
      // Pointing at the three review cards: right hand reaches up and taps,
      // left hand rests; head tracks the card the hand is pointing at.
      const cycle = Math.sin(t * 0.9 + s);
      const tapPulse = Math.max(0, Math.sin(t * 4 + s));
      return {
        armL: -0.15 + Math.sin(t * 1.1 + s) * 0.05,
        armR: -0.8 - tapPulse * 0.25,
        armRz: cycle * 0.45,
        wristRz: Math.sin(t * 3 + s) * 0.18,
        headYaw: cycle * 0.4,
        headPitch: 0.08,
      };
    }
    case "submit": {
      // Pushing an envelope into the slot: right arm extends forward in a
      // repeated push-retract motion. Hand pivots on the push.
      const push = Math.max(0, Math.sin(t * 2.3 + s));
      const pushEase = push * push;
      return {
        armL: -0.1 + Math.sin(t * 2.3 + s + 0.3) * 0.04,
        armR: -0.4 - pushEase * 0.75,
        armRz: -0.15,
        wristRx: -pushEase * 0.35,
        headYaw: Math.sin(t * 0.6 + s) * 0.08,
        headPitch: 0.06,
      };
    }
    case "jobboard": {
      // Reading the board: left arm gestures toward different papers, right
      // arm idle at side. Head sweeps across the board.
      const reach = Math.max(0, Math.sin(t * 0.7 + s));
      const sweep = Math.sin(t * 0.45 + s);
      return {
        armL: -0.3 - reach * 0.6,
        armLz: 0.35 + sweep * 0.4,
        wristLx: -reach * 0.25,
        armR: -0.05 + Math.sin(t * 1.1 + s + 0.6) * 0.04,
        headYaw: sweep * 0.32,
        headPitch: -0.05 + Math.sin(t * 0.3 + s) * 0.04,
      };
    }
    case "calendar": {
      // Writing on the calendar desk: right arm down and forward on the
      // surface, wrist wiggles as if drawing. Left arm steadies a page.
      const draw = Math.sin(t * 4.5 + s);
      return {
        armL: -0.55 + Math.sin(t * 1.5 + s) * 0.04,
        armLz: 0.12,
        armR: -0.7 + Math.sin(t * 3 + s) * 0.06,
        armRz: -0.12,
        wristRx: Math.sin(t * 6 + s) * 0.18,
        wristRz: draw * 0.22,
        headYaw: Math.sin(t * 0.6 + s) * 0.1,
        headPitch: 0.3 + Math.sin(t * 0.5 + s) * 0.04,
      };
    }
    default:
      return { armL: 0, armR: 0, headYaw: 0, headPitch: 0 };
  }
}
