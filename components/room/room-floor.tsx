"use client";

import * as THREE from "three";
import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";

type Props = {
  onOpenSpaceClick?: () => void;
};

const WOOD_ROWS = ["#D7AD75", "#C9975E", "#E1B983", "#BE884F", "#D2A56A"];

export function RoomFloor({ onOpenSpaceClick }: Props) {
  const floorGeom = useMemo(() => new THREE.PlaneGeometry(28, 16, 1, 1), []);
  const plankRows = useMemo(() => {
    const rows: { z: number; color: string; opacity: number }[] = [];
    let i = 0;
    for (let z = -7.4; z <= 7.4; z += 0.62) {
      rows.push({
        z,
        color: WOOD_ROWS[i % WOOD_ROWS.length],
        opacity: 0.28 + (i % 3) * 0.035,
      });
      i += 1;
    }
    return rows;
  }, []);
  const plankLines = useMemo(() => {
    const arr: { z: number; alpha: number }[] = [];
    let i = 0;
    for (let z = -7.7; z <= 7.7; z += 0.62) {
      arr.push({ z, alpha: 0.12 + (i % 4) * 0.015 });
      i += 1;
    }
    return arr;
  }, []);
  const plankSeams = useMemo(() => {
    const arr: { x: number; z: number; alpha: number }[] = [];
    let row = 0;
    for (let z = -7.4; z <= 7.4; z += 0.62) {
      const offset = row % 2 === 0 ? -12.4 : -10.55;
      for (let x = offset; x <= 12.8; x += 3.7) {
        arr.push({ x, z, alpha: 0.08 + ((row + Math.round(x)) % 3) * 0.016 });
      }
      row += 1;
    }
    return arr;
  }, []);
  const grainMarks = useMemo(() => {
    const marks: { x: number; z: number; w: number; alpha: number }[] = [];
    for (let row = 0; row < 24; row += 1) {
      const z = -7.0 + row * 0.62;
      for (let i = 0; i < 6; i += 1) {
        const seed = row * 17 + i * 11;
        marks.push({
          x: -12.4 + ((seed * 1.73) % 24.8),
          z: z + (((seed * 0.37) % 0.24) - 0.12),
          w: 0.7 + ((seed * 0.19) % 0.75),
          alpha: 0.035 + (i % 3) * 0.012,
        });
      }
    }
    return marks;
  }, []);

  return (
    <group
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onOpenSpaceClick?.();
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} geometry={floorGeom}>
        <meshStandardMaterial color="#C89A63" roughness={0.72} metalness={0} envMapIntensity={0.26} />
      </mesh>

      {plankRows.map((p, i) => (
        <mesh key={`row-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0012, p.z]}>
          <planeGeometry args={[28, 0.6]} />
          <meshBasicMaterial color={p.color} transparent opacity={p.opacity} />
        </mesh>
      ))}
      {plankLines.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0024, p.z]}>
          <planeGeometry args={[28, 0.018]} />
          <meshBasicMaterial color="#6F4A24" transparent opacity={p.alpha} />
        </mesh>
      ))}
      {plankSeams.map((p, i) => (
        <mesh key={`seam-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.0028, p.z]}>
          <planeGeometry args={[0.014, 0.48]} />
          <meshBasicMaterial color="#6B431E" transparent opacity={p.alpha} />
        </mesh>
      ))}
      {grainMarks.map((p, i) => (
        <mesh key={`grain-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.0032, p.z]}>
          <planeGeometry args={[p.w, 0.012]} />
          <meshBasicMaterial color="#5F3B1C" transparent opacity={p.alpha} />
        </mesh>
      ))}

      <RoundedBox args={[28, 9.0, 0.2]} radius={0.04} smoothness={4} position={[0, 4.5, -7.0]}>
        <meshStandardMaterial color="#F3EAD6" roughness={0.92} metalness={0} />
      </RoundedBox>
      <mesh position={[0, 0.28, -6.88]}>
        <planeGeometry args={[28, 0.56]} />
        <meshStandardMaterial color="#E0D1B0" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.58, -6.88]}>
        <planeGeometry args={[28, 0.02]} />
        <meshStandardMaterial color="#A8906A" roughness={0.85} />
      </mesh>

      <mesh rotation={[0, Math.PI / 2, 0]} position={[-14.0, 4.5, -1]}>
        <planeGeometry args={[10.8, 9.0]} />
        <meshStandardMaterial color="#EEE3CC" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[14.0, 4.5, -1]}>
        <planeGeometry args={[10.8, 9.0]} />
        <meshStandardMaterial color="#EEE3CC" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 9.0, -1]}>
        <planeGeometry args={[28, 10.8]} />
        <meshStandardMaterial color="#FBF4E2" roughness={0.98} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
