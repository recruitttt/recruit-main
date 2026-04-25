"use client";

import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { RoundedBox, Outlines } from "@react-three/drei";
import { AGENTS, type AgentId } from "@/lib/agents";
import { useAgentFaceTexture } from "./face-texture";
import { AgentTopper } from "./room-agent-topper";

/**
 * Shared presentational character. Both the room (RoomAgent) and the
 * onboarding → room transition (SceneTransition) render the SAME meshes,
 * proportions, palette, face texture, and topper via this component, so
 * the Scout that waves in the chat is literally the same Scout that lives
 * in the room.
 *
 * Parent passes in refs to drive animation externally (walk cycle, wave,
 * breathing, etc). Arms include a wrist pivot so the hand can rotate
 * independently for realistic waving.
 */

export type AgentRefs = {
  group: RefObject<THREE.Group | null>;
  body: RefObject<THREE.Group | null>;
  head: RefObject<THREE.Group | null>;
  armL: RefObject<THREE.Group | null>;
  armR: RefObject<THREE.Group | null>;
  wristL: RefObject<THREE.Group | null>;
  wristR: RefObject<THREE.Group | null>;
  legL: RefObject<THREE.Group | null>;
  legR: RefObject<THREE.Group | null>;
};

export function useAgentRefs(): AgentRefs {
  return {
    group: useRef<THREE.Group>(null),
    body: useRef<THREE.Group>(null),
    head: useRef<THREE.Group>(null),
    armL: useRef<THREE.Group>(null),
    armR: useRef<THREE.Group>(null),
    wristL: useRef<THREE.Group>(null),
    wristR: useRef<THREE.Group>(null),
    legL: useRef<THREE.Group>(null),
    legR: useRef<THREE.Group>(null),
  };
}

type Props = {
  agentId: AgentId;
  refs: AgentRefs;
  /** If set, renders an Outlines pass around the body in this color. */
  outlineColor?: string;
  /** Outline opacity 0..1; 0 means no outline rendered. */
  outlineOpacity?: number;
  /**
   * Optional face-texture override. When set, this texture is drawn on the
   * head front instead of the default SVG-rasterized portrait. Used by the
   * onboarding transition to show a bigger, cuter hero face.
   */
  faceTextureOverride?: THREE.CanvasTexture | null;
  /** Pointer/click handlers are forwarded to the root group so the parent
   * can wire hover/click without adding an extra wrapping group that would
   * fight the position animation on refs.group. */
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
};

export function AgentFigure({
  agentId,
  refs,
  outlineColor,
  outlineOpacity = 0,
  faceTextureOverride,
  onPointerOver,
  onPointerOut,
  onClick,
}: Props) {
  const hue = AGENTS[agentId].hue;
  const defaultFaceTex = useAgentFaceTexture(agentId, true);
  const faceTex = faceTextureOverride ?? defaultFaceTex;
  const palette = useMemo(() => paletteFor(hue), [hue]);

  return (
    <group
      ref={refs.group}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      {/* Legs — planted while the body bobs */}
      <group ref={refs.legL} position={[-0.11, 0.22, 0]}>
        <RoundedBox
          args={[0.15, 0.22, 0.2]}
          radius={0.038}
          smoothness={4}
          position={[0, -0.11, 0]}
        >
          <meshStandardMaterial color={palette.leg} roughness={0.78} metalness={0.02} />
        </RoundedBox>
      </group>
      <group ref={refs.legR} position={[0.11, 0.22, 0]}>
        <RoundedBox
          args={[0.15, 0.22, 0.2]}
          radius={0.038}
          smoothness={4}
          position={[0, -0.11, 0]}
        >
          <meshStandardMaterial color={palette.leg} roughness={0.78} metalness={0.02} />
        </RoundedBox>
      </group>

      {/* Body group — parent moves this for bob/breathing */}
      <group ref={refs.body} position={[0, 0.47, 0]}>
        <RoundedBox args={[0.44, 0.52, 0.36]} radius={0.07} smoothness={5}>
          <meshStandardMaterial
            color={palette.body}
            roughness={0.6}
            metalness={0.05}
            envMapIntensity={0.45}
          />
          {outlineColor && outlineOpacity > 0 ? (
            <Outlines
              thickness={0.012}
              color={outlineColor}
              opacity={outlineOpacity}
              transparent
            />
          ) : null}
        </RoundedBox>

        {/* Chest patch */}
        <mesh position={[0, 0.03, 0.184]}>
          <planeGeometry args={[0.3, 0.1]} />
          <meshBasicMaterial color={palette.patch} transparent opacity={0.7} />
        </mesh>
        {/* Chest accent line */}
        <mesh position={[0, -0.08, 0.184]}>
          <planeGeometry args={[0.16, 0.01]} />
          <meshBasicMaterial color={palette.accent} transparent opacity={0.75} />
        </mesh>

        {/* Left arm · shoulder pivot + wrist pivot */}
        <group ref={refs.armL} position={[-0.25, 0.2, 0]}>
          <RoundedBox
            args={[0.13, 0.4, 0.15]}
            radius={0.04}
            smoothness={4}
            position={[0, -0.2, 0]}
          >
            <meshStandardMaterial color={palette.body} roughness={0.65} metalness={0.04} />
          </RoundedBox>
          <group ref={refs.wristL} position={[0, -0.4, 0]}>
            {/* Hand — pivot at wrist top; mesh sits slightly below */}
            <RoundedBox
              args={[0.12, 0.12, 0.13]}
              radius={0.036}
              smoothness={4}
              position={[0, -0.06, 0]}
            >
              <meshStandardMaterial color={palette.hand} roughness={0.7} />
            </RoundedBox>
          </group>
        </group>

        {/* Right arm · shoulder pivot + wrist pivot */}
        <group ref={refs.armR} position={[0.25, 0.2, 0]}>
          <RoundedBox
            args={[0.13, 0.4, 0.15]}
            radius={0.04}
            smoothness={4}
            position={[0, -0.2, 0]}
          >
            <meshStandardMaterial color={palette.body} roughness={0.65} metalness={0.04} />
          </RoundedBox>
          <group ref={refs.wristR} position={[0, -0.4, 0]}>
            <RoundedBox
              args={[0.12, 0.12, 0.13]}
              radius={0.036}
              smoothness={4}
              position={[0, -0.06, 0]}
            >
              <meshStandardMaterial color={palette.hand} roughness={0.7} />
            </RoundedBox>
          </group>
        </group>

        {/* Head */}
        <group ref={refs.head} position={[0, 0.55, 0]}>
          <RoundedBox args={[0.62, 0.58, 0.5]} radius={0.06} smoothness={4}>
            <meshStandardMaterial color={palette.head} roughness={0.62} metalness={0.06} />
          </RoundedBox>
          {faceTex ? (
            <mesh position={[0, 0, 0.258]} renderOrder={2}>
              <planeGeometry args={[0.64, 0.6]} />
              <meshBasicMaterial
                map={faceTex}
                transparent
                toneMapped={false}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          ) : null}
          <BlinkingEyes agentId={agentId} />
          <AgentTopper id={agentId} />
        </group>
      </group>
    </group>
  );
}

