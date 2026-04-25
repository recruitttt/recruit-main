"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { agentHomePosition, stationForAgent } from "@/lib/room/app-agent-map";
import { AgentFigure, useAgentRefs } from "./agent-figure";

export type RoomIntroPhase = "wave" | "fall" | "land" | "done";

type PhaseClock = {
  phase: RoomIntroPhase;
  at: number;
};

type CachedMaterial = {
  material: THREE.Material & { opacity: number };
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
};

const OVERVIEW_POS = new THREE.Vector3(0, 6.8, 12.4);
const OVERVIEW_LOOK = new THREE.Vector3(0, 1.6, -2.0);
const INTRO_HEIGHT = 1.28;

export function RoomIntroScout({ phase }: { phase: RoomIntroPhase }) {
  const refs = useAgentRefs();
  const shadow = useRef<THREE.Mesh>(null);
  const phaseClock = usePhaseClock(phase);
  const home = useRef(agentHomePosition("scout"));
  const station = useRef(stationForAgent("scout"));

  useFrame(({ clock }, delta) => {
    const group = refs.group.current;
    const body = refs.body.current;
    const armR = refs.armR.current;
    const armL = refs.armL.current;
    const wristR = refs.wristR.current;
    const wristL = refs.wristL.current;
    const head = refs.head.current;
    const legL = refs.legL.current;
    const legR = refs.legR.current;
    if (!group || !body || !armR || !armL || !wristR || !wristL || !head || !legL || !legR) return;

    const t = elapsed(phaseClock.current);
    const ct = clock.elapsedTime;
    const target = home.current;
    const start = introStartFor(target);

    if (phase === "wave") {
      group.position.copy(start);
      group.rotation.set(0, 0, 0);
      group.scale.setScalar(1.34);
      updateShadow(shadow.current, group.position, 0, 0);

      const shoulderBase = Math.PI * 0.82;
      const swing = Math.sin(t * 8.2) * 0.2;
      armR.rotation.x = THREE.MathUtils.damp(armR.rotation.x, 0, 10, delta);
      armR.rotation.y = 0;
      armR.rotation.z = THREE.MathUtils.damp(armR.rotation.z, shoulderBase + swing, 10, delta);
      wristR.rotation.set(0, 0, Math.sin(t * 8.2 + 0.6) * 0.18);

      armL.rotation.x = THREE.MathUtils.damp(armL.rotation.x, Math.sin(t * 2) * 0.04, 5, delta);
      armL.rotation.z = THREE.MathUtils.damp(armL.rotation.z, 0, 5, delta);
      wristL.rotation.set(0, 0, 0);

      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0.18, 5, delta);
      head.rotation.z = THREE.MathUtils.damp(head.rotation.z, 0.08, 5, delta);
      head.rotation.x = Math.sin(t * 2.4) * 0.03;
      body.position.y = 0.47 + Math.abs(Math.sin(ct * 4)) * 0.026;
      body.scale.setScalar(1);
      body.rotation.z = Math.sin(ct * 2) * 0.02;
      legL.rotation.set(0, 0, 0);
      legR.rotation.set(0, 0, 0);
      return;
    }

    if (phase === "fall") {
      const e = clamp01(t / 1.02);
      const gravity = e * e;
      group.position.set(
        target.x + Math.sin(e * Math.PI * 1.2) * 0.05,
        THREE.MathUtils.lerp(start.y, target.y, gravity) + Math.sin(e * Math.PI) * 0.1,
        target.z
      );
      group.rotation.y = station.current.facing;
      group.rotation.x = Math.sin(e * Math.PI) * 0.16;
      group.rotation.z = Math.sin(e * Math.PI * 2) * 0.08;
      group.scale.setScalar(THREE.MathUtils.lerp(1.34, 1, smoothstep(e)));
      updateShadow(shadow.current, group.position, smoothstep(e), 0.23);

      const tuck = Math.sin(e * Math.PI);
      armR.rotation.x = THREE.MathUtils.damp(armR.rotation.x, -0.35 - tuck * 0.35, 7, delta);
      armR.rotation.z = THREE.MathUtils.damp(armR.rotation.z, 0.14, 7, delta);
      armL.rotation.x = THREE.MathUtils.damp(armL.rotation.x, -0.24 - tuck * 0.28, 7, delta);
      armL.rotation.z = THREE.MathUtils.damp(armL.rotation.z, -0.12, 7, delta);
      wristR.rotation.set(0, 0, 0);
      wristL.rotation.set(0, 0, 0);
      head.rotation.x = Math.sin(e * Math.PI) * 0.08;
      head.rotation.y = THREE.MathUtils.damp(head.rotation.y, 0, 5, delta);
      head.rotation.z = THREE.MathUtils.damp(head.rotation.z, 0, 5, delta);
      body.position.y = 0.47 + Math.sin(e * Math.PI * 3) * 0.012;
      body.scale.setScalar(1);
      legL.rotation.x = -tuck * 0.18;
      legR.rotation.x = tuck * 0.18;
      return;
    }

    if (phase === "land") {
      const e = clamp01(t / 0.62);
      const bounce = Math.sin(e * Math.PI) * 0.16 * (1 - e);
      group.position.set(target.x, target.y + bounce, target.z);
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, 0, 8, delta);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, station.current.facing, 8, delta);
      group.rotation.z = THREE.MathUtils.damp(group.rotation.z, 0, 8, delta);
      group.scale.set(
        1 + Math.sin(e * Math.PI) * 0.035,
        1 - Math.sin(e * Math.PI) * 0.05,
        1 + Math.sin(e * Math.PI) * 0.035
      );
      updateShadow(shadow.current, group.position, 1, 0.26);

      body.position.y = 0.47 + Math.sin(ct * 1.6) * 0.012;
      body.scale.setScalar(1);
      armR.rotation.x = THREE.MathUtils.damp(armR.rotation.x, -0.12, 6, delta);
      armR.rotation.z = THREE.MathUtils.damp(armR.rotation.z, 0, 6, delta);
      armL.rotation.x = THREE.MathUtils.damp(armL.rotation.x, -0.08, 6, delta);
      armL.rotation.z = THREE.MathUtils.damp(armL.rotation.z, 0, 6, delta);
      wristR.rotation.set(0, 0, 0);
      wristL.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      legL.rotation.set(0, 0, 0);
      legR.rotation.set(0, 0, 0);
      return;
    }

    group.position.copy(target);
    group.rotation.set(0, station.current.facing, 0);
    group.scale.setScalar(1);
    updateShadow(shadow.current, group.position, 1, 0.2);
  });

  return (
    <>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.48, 36]} />
        <meshBasicMaterial color="#2B2620" transparent opacity={0} depthWrite={false} />
      </mesh>
      <AgentFigure agentId="scout" refs={refs} />
    </>
  );
}

