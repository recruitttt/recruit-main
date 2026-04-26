"use client";

import * as React from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Outlines, Html } from "@react-three/drei";
import { AGENTS, AGENT_ORDER, type AgentId } from "@/lib/agents";
import { agentHomePosition } from "@/lib/room/app-agent-map";
import { WALK_SPEED, BOB_AMPLITUDE, LIMB_SWING, phase, dampYaw } from "@/lib/room/walk";
import { BOUNDS, playerActive, playerPosition, SPAWN_FACING, SPAWN_POINT } from "@/lib/room/player-position";
import { useRoomStore } from "./room-store";

const PLAYER_BODY_HUE = "#94A3B8";
const PLAYER_CAP_HUE = "#F97316";
const NEAREST_AGENT_RADIUS = 1.8;
const PLAYER_SPEED = WALK_SPEED * 1.35;

type Keys = { forward: boolean; back: boolean; left: boolean; right: boolean; interact: boolean };

function makePalette(hue: string) {
  const base = new THREE.Color(hue);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const body = new THREE.Color().setHSL(hsl.h, Math.min(0.5, hsl.s), Math.min(0.6, hsl.l + 0.1));
  const head = new THREE.Color().setHSL(hsl.h, Math.min(0.4, hsl.s), Math.min(0.7, hsl.l + 0.22));
  const leg = new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0.22, hsl.l - 0.12));
  const hand = new THREE.Color().setHSL(hsl.h, 0.18, 0.86);
  return {
    body: body.getStyle(),
    head: head.getStyle(),
    leg: leg.getStyle(),
    hand: hand.getStyle(),
  };
}

export function PlayerCharacter() {
  const playerMode = useRoomStore((s) => s.playerMode);
  if (playerMode === "off") return null;
  return <PlayerCharacterActive />;
}

