"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { AGENTS, type AgentId } from "@/lib/agents";

type Props = {
  id: AgentId;
};

export function AgentTopper({ id }: Props) {
  switch (id) {
    case "scout":
      return <ScoutTopper />;
    case "mimi":
      return <MimiTopper />;
    case "pip":
      return <PipTopper />;
    case "juno":
      return <JunoTopper />;
    case "bodhi":
      return <BodhiTopper />;
  }
}

/** Scout: antenna + pulse ring. Most distinctive silhouette in the group. */
function ScoutTopper() {
  const hue = AGENTS.scout.hue;
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.elapsedTime;
    const cycle = (t % 1.8) / 1.8;
    const scale = 1 + cycle * 2.8;
    ringRef.current.scale.set(scale, scale, scale);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 0.55 - cycle * 0.55);
  });

  return (
    <group position={[0, 0.32, 0]}>
      {/* Antenna stick */}
      <mesh castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
        <meshStandardMaterial color={hue} roughness={0.45} metalness={0.25} />
      </mesh>
      {/* Antenna bulb */}
      <mesh position={[0, 0.11, 0]} castShadow>
        <sphereGeometry args={[0.038, 20, 20]} />
        <meshStandardMaterial
          color={hue}
          emissive={hue}
          emissiveIntensity={0.6}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>
      {/* Pulse ring */}
      <mesh ref={ringRef} position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.058, 32]} />
        <meshBasicMaterial color={hue} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Mimi: two hair tufts curving up and out. */
function MimiTopper() {
  const hue = AGENTS.mimi.hue;
  return (
    <group position={[0, 0.2, 0]}>
      <mesh position={[-0.08, 0.04, 0.02]} rotation={[0, 0, -0.42]} castShadow>
        <coneGeometry args={[0.04, 0.16, 16]} />
        <meshStandardMaterial color={hue} roughness={0.55} />
      </mesh>
      <mesh position={[0.08, 0.04, 0.02]} rotation={[0, 0, 0.42]} castShadow>
        <coneGeometry args={[0.04, 0.16, 16]} />
        <meshStandardMaterial color={hue} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.08, -0.02]} rotation={[-0.15, 0, 0]} castShadow>
        <coneGeometry args={[0.034, 0.12, 16]} />
        <meshStandardMaterial color={hue} roughness={0.55} />
      </mesh>
    </group>
  );
}

/** Pip: small observer-style accent dome on top. */
function PipTopper() {
  const hue = AGENTS.pip.hue;
  return (
    <group position={[0, 0.2, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.048, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={hue} roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.044, 0]}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshStandardMaterial
          color={hue}
          emissive={hue}
          emissiveIntensity={0.5}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/** Juno: two pointy ears rotated out. */
function JunoTopper() {
  const hue = AGENTS.juno.hue;
  return (
    <group position={[0, 0.2, 0]}>
      <mesh position={[-0.11, 0.04, 0]} rotation={[0, 0, -0.28]} castShadow>
        <coneGeometry args={[0.055, 0.22, 12]} />
        <meshStandardMaterial color={hue} roughness={0.6} />
      </mesh>
      <mesh position={[0.11, 0.04, 0]} rotation={[0, 0, 0.28]} castShadow>
        <coneGeometry args={[0.055, 0.22, 12]} />
        <meshStandardMaterial color={hue} roughness={0.6} />
      </mesh>
      {/* Inner-ear warm tint */}
      <mesh position={[-0.105, 0.04, 0.025]} rotation={[0, 0, -0.28]}>
        <coneGeometry args={[0.03, 0.16, 12]} />
        <meshStandardMaterial color="#F6BFA8" roughness={0.75} />
      </mesh>
      <mesh position={[0.105, 0.04, 0.025]} rotation={[0, 0, 0.28]}>
        <coneGeometry args={[0.03, 0.16, 12]} />
        <meshStandardMaterial color="#F6BFA8" roughness={0.75} />
      </mesh>
    </group>
  );
}

/** Bodhi: rotating sparkle (three crossed billboard planes). */
function BodhiTopper() {
  const hue = AGENTS.bodhi.hue;
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.elapsedTime * 0.7;
    groupRef.current.children.forEach((c, i) => {
      c.scale.setScalar(0.9 + Math.sin(clock.elapsedTime * 1.8 + i) * 0.18);
    });
  });
  return (
    <group ref={groupRef} position={[0, 0.32, 0]}>
      <mesh>
        <planeGeometry args={[0.03, 0.18]} />
        <meshBasicMaterial color={hue} transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.03, 0.18]} />
        <meshBasicMaterial color={hue} transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[0.03, 0.18]} />
        <meshBasicMaterial color={hue} transparent opacity={0.85} />
      </mesh>
      {/* Core */}
      <mesh>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshStandardMaterial
          color="#FFFBEA"
          emissive={hue}
          emissiveIntensity={0.8}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}
