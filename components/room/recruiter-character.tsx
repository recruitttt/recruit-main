"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { RecruiterAppearance } from "@/lib/recruiter/appearance";

type Props = {
  appearance: RecruiterAppearance;
  pose: "idle" | "alert" | "talking" | "applied";
  position: readonly [number, number, number];
  facing: number;
};

export function RecruiterCharacter({ appearance, pose, position, facing }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    if (groupRef.current) {
      const bob = pose === "idle" ? Math.sin(t.current * 1.3) * 0.02 : 0;
      groupRef.current.position.y = position[1] + bob;
      const targetY = pose === "alert" || pose === "talking" ? 1.1 : 1.0;
      groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, targetY, 0.1);
    }
  });

  return (
    <group ref={groupRef} position={position as [number, number, number]} rotation={[0, facing, 0]}>
      {/* Body */}
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.25, 0.55, 4, 8]} />
        <meshStandardMaterial color={appearance.outfitColor} roughness={0.85} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.15, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={appearance.skinTone} roughness={0.6} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 1.27, 0]}>
        <sphereGeometry args={[0.19, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={appearance.hairColor} roughness={0.9} />
      </mesh>
      {/* Glasses */}
      {appearance.accessory === "glasses" && (
        <mesh position={[0, 1.13, 0.18]}>
          <torusGeometry args={[0.04, 0.008, 8, 16]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      )}
      {/* Clipboard */}
      {appearance.accessory === "clipboard" && (
        <mesh position={[0.25, 0.55, 0.18]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.15, 0.2, 0.01]} />
          <meshStandardMaterial color="#c5a576" />
        </mesh>
      )}
    </group>
  );
}