export function RoomIntroCamera({ phase }: { phase: RoomIntroPhase }) {
  const { camera, size } = useThree();
  const phaseClock = usePhaseClock(phase);
  const tmpPos = useRef(new THREE.Vector3());
  const tmpLook = useRef(new THREE.Vector3());
  const heroPos = useRef(new THREE.Vector3());
  const heroLook = useRef(new THREE.Vector3());
  const outroPos = useRef(new THREE.Vector3());
  const outroLook = useRef(new THREE.Vector3());
  const home = useRef(agentHomePosition("scout"));

  useFrame(() => {
    const t = elapsed(phaseClock.current);
    heroCameraFor(home.current, heroPos.current, heroLook.current);
    outroCameraFor(home.current, size.width, outroPos.current, outroLook.current);
    if (phase === "wave") {
      camera.position.copy(heroPos.current);
      camera.lookAt(heroLook.current);
      return;
    }

    if (phase === "fall") {
      const e = smoothstep(clamp01(t / 1.02));
      tmpPos.current.lerpVectors(heroPos.current, outroPos.current, e);
      tmpLook.current.lerpVectors(heroLook.current, outroLook.current, e);
      camera.position.copy(tmpPos.current);
      camera.lookAt(tmpLook.current);
      return;
    }

    if (phase === "land") {
      const e = smoothstep(clamp01(t / 0.62));
      tmpPos.current.lerpVectors(camera.position, outroPos.current, 0.12 + e * 0.08);
      tmpLook.current.copy(outroLook.current);
      camera.position.copy(tmpPos.current);
      camera.lookAt(tmpLook.current);
      return;
    }

    camera.position.copy(outroPos.current);
    camera.lookAt(outroLook.current);
  });

  return null;
}