function BlinkingEyes({ agentId }: { agentId: AgentId }) {
  const frontLeft = useRef<THREE.Mesh>(null);
  const frontRight = useRef<THREE.Mesh>(null);
  const rearLeft = useRef<THREE.Mesh>(null);
  const rearRight = useRef<THREE.Mesh>(null);
  const timing = useMemo(() => blinkTiming(agentId), [agentId]);

  useFrame(({ clock }) => {
    const openness = blinkOpenness(clock.elapsedTime, timing.period, timing.offset);
    const scaleY = Math.max(0.08, openness);
    for (const eye of [frontLeft, frontRight, rearLeft, rearRight]) {
      if (eye.current) eye.current.scale.y = scaleY;
    }
  });

  return (
    <>
      <EyePair left={frontLeft} right={frontRight} position={[0, 0.035, 0.264]} />
      <EyePair
        left={rearLeft}
        right={rearRight}
        position={[0, 0.035, -0.264]}
        rotation={[0, Math.PI, 0]}
      />
    </>
  );
}

function EyePair({
  left,
  right,
  position,
  rotation,
}: {
  left: RefObject<THREE.Mesh | null>;
  right: RefObject<THREE.Mesh | null>;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation} renderOrder={4}>
      <Eye eyeRef={left} x={-0.12} />
      <Eye eyeRef={right} x={0.12} />
    </group>
  );
}

function Eye({
  eyeRef,
  x,
}: {
  eyeRef: RefObject<THREE.Mesh | null>;
  x: number;
}) {
  return (
    <mesh ref={eyeRef} position={[x, 0, 0]} renderOrder={4}>
      <planeGeometry args={[0.088, 0.096]} />
      <meshBasicMaterial
        color="#050505"
        toneMapped={false}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
      />
    </mesh>
  );
}

function blinkTiming(agentId: AgentId) {
  const seed = {
    scout: 0.15,
    mimi: 0.48,
    pip: 0.82,
    juno: 1.18,
    bodhi: 1.54,
  } satisfies Record<AgentId, number>;
  const n = seed[agentId];
  return {
    period: 3.35 + n * 0.55,
    offset: n * 2.4,
  };
}

function blinkOpenness(t: number, period: number, offset: number) {
  const blinkDuration = 0.16;
  const phase = (t + offset) % period;
  if (phase > blinkDuration) return 1;
  const x = phase / blinkDuration;
  return 1 - Math.sin(x * Math.PI) * 0.92;
}

function paletteFor(hex: string) {
  const base = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const body = new THREE.Color().setHSL(
    hsl.h,
    Math.min(0.78, hsl.s * 0.9),
    Math.min(0.62, hsl.l + 0.14)
  );
  const head = new THREE.Color().setHSL(
    hsl.h,
    Math.min(0.72, hsl.s * 0.82),
    Math.min(0.7, hsl.l + 0.22)
  );
  const leg = new THREE.Color().setHSL(
    hsl.h,
    Math.min(0.68, hsl.s * 0.8),
    Math.max(0.22, hsl.l - 0.1)
  );
  const hand = new THREE.Color().setHSL(hsl.h, 0.22, 0.86);
  const patch = new THREE.Color().setHSL(
    hsl.h,
    Math.min(0.9, hsl.s * 1.05),
    Math.min(0.82, hsl.l + 0.32)
  );
  const accent = new THREE.Color(hex);
  return {
    body: body.getStyle(),
    head: head.getStyle(),
    leg: leg.getStyle(),
    hand: hand.getStyle(),
    patch: patch.getStyle(),
    accent: accent.getStyle(),
  };
}
