"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useRoomStore } from "./room-store";

export function PersonalizationCompanion() {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const setOpen = useRoomStore((s) => s.setPersonalizationOpen);

  useFrame((_, delta) => {
    t.current += delta;
    if (ref.current) {
      ref.current.position.y = 1.8 + Math.sin(t.current * 1.6) * 0.08;
      ref.current.rotation.y = t.current * 0.5;
    }
  });

  return (
    <mesh ref={ref} position={[3, 1.8, 3]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setOpen(true); }}>
      <icosahedronGeometry args={[0.18, 1]} />
      <meshStandardMaterial color="#a78bfa" emissive="#5b21b6" emissiveIntensity={0.4} roughness={0.4} />
    </mesh>
  );
}