export function IntroRevealGroup({
  phase,
  children,
}: {
  phase?: RoomIntroPhase;
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const materials = useRef<CachedMaterial[]>([]);
  const lastOpacity = useRef<number | null>(null);
  const phaseClock = usePhaseClock(phase ?? "done");

  useFrame(() => {
    if (!phase) return;
    const root = group.current;
    if (!root) return;
    if (materials.current.length === 0) {
      materials.current = collectMaterials(root);
    }
    const opacity = revealOpacity(phase, elapsed(phaseClock.current));
    root.visible = opacity > 0.015;
    if (lastOpacity.current !== null && Math.abs(lastOpacity.current - opacity) < 0.006) {
      return;
    }
    lastOpacity.current = opacity;
    applyOpacity(materials.current, opacity);
  });

  return <group ref={group}>{children}</group>;
}

function usePhaseClock(phase: RoomIntroPhase) {
  const clock = useRef<PhaseClock>({ phase, at: now() });
  useEffect(() => {
    clock.current = { phase, at: now() };
  }, [phase]);
  return clock;
}

function revealOpacity(phase: RoomIntroPhase, t: number) {
  if (phase === "wave") return 0;
  if (phase === "fall") return smoothstep(clamp01((t - 0.1) / 0.72));
  return 1;
}

function collectMaterials(root: THREE.Object3D): CachedMaterial[] {
  const collected: CachedMaterial[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const material = mesh.material;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      const m = mat as THREE.Material & { opacity: number };
      if (typeof m.opacity !== "number") continue;
      collected.push({
        material: m,
        baseOpacity: m.opacity,
        baseTransparent: m.transparent,
        baseDepthWrite: m.depthWrite,
      });
    }
  });
  return collected;
}

function applyOpacity(materials: CachedMaterial[], opacity: number) {
  const faded = opacity < 0.999;
  for (const cached of materials) {
    const m = cached.material;
    const nextTransparent = cached.baseTransparent || faded;
    const nextDepthWrite = faded ? false : cached.baseDepthWrite;
    const needsUpdate = m.transparent !== nextTransparent || m.depthWrite !== nextDepthWrite;
    m.opacity = cached.baseOpacity * opacity;
    m.transparent = nextTransparent;
    m.depthWrite = nextDepthWrite;
    if (needsUpdate) m.needsUpdate = true;
  }
}

function updateShadow(
  shadow: THREE.Mesh | null,
  position: THREE.Vector3,
  closeness: number,
  maxOpacity: number
) {
  if (!shadow) return;
  shadow.position.set(position.x, 0.012, position.z);
  const scale = 0.45 + closeness * 0.55;
  shadow.scale.set(scale, scale, scale);
  const material = shadow.material as THREE.MeshBasicMaterial;
  material.opacity = maxOpacity * closeness;
}

function introStartFor(home: THREE.Vector3) {
  return new THREE.Vector3(home.x, home.y + INTRO_HEIGHT, home.z);
}

function heroCameraFor(
  home: THREE.Vector3,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3
) {
  outPos.set(home.x, 2.45, home.z + 6.4);
  outLook.set(home.x, 1.05, home.z + 0.15);
}

function outroCameraFor(
  home: THREE.Vector3,
  width: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3
) {
  if (width < 640) {
    outPos.set(home.x - 0.75, 4.9, home.z + 8.2);
    outLook.set(home.x - 0.2, 0.92, home.z - 0.05);
    return;
  }
  outPos.copy(OVERVIEW_POS);
  outLook.copy(OVERVIEW_LOOK);
}

function elapsed(clock: PhaseClock) {
  return (now() - clock.at) / 1000;
}

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function smoothstep(n: number) {
  return n * n * (3 - 2 * n);
}