function PlayerCharacterActive() {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const positionRef = useRef(new THREE.Vector3(SPAWN_POINT[0], SPAWN_POINT[1], SPAWN_POINT[2]));
  const yawRef = useRef(SPAWN_FACING);
  const keys = useRef<Keys>({ forward: false, back: false, left: false, right: false, interact: false });
  const palette = useMemo(() => makePalette(PLAYER_BODY_HUE), []);

  const setFocusTarget = useRoomStore((s) => s.setFocusTarget);
  const setNearest = useRoomStore((s) => s.setPlayerNearestAgent);
  const nearestId = useRoomStore((s) => s.playerNearestAgentId);
  const setPlayerPose = useRoomStore((s) => s.setPlayerPose);
  const setCameraMode = useRoomStore((s) => s.setCameraMode);

  useEffect(() => {
    if (groupRef.current) groupRef.current.position.copy(positionRef.current);
    playerPosition.copy(positionRef.current);
    playerActive.current = true;
    return () => {
      playerActive.current = false;
    };
  }, []);

  useEffect(() => {
    const map: Record<string, keyof Keys> = {
      KeyW: "forward",
      ArrowUp: "forward",
      KeyS: "back",
      ArrowDown: "back",
      KeyA: "left",
      ArrowLeft: "left",
      KeyD: "right",
      ArrowRight: "right",
      KeyE: "interact",
    };
    const isTextEntryFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return (el as HTMLElement).isContentEditable === true;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextEntryFocused()) return;
      if (e.code === "Escape" || e.key === "Escape") {
        const pose = useRoomStore.getState().playerPose;
        if (pose === "sitting") {
          setPlayerPose("transitioning");
          setCameraMode("overview");
          window.setTimeout(() => setPlayerPose("standing"), 800);
          e.preventDefault();
          return;
        }
      }
      const k = map[e.code];
      if (!k) return;
      if (k === "interact") {
        const state = useRoomStore.getState();
        const pose = state.playerPose;
        const pos = positionRef.current;
        const distToDesk = Math.hypot(pos.x - 0, pos.z - 0);
        const canSit = distToDesk < 1.2 && pose === "standing";
        if (canSit) {
          setPlayerPose("transitioning");
          setCameraMode("first-person-desk");
          window.setTimeout(() => setPlayerPose("sitting"), 800);
          e.preventDefault();
          return;
        }
        const id = state.playerNearestAgentId;
        if (id) setFocusTarget({ kind: "agent", id });
        return;
      }
      keys.current[k] = true;
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = map[e.code];
      if (!k || k === "interact") return;
      keys.current[k] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [setFocusTarget, setPlayerPose, setCameraMode]);

  useFrame(({ clock }, delta) => {
    const k = keys.current;
    const dx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const dz = (k.back ? 1 : 0) - (k.forward ? 1 : 0);
    let moving = false;
    const pos = positionRef.current;
    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      const stepX = (dx / len) * PLAYER_SPEED * delta;
      const stepZ = (dz / len) * PLAYER_SPEED * delta;
      pos.x = THREE.MathUtils.clamp(pos.x + stepX, BOUNDS.minX, BOUNDS.maxX);
      pos.z = THREE.MathUtils.clamp(pos.z + stepZ, BOUNDS.minZ, BOUNDS.maxZ);
      yawRef.current = Math.atan2(stepX, stepZ);
      moving = true;
    }

    playerPosition.copy(pos);

    const g = groupRef.current;
    if (!g) return;
    g.position.set(pos.x, 0, pos.z);
    g.rotation.y = dampYaw(g.rotation.y, yawRef.current, delta);

    const t = clock.elapsedTime;
    if (moving) {
      const swing = phase(t, 0) * LIMB_SWING;
      if (legLRef.current) legLRef.current.rotation.x = swing;
      if (legRRef.current) legRRef.current.rotation.x = -swing;
      if (armLRef.current) armLRef.current.rotation.x = -swing * 0.8;
      if (armRRef.current) armRRef.current.rotation.x = swing * 0.8;
      if (bodyRef.current) bodyRef.current.position.y = 0.47 + phase(t, 0) * BOB_AMPLITUDE;
    } else {
      const breathe = Math.sin(t * 1.4) * 0.012;
      if (legLRef.current) legLRef.current.rotation.x = THREE.MathUtils.damp(legLRef.current.rotation.x, 0, 8, delta);
      if (legRRef.current) legRRef.current.rotation.x = THREE.MathUtils.damp(legRRef.current.rotation.x, 0, 8, delta);
      if (armLRef.current) armLRef.current.rotation.x = THREE.MathUtils.damp(armLRef.current.rotation.x, 0, 8, delta);
      if (armRRef.current) armRRef.current.rotation.x = THREE.MathUtils.damp(armRRef.current.rotation.x, 0, 8, delta);
      if (bodyRef.current) bodyRef.current.position.y = 0.47 + breathe;
    }
    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.damp(headRef.current.rotation.y, 0, 6, delta);
    }

    let bestId: AgentId | null = null;
    let bestDist = NEAREST_AGENT_RADIUS;
    for (const id of AGENT_ORDER) {
      const home = agentHomePosition(id);
      const dist = Math.hypot(home.x - pos.x, home.z - pos.z);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = id;
      }
    }
    if (bestId !== nearestId) setNearest(bestId);
  });

  return (
    <group ref={groupRef}>
      <group ref={legLRef} position={[-0.11, 0.22, 0]}>
        <RoundedBox args={[0.15, 0.22, 0.2]} radius={0.038} smoothness={4} position={[0, -0.11, 0]} castShadow>
          <meshStandardMaterial color={palette.leg} roughness={0.78} />
        </RoundedBox>
      </group>
      <group ref={legRRef} position={[0.11, 0.22, 0]}>
        <RoundedBox args={[0.15, 0.22, 0.2]} radius={0.038} smoothness={4} position={[0, -0.11, 0]} castShadow>
          <meshStandardMaterial color={palette.leg} roughness={0.78} />
        </RoundedBox>
      </group>
      <group ref={bodyRef} position={[0, 0.47, 0]}>
        <RoundedBox args={[0.44, 0.52, 0.36]} radius={0.07} smoothness={5} castShadow>
          <meshStandardMaterial color={palette.body} roughness={0.6} />
          <Outlines thickness={0.012} color={PLAYER_CAP_HUE} opacity={0.6} transparent />
        </RoundedBox>
        <mesh position={[0, 0.03, 0.184]}>
          <planeGeometry args={[0.3, 0.1]} />
          <meshBasicMaterial color={PLAYER_CAP_HUE} transparent opacity={0.7} />
        </mesh>
        <group ref={armLRef} position={[-0.25, 0.2, 0]}>
          <RoundedBox args={[0.13, 0.4, 0.15]} radius={0.04} smoothness={4} position={[0, -0.2, 0]} castShadow>
            <meshStandardMaterial color={palette.body} roughness={0.65} />
          </RoundedBox>
          <RoundedBox args={[0.12, 0.12, 0.13]} radius={0.036} smoothness={4} position={[0, -0.46, 0]} castShadow>
            <meshStandardMaterial color={palette.hand} roughness={0.7} />
          </RoundedBox>
        </group>
        <group ref={armRRef} position={[0.25, 0.2, 0]}>
          <RoundedBox args={[0.13, 0.4, 0.15]} radius={0.04} smoothness={4} position={[0, -0.2, 0]} castShadow>
            <meshStandardMaterial color={palette.body} roughness={0.65} />
          </RoundedBox>
          <RoundedBox args={[0.12, 0.12, 0.13]} radius={0.036} smoothness={4} position={[0, -0.46, 0]} castShadow>
            <meshStandardMaterial color={palette.hand} roughness={0.7} />
          </RoundedBox>
        </group>
        <group ref={headRef} position={[0, 0.55, 0]}>
          <RoundedBox args={[0.62, 0.58, 0.5]} radius={0.13} smoothness={5} castShadow>
            <meshStandardMaterial color={palette.head} roughness={0.6} />
          </RoundedBox>
          <mesh position={[0, 0.34, 0.04]}>
            <cylinderGeometry args={[0.34, 0.36, 0.16, 24]} />
            <meshStandardMaterial color={PLAYER_CAP_HUE} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.32, 0.36]} rotation={[Math.PI / 2.6, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.22, 0.04, 24, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color={PLAYER_CAP_HUE} roughness={0.55} />
          </mesh>
          <mesh position={[-0.13, 0.05, 0.27]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#101827" roughness={0.4} />
          </mesh>
          <mesh position={[0.13, 0.05, 0.27]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#101827" roughness={0.4} />
          </mesh>
        </group>
      </group>
      <DeskSitPrompt positionRef={positionRef} />
      {nearestId ? <NearestPrompt agentName={AGENTS[nearestId].name} /> : null}
    </group>
  );
}

function DeskSitPrompt({ positionRef }: { positionRef: React.RefObject<THREE.Vector3> }) {
  const playerPose = useRoomStore((s) => s.playerPose);
  const [visible, setVisible] = React.useState(false);
  useFrame(() => {
    if (!positionRef.current) return;
    const pos = positionRef.current;
    const distToDesk = Math.hypot(pos.x - 0, pos.z - 0);
    const shouldShow = distToDesk < 1.2 && playerPose === "standing";
    if (shouldShow !== visible) setVisible(shouldShow);
  });
  if (!visible) return null;
  return (
    <Html
      position={[0, 1.95, 0]}
      center
      distanceFactor={9}
      style={{ pointerEvents: "none" }}
      zIndexRange={[40, 0]}
    >
      <div className="pointer-events-none -translate-y-1 select-none rounded-full border border-white/55 bg-emerald-700/90 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.4)]">
        E · sit at desk
      </div>
    </Html>
  );
}

function NearestPrompt({ agentName }: { agentName: string }) {
  return (
    <Html
      position={[0, 1.95, 0]}
      center
      distanceFactor={9}
      style={{ pointerEvents: "none" }}
      zIndexRange={[40, 0]}
    >
      <div className="pointer-events-none -translate-y-1 select-none rounded-full border border-white/55 bg-[#101827]/90 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.4)]">
        E · talk to {agentName}
      </div>
    </Html>
  );
}
